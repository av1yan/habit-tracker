// Runtime tests for the offline-first stack: LocalDB reconciliation, the
// offline repos, and the SyncEngine end-to-end against a mock server.
//
//   npm test
//
// Uses Node's built-in test runner + node:sqlite (real SQL, no native build).

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { LocalDB } from '../local/db'
import * as habitsRepo from '../local/repo-habits'
import * as logsRepo from '../local/repo-logs'
import * as statsRepo from '../local/repo-stats'
import * as freezeRepo from '../local/repo-freezes'
import { SyncEngine } from './engine'
import { createNodeSqliteAdapter } from './testing/node-sqlite-adapter'
import { MockSupabase } from './testing/mock-supabase'
import { addDays, toLocalISODate } from '../data/helpers'
import type { DB } from '../data/client'

const USER = 'user-1'

async function freshLocal(): Promise<{ local: LocalDB; close: () => void }> {
  const { adapter, close } = createNodeSqliteAdapter()
  const local = new LocalDB(adapter)
  await local.init()
  await local.setUserId(USER)
  return { local, close }
}

function makeHabit(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    user_id: USER,
    name: `Habit ${id}`,
    icon: '🎯',
    color: '#c67139',
    category: 'Personal',
    type: 'binary',
    target: null,
    unit: null,
    freq_type: 'daily',
    freq_target: null,
    freq_days: null,
    is_bad: false,
    sort_order: 0,
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...over,
  }
}

const OLDER = '2026-01-01T00:00:00.000Z'
const NEWER = '2026-06-01T00:00:00.000Z'

// ---------------------------------------------------------------------------
// LocalDB — writes, tombstones, dirty tracking
// ---------------------------------------------------------------------------

test('writeLocal marks the row dirty and sets updated_at', async () => {
  const { local, close } = await freshLocal()
  await local.writeLocal('habits', makeHabit('h1'))
  const dirty = await local.getDirty<Record<string, unknown>>('habits')
  assert.equal(dirty.length, 1)
  assert.ok(dirty[0].updated_at, 'updated_at was set')
  close()
})

test('softDelete tombstones: hidden from reads, still pushable', async () => {
  const { local, close } = await freshLocal()
  await local.writeLocal('habits', makeHabit('h1'))
  await local.softDelete('habits', 'h1')
  assert.equal((await habitsRepo.listHabits(local)).length, 0, 'hidden from reads')
  const dirty = await local.getDirty<Record<string, unknown>>('habits')
  assert.equal(dirty.length, 1, 'tombstone is still dirty (will sync)')
  assert.ok(dirty[0].deleted_at, 'deleted_at is set')
  close()
})

// ---------------------------------------------------------------------------
// applyRemote — last-write-wins matrix
// ---------------------------------------------------------------------------

test('applyRemote inserts a new remote row (not dirty)', async () => {
  const { local, close } = await freshLocal()
  await local.applyRemote('habits', [makeHabit('h1', { name: 'Remote', updated_at: NEWER })])
  const got = await local.getById<Record<string, unknown>>('habits', 'h1')
  assert.equal(got?.name, 'Remote')
  assert.equal((await local.getDirty('habits')).length, 0, 'applied rows are clean')
  close()
})

test('applyRemote: newer remote overwrites non-dirty local', async () => {
  const { local, close } = await freshLocal()
  await local.applyRemote('habits', [makeHabit('h1', { name: 'old', updated_at: OLDER })])
  await local.applyRemote('habits', [makeHabit('h1', { name: 'new', updated_at: NEWER })])
  const got = await local.getById<Record<string, unknown>>('habits', 'h1')
  assert.equal(got?.name, 'new')
  close()
})

test('applyRemote: older remote does NOT overwrite newer local (LWW)', async () => {
  const { local, close } = await freshLocal()
  await local.applyRemote('habits', [makeHabit('h1', { name: 'newer', updated_at: NEWER })])
  await local.applyRemote('habits', [makeHabit('h1', { name: 'older', updated_at: OLDER })])
  const got = await local.getById<Record<string, unknown>>('habits', 'h1')
  assert.equal(got?.name, 'newer', 'stale remote is ignored')
  close()
})

test('applyRemote never clobbers a locally-dirty row', async () => {
  const { local, close } = await freshLocal()
  await local.writeLocal('habits', makeHabit('h1', { name: 'local-edit' })) // dirty
  // Even a far-future remote must not overwrite unpushed local work.
  await local.applyRemote('habits', [
    makeHabit('h1', { name: 'remote', updated_at: '2099-01-01T00:00:00.000Z' }),
  ])
  const got = await local.getById<Record<string, unknown>>('habits', 'h1')
  assert.equal(got?.name, 'local-edit')
  assert.equal((await local.getDirty('habits')).length, 1, 'still dirty, awaiting push')
  close()
})

test('clearDirty only clears rows whose updated_at is unchanged', async () => {
  const { local, close } = await freshLocal()
  await local.writeLocal('habits', makeHabit('h1'))
  const [row] = await local.getDirty<Record<string, unknown>>('habits')

  await local.clearDirty('habits', [{ id: 'h1', updated_at: 'stale-value' }])
  assert.equal((await local.getDirty('habits')).length, 1, 'guard blocks stale clear')

  await local.clearDirty('habits', [{ id: 'h1', updated_at: row.updated_at as string }])
  assert.equal((await local.getDirty('habits')).length, 0, 'matching clear succeeds')
  close()
})

// ---------------------------------------------------------------------------
// Offline repos
// ---------------------------------------------------------------------------

test('toggleHabit on/off/on keeps exactly one active log', async () => {
  const { local, close } = await freshLocal()
  const habit = await habitsRepo.createHabit(local, { name: 'Run' })

  assert.equal(await logsRepo.toggleHabit(local, habit.id), true)
  assert.equal((await logsRepo.getToday(local)).completedCount, 1)

  assert.equal(await logsRepo.toggleHabit(local, habit.id), false)
  assert.equal(await logsRepo.getLog(local, habit.id), null)

  assert.equal(await logsRepo.toggleHabit(local, habit.id), true)
  const active = await local.list('habit_logs', 'habit_id = ? AND deleted_at IS NULL', [habit.id])
  assert.equal(active.length, 1, 'no duplicate active logs')
  close()
})

test('currentStreak counts consecutive days and breaks on a gap', async () => {
  const { local, close } = await freshLocal()
  const today = toLocalISODate()

  const run = await habitsRepo.createHabit(local, { name: 'Run' })
  for (const d of [0, 1, 2]) await logsRepo.completeHabit(local, run.id, addDays(today, -d))
  assert.equal(await statsRepo.currentStreak(local, run.id), 3)

  const read = await habitsRepo.createHabit(local, { name: 'Read' })
  await logsRepo.completeHabit(local, read.id, today)
  await logsRepo.completeHabit(local, read.id, addDays(today, -2)) // gap at -1
  assert.equal(await statsRepo.currentStreak(local, read.id), 1)
  close()
})

test('offline useStreakFreeze decrements balance and writes a frozen log', async () => {
  const { local, close } = await freshLocal()
  await local.writeLocal('profiles', {
    id: USER,
    display_name: '',
    avatar_emoji: '🙂',
    theme: 'system',
    week_start: 0,
    timezone: 'UTC',
    streak_freeze_balance: 2,
    created_at: '2026-01-01T00:00:00.000Z',
  })
  const habit = await habitsRepo.createHabit(local, { name: 'Run' })

  const remaining = await freezeRepo.useStreakFreeze(local, habit.id)
  assert.equal(remaining, 1)
  assert.equal((await logsRepo.getLog(local, habit.id))?.status, 'frozen')
  const profile = await local.getById<{ streak_freeze_balance: number }>('profiles', USER)
  assert.equal(profile?.streak_freeze_balance, 1)
  close()
})

// ---------------------------------------------------------------------------
// SyncEngine — end to end against the mock server
// ---------------------------------------------------------------------------

test('push: a locally-created habit reaches the server and goes clean', async () => {
  const { local, close } = await freshLocal()
  const srv = new MockSupabase()
  const engine = new SyncEngine(local, srv as unknown as DB)

  const habit = await habitsRepo.createHabit(local, { name: 'Run' })
  const report = await engine.syncOnce()
  assert.ok(report)

  const serverRows = srv.rows('habits')
  assert.equal(serverRows.length, 1)
  assert.equal(serverRows[0].id, habit.id)
  assert.equal((await local.getDirty('habits')).length, 0, 'dirty flag cleared')

  const localHabit = await local.getById<Record<string, unknown>>('habits', habit.id)
  assert.equal(
    localHabit?.updated_at,
    serverRows[0].updated_at,
    'local adopts the server-authoritative timestamp',
  )
  close()
})

test('pull: a remote row appears locally after sync', async () => {
  const { local, close } = await freshLocal()
  const srv = new MockSupabase()
  srv.seed('habits', makeHabit('remote-1', { name: 'FromServer' }))
  const engine = new SyncEngine(local, srv as unknown as DB)

  await engine.syncOnce()
  const got = await habitsRepo.getHabit(local, 'remote-1')
  assert.equal(got?.name, 'FromServer')
  close()
})

test('tombstone delete propagates to the server', async () => {
  const { local, close } = await freshLocal()
  const srv = new MockSupabase()
  const engine = new SyncEngine(local, srv as unknown as DB)

  const habit = await habitsRepo.createHabit(local, { name: 'Run' })
  await engine.syncOnce()
  await habitsRepo.deleteHabit(local, habit.id)
  await engine.syncOnce()

  const serverRow = srv.rows('habits').find((r) => r.id === habit.id)
  assert.ok(serverRow?.deleted_at, 'server row is tombstoned')
  assert.equal((await habitsRepo.listHabits(local)).length, 0)
  close()
})

test('a no-op sync pushes and pulls nothing', async () => {
  const { local, close } = await freshLocal()
  const srv = new MockSupabase()
  const engine = new SyncEngine(local, srv as unknown as DB)

  await habitsRepo.createHabit(local, { name: 'Run' })
  await engine.syncOnce() // first sync moves the row both ways

  const report = await engine.syncOnce()
  assert.ok(report)
  const pushed = Object.values(report.pushed).reduce((a, b) => a + b, 0)
  const pulled = Object.values(report.pulled).reduce((a, b) => a + b, 0)
  assert.equal(pushed, 0)
  assert.equal(pulled, 0)
  close()
})

test('syncOnce short-circuits when offline', async () => {
  const { local, close } = await freshLocal()
  const srv = new MockSupabase()
  const engine = new SyncEngine(local, srv as unknown as DB, { isOnline: () => false })
  await habitsRepo.createHabit(local, { name: 'Run' })

  assert.equal(await engine.syncOnce(), null, 'no cycle runs')
  assert.equal(srv.rows('habits').length, 0, 'nothing pushed')
  close()
})
