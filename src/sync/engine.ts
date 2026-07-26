// SyncEngine — moves rows between the local SQLite mirror and Supabase.
//
// Each cycle is PUSH then PULL:
//   push  — send every dirty local row (server owns created_at/updated_at),
//           then clear the dirty flag for rows whose updated_at still matches.
//   pull  — for each table, fetch rows with updated_at > cursor (tombstones
//           included), apply last-write-wins into SQLite, advance the cursor.
//
// Push-before-pull means that by the time we pull there are (normally) no dirty
// rows, so the pull can freely overwrite with the server's authoritative copy.

import type { DB } from '../data/client'
import type { LocalDB } from '../local/db'
import { toRemotePayload } from '../local/serialize'
import { PUSH_ORDER, type TableName } from '../local/tables'

type Row = Record<string, unknown>

export interface SyncOptions {
  /** Gate a cycle on connectivity (e.g. NetInfo). Default: always online. */
  isOnline?: () => boolean | Promise<boolean>
  /** Called after each successful cycle. */
  onSync?: (report: SyncReport) => void
  /** Called when an individual table's push/pull fails (does not abort others). */
  onError?: (err: unknown, context?: { phase: 'push' | 'pull'; table: TableName }) => void
  /** Rows per push batch / pull page. */
  batchSize?: number
  /** Per-table operation timeout (ms). Guards against a hung request wedging
   *  the engine (a never-settling promise would leave `syncing` stuck true). */
  opTimeoutMs?: number
}

export interface SyncReport {
  pushed: Record<string, number>
  pulled: Record<string, number>
  startedAt: string
  finishedAt: string
}

export class SyncEngine {
  private syncing = false
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly batchSize: number
  private readonly opTimeoutMs: number

  constructor(
    private readonly local: LocalDB,
    private readonly supa: DB,
    private readonly opts: SyncOptions = {},
  ) {
    this.batchSize = opts.batchSize ?? 500
    this.opTimeoutMs = opts.opTimeoutMs ?? 15_000
  }

  /** Reject if `p` doesn't settle within opTimeoutMs, so a hung request can't
   *  leave the engine wedged (the caller's finally then resets `syncing`). */
  private withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`sync timeout after ${this.opTimeoutMs}ms: ${label}`)),
        this.opTimeoutMs,
      )
      p.then(
        (v) => {
          clearTimeout(timer)
          resolve(v)
        },
        (e) => {
          clearTimeout(timer)
          reject(e)
        },
      )
    })
  }

  /** Run one push+pull cycle. Safe to call concurrently — extra calls no-op. */
  async syncOnce(): Promise<SyncReport | null> {
    if (this.syncing) return null
    if (this.opts.isOnline && !(await this.opts.isOnline())) return null
    this.syncing = true
    const startedAt = new Date().toISOString()
    const report: SyncReport = { pushed: {}, pulled: {}, startedAt, finishedAt: '' }
    try {
      // Each table is pushed/pulled independently: a failure on one is reported
      // but must not abort the others or leave the engine wedged.
      for (const table of PUSH_ORDER) {
        try {
          report.pushed[table] = await this.withTimeout(this.pushTable(table), `push ${table}`)
        } catch (err) {
          this.opts.onError?.(err, { phase: 'push', table })
        }
      }
      for (const table of PUSH_ORDER) {
        try {
          report.pulled[table] = await this.withTimeout(this.pullTable(table), `pull ${table}`)
        } catch (err) {
          this.opts.onError?.(err, { phase: 'pull', table })
        }
      }
      report.finishedAt = new Date().toISOString()
      this.opts.onSync?.(report)
      return report
    } finally {
      this.syncing = false
    }
  }

  // -- push -------------------------------------------------------------------

  private async pushTable(table: TableName): Promise<number> {
    const dirty = await this.local.getDirty<Row>(table)
    if (dirty.length === 0) return 0

    for (let i = 0; i < dirty.length; i += this.batchSize) {
      const chunk = dirty.slice(i, i + this.batchSize)
      const payload = chunk.map((r) => toRemotePayload(table, r))
      // Dynamic table name — cast around the generated-table generics.
      const { error } = await (this.supa.from(table) as any).upsert(payload, {
        onConflict: 'id',
      })
      if (error) throw error
      await this.local.clearDirty(
        table,
        chunk.map((r) => ({ id: r.id as string, updated_at: r.updated_at as string })),
      )
    }
    return dirty.length
  }

  // -- pull -------------------------------------------------------------------

  private async pullTable(table: TableName): Promise<number> {
    let cursor = await this.local.getCursor(table)
    let total = 0

    for (;;) {
      const { data, error } = await (this.supa.from(table) as any)
        .select('*')
        .gt('updated_at', cursor)
        .order('updated_at', { ascending: true })
        .limit(this.batchSize)
      if (error) throw error
      const rows = (data ?? []) as Row[]
      if (rows.length === 0) break

      await this.local.applyRemote(table, rows)
      cursor = String(rows[rows.length - 1].updated_at)
      await this.local.setCursor(table, cursor)
      total += rows.length

      if (rows.length < this.batchSize) break
    }
    return total
  }

  // -- scheduling -------------------------------------------------------------

  /** Sync now, then every `intervalMs`. Call once after login. */
  start(intervalMs = 30_000): void {
    this.stop()
    // Belt-and-suspenders: clear any stale in-flight flag so a previously
    // wedged state (e.g. a hung request that never settled) can't stop a fresh
    // start from syncing. The per-op timeout is the primary guard; this ensures
    // recovery even if that ever fails.
    this.syncing = false
    void this.syncOnce().catch(() => {})
    this.timer = setInterval(() => {
      void this.syncOnce().catch(() => {})
    }, intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * Subscribe to realtime changes and pull when the server signals one.
   * Returns an unsubscribe function. (Requires Realtime enabled on the tables.)
   */
  subscribeRealtime(): () => void {
    const channel = this.supa
      .channel('habit-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        void this.syncOnce().catch(() => {})
      })
      .subscribe()
    return () => {
      void this.supa.removeChannel(channel)
    }
  }
}
