// Tests for the cloud data-access layer (src/data/*) against an in-memory mock
// Supabase client. Verifies table selection, filters, unwrap null-handling, and
// the revive-vs-insert / merge logic that isn't just a thin wrapper.
//
//   npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { MockDb } from './testing/mock-db'
import type { DB } from './client'
import * as habits from './habits'
import * as logs from './logs'
import * as profileRepo from './profile'
import * as reminders from './reminders'
import * as stats from './stats'
import { useStreakFreeze } from './freezes'
import { toLocalISODate } from './helpers'

const USER = 'user-1'
const asDB = (m: MockDb) => m as unknown as DB

function habitRow(id: string, over: Record<string, unknown> = {}) {
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
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...over,
  }
}

// ---- habits ----

test('listHabits excludes deleted + archived and orders by sort_order', async () => {
  const db = new MockDb().seed('habits', [
    habitRow('a', { sort_order: 2 }),
    habitRow('b', { sort_order: 1 }),
    habitRow('c', { deleted_at: '2026-01-02T00:00:00Z' }),
    habitRow('d', { archived_at: '2026-01-02T00:00:00Z' }),
  ])
  const list = await habits.listHabits(asDB(db))
  assert.deepEqual(
    list.map((h) => h.id),
    ['b', 'a'],
  )
})

test('getHabit returns null when not found (maybeSingle)', async () => {
  const db = new MockDb().seed('habits', [])
  assert.equal(await habits.getHabit(asDB(db), 'nope'), null)
})

test('createHabit stamps user_id and returns the row', async () => {
  const db = new MockDb().seed('habits', [])
  const h = await habits.createHabit(asDB(db), { name: 'Run' })
  assert.equal(h.user_id, USER)
  assert.equal(h.name, 'Run')
  assert.equal(db.rowsOf('habits').length, 1)
})

test('deleteHabit soft-deletes (sets deleted_at, keeps the row)', async () => {
  const db = new MockDb().seed('habits', [habitRow('a')])
  await habits.deleteHabit(asDB(db), 'a')
  const row = db.rowsOf('habits')[0]
  assert.ok(row.deleted_at)
})

// ---- logs ----

test('completeHabit inserts when absent, updates the same row when present', async () => {
  const db = new MockDb().seed('habit_logs', [])
  const date = '2026-07-01'
  await logs.completeHabit(asDB(db), 'h1', date)
  assert.equal(db.rowsOf('habit_logs').length, 1)
  await logs.completeHabit(asDB(db), 'h1', date, { note: 'again' })
  assert.equal(db.rowsOf('habit_logs').length, 1, 'no duplicate active log')
  assert.equal(db.rowsOf('habit_logs')[0].note, 'again')
})

test('toggleHabit flips completion and returns the new state', async () => {
  const db = new MockDb().seed('habit_logs', [])
  assert.equal(await logs.toggleHabit(asDB(db), 'h1', '2026-07-01'), true)
  assert.equal(await logs.toggleHabit(asDB(db), 'h1', '2026-07-01'), false)
  // off = soft-deleted, so no active log remains
  assert.equal(await logs.getLog(asDB(db), 'h1', '2026-07-01'), null)
})

test('getToday merges habits with the day’s logs and counts completion', async () => {
  const date = toLocalISODate()
  const db = new MockDb()
    .seed('habits', [habitRow('h1', { sort_order: 0 }), habitRow('h2', { sort_order: 1 })])
    .seed('habit_logs', [
      { id: 'l1', user_id: USER, habit_id: 'h1', log_date: date, status: 'completed', value: null, note: null, deleted_at: null },
    ])
  const today = await logs.getToday(asDB(db), date)
  assert.equal(today.totalCount, 2)
  assert.equal(today.completedCount, 1)
  assert.equal(today.pct, 50)
  assert.equal(today.habits.find((h) => h.habit.id === 'h1')?.done, true)
})

// ---- profile ----

test('updateProfile patches the caller’s profile row', async () => {
  const db = new MockDb().seed('profiles', [{ id: USER, theme: 'system', display_name: 'Demo' }])
  const p = await profileRepo.updateProfile(asDB(db), { theme: 'dark' })
  assert.equal(p.theme, 'dark')
})

test('deleteAccount calls the delete_account RPC', async () => {
  let called = false
  const db = new MockDb().onRpc('delete_account', () => {
    called = true
    return { data: null, error: null }
  })
  await profileRepo.deleteAccount(asDB(db))
  assert.equal(called, true)
})

// ---- reminders ----

test('reminders CRUD: create, list active, delete (soft)', async () => {
  const db = new MockDb().seed('reminders', [])
  const r = await reminders.createReminder(asDB(db), {
    habit_id: 'h1',
    time_of_day: '07:00:00',
    days_of_week: [1, 2, 3],
    enabled: true,
  })
  assert.equal((await reminders.listReminders(asDB(db))).length, 1)
  await reminders.deleteReminder(asDB(db), r.id)
  assert.equal((await reminders.listReminders(asDB(db))).length, 0, 'soft-deleted, filtered out')
})

// ---- stats / rpc ----

test('getAllStats reads the habit_stats view', async () => {
  const db = new MockDb().seed('habit_stats', [
    { habit_id: 'h1', user_id: USER, name: 'Run', icon: '🏃', color: '#c67139', current_streak: 3, longest_streak: 5, rate_90d: 80, total_completions: 40 },
  ])
  const all = await stats.getAllStats(asDB(db))
  assert.equal(all.length, 1)
  assert.equal(all[0].current_streak, 3)
})

test('getCurrentStreak / getOverallCompletion go through RPC + view', async () => {
  const db = new MockDb()
    .onRpc('current_streak', () => ({ data: 7, error: null }))
    .seed('habit_stats', [
      { habit_id: 'h1', rate_90d: 60 },
      { habit_id: 'h2', rate_90d: 80 },
    ])
  assert.equal(await stats.getCurrentStreak(asDB(db), 'h1'), 7)
  assert.equal(await stats.getOverallCompletion(asDB(db)), 70)
})

test('useStreakFreeze returns the remaining balance from RPC', async () => {
  const db = new MockDb().onRpc('use_streak_freeze', () => ({ data: 1, error: null }))
  assert.equal(await useStreakFreeze(asDB(db), 'h1'), 1)
})

test('an RPC error is thrown, not swallowed', async () => {
  const db = new MockDb().onRpc('use_streak_freeze', () => ({
    data: null,
    error: { message: 'no streak freezes available' },
  }))
  await assert.rejects(
    () => useStreakFreeze(asDB(db), 'h1'),
    (e: unknown) => (e as { message: string }).message.includes('no streak freezes'),
  )
})
