// Tests for the offline repositories (src/local/repo-*) against a real
// node:sqlite database — exercises the actual SQL, defaults, soft-delete
// filtering, and the local stat computations.
//
//   npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { LocalDB } from './db'
import * as habitsRepo from './repo-habits'
import * as logsRepo from './repo-logs'
import * as statsRepo from './repo-stats'
import * as remindersRepo from './repo-reminders'
import * as profileRepo from './repo-profile'
import * as freezesRepo from './repo-freezes'
import { createNodeSqliteAdapter } from '../sync/testing/node-sqlite-adapter'
import { addDays, toLocalISODate } from '../data/helpers'

const USER = 'user-1'

async function freshLocal() {
  const { adapter, close } = createNodeSqliteAdapter()
  const local = new LocalDB(adapter)
  await local.init()
  await local.setUserId(USER)
  return { local, close }
}

async function seedProfile(local: LocalDB, balance = 2) {
  await local.writeLocal('profiles', {
    id: USER,
    display_name: 'Demo',
    avatar_emoji: '🙂',
    theme: 'system',
    week_start: 0,
    timezone: 'UTC',
    streak_freeze_balance: balance,
    created_at: '2026-01-01T00:00:00Z',
  })
}

// ---- habits ----

test('createHabit applies defaults; listHabits returns active habits', async () => {
  const { local, close } = await freshLocal()
  const h = await habitsRepo.createHabit(local, { name: 'Run' })
  assert.equal(h.user_id, USER)
  assert.equal(h.type, 'binary')
  assert.equal(h.freq_type, 'daily')
  assert.equal((await habitsRepo.listHabits(local)).length, 1)
  close()
})

test('updateHabit patches fields', async () => {
  const { local, close } = await freshLocal()
  const h = await habitsRepo.createHabit(local, { name: 'Run' })
  const upd = await habitsRepo.updateHabit(local, h.id, { name: 'Sprint', color: '#000000' })
  assert.equal(upd.name, 'Sprint')
  assert.equal(upd.color, '#000000')
  close()
})

test('archiveHabit hides from listHabits but not listAllHabits', async () => {
  const { local, close } = await freshLocal()
  const h = await habitsRepo.createHabit(local, { name: 'Run' })
  await habitsRepo.archiveHabit(local, h.id)
  assert.equal((await habitsRepo.listHabits(local)).length, 0)
  assert.equal((await habitsRepo.listAllHabits(local)).length, 1)
  close()
})

test('reorderHabits assigns sort_order by position', async () => {
  const { local, close } = await freshLocal()
  const a = await habitsRepo.createHabit(local, { name: 'A' })
  const b = await habitsRepo.createHabit(local, { name: 'B' })
  await habitsRepo.reorderHabits(local, [b.id, a.id])
  const list = await habitsRepo.listHabits(local)
  assert.deepEqual(list.map((h) => h.name), ['B', 'A'])
  close()
})

test('deleteHabit soft-deletes (hidden from reads)', async () => {
  const { local, close } = await freshLocal()
  const h = await habitsRepo.createHabit(local, { name: 'Run' })
  await habitsRepo.deleteHabit(local, h.id)
  assert.equal(await habitsRepo.getHabit(local, h.id), null)
  close()
})

// ---- logs ----

test('setNote and setValue attach to the day’s log', async () => {
  const { local, close } = await freshLocal()
  const h = await habitsRepo.createHabit(local, { name: 'Water', type: 'quantity', target: 8, unit: 'x' })
  await logsRepo.setValue(local, h.id, 6)
  await logsRepo.setNote(local, h.id, 'felt good')
  const log = await logsRepo.getLog(local, h.id)
  assert.equal(log?.value, 6)
  assert.equal(log?.note, 'felt good')
  close()
})

test('getWeek returns 7 days with exactly one marked today', async () => {
  const { local, close } = await freshLocal()
  const h = await habitsRepo.createHabit(local, { name: 'Run' })
  await logsRepo.completeHabit(local, h.id)
  const week = await logsRepo.getWeek(local, h.id)
  assert.equal(week.length, 7)
  assert.equal(week.filter((d) => d.isToday).length, 1)
  assert.equal(week.find((d) => d.isToday)?.done, true)
  close()
})

// ---- stats ----

test('longestStreak and currentStreak over a run with a gap', async () => {
  const { local, close } = await freshLocal()
  const today = toLocalISODate()
  const h = await habitsRepo.createHabit(local, { name: 'Read' })
  for (const d of [0, 1, 2]) await logsRepo.completeHabit(local, h.id, addDays(today, -d))
  await logsRepo.completeHabit(local, h.id, addDays(today, -4)) // gap at -3
  assert.equal(await statsRepo.currentStreak(local, h.id), 3)
  assert.equal(await statsRepo.longestStreak(local, h.id), 3)
  close()
})

test('completionRate is completed/expected over the window', async () => {
  const { local, close } = await freshLocal()
  const today = toLocalISODate()
  const h = await habitsRepo.createHabit(local, { name: 'Run' }) // daily
  for (const d of [0, 1, 2]) await logsRepo.completeHabit(local, h.id, addDays(today, -d))
  // 3 completed over a 7-day window -> round(3/7*100) = 43
  assert.equal(await statsRepo.completionRate(local, h.id, addDays(today, -6), today), 43)
  close()
})

test('heatmap groups completed logs by date', async () => {
  const { local, close } = await freshLocal()
  const today = toLocalISODate()
  const h = await habitsRepo.createHabit(local, { name: 'Run' })
  await logsRepo.completeHabit(local, h.id, today)
  await logsRepo.completeHabit(local, h.id, addDays(today, -1))
  const cells = await statsRepo.heatmap(local, addDays(today, -6), today)
  assert.equal(cells.length, 2)
  assert.ok(cells.every((c) => c.completions === 1))
  close()
})

test('getAllStats and getOverallCompletion aggregate per habit', async () => {
  const { local, close } = await freshLocal()
  const today = toLocalISODate()
  const h = await habitsRepo.createHabit(local, { name: 'Run' })
  await logsRepo.completeHabit(local, h.id, today)
  const all = await statsRepo.getAllStats(local)
  assert.equal(all.length, 1)
  assert.equal(all[0].current_streak, 1)
  assert.equal(all[0].total_completions, 1)
  assert.equal(typeof (await statsRepo.getOverallCompletion(local)), 'number')
  close()
})

// ---- reminders ----

test('reminders CRUD and enable toggle', async () => {
  const { local, close } = await freshLocal()
  const h = await habitsRepo.createHabit(local, { name: 'Run' })
  const r = await remindersRepo.createReminder(local, {
    habit_id: h.id,
    time_of_day: '07:00:00',
    days_of_week: [1, 2, 3, 4, 5],
    enabled: true,
  })
  assert.equal((await remindersRepo.listReminders(local)).length, 1)
  await remindersRepo.setReminderEnabled(local, r.id, false)
  assert.equal((await remindersRepo.listReminders(local, h.id))[0].enabled, false)
  await remindersRepo.deleteReminder(local, r.id)
  assert.equal((await remindersRepo.listReminders(local)).length, 0)
  close()
})

// ---- profile & freezes ----

test('updateProfile persists changes', async () => {
  const { local, close } = await freshLocal()
  await seedProfile(local)
  const p = await profileRepo.updateProfile(local, { theme: 'dark' })
  assert.equal(p.theme, 'dark')
  close()
})

test('useStreakFreeze decrements balance and writes a frozen log', async () => {
  const { local, close } = await freshLocal()
  await seedProfile(local, 2)
  const h = await habitsRepo.createHabit(local, { name: 'Run' })
  const remaining = await freezesRepo.useStreakFreeze(local, h.id)
  assert.equal(remaining, 1)
  assert.equal((await logsRepo.getLog(local, h.id))?.status, 'frozen')
  const p = await profileRepo.getProfile(local)
  assert.equal(p?.streak_freeze_balance, 1)
  close()
})

test('useStreakFreeze rejects when no freezes remain', async () => {
  const { local, close } = await freshLocal()
  await seedProfile(local, 0)
  const h = await habitsRepo.createHabit(local, { name: 'Run' })
  await assert.rejects(() => freezesRepo.useStreakFreeze(local, h.id), /no streak freezes/)
  close()
})
