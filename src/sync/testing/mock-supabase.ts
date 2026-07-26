// Minimal in-memory stand-in for the Supabase client, implementing just the
// query surface the SyncEngine uses: from().upsert() and
// from().select().gt().order().limit(). Awaiting the terminal call resolves to
// a { data, error } result, like PostgREST.
//
// The server assigns a strictly-increasing, far-future updated_at on every
// write — modeling the DB trigger and making the server clock authoritative.

type Row = Record<string, unknown>

export class MockSupabase {
  private readonly data = new Map<string, Map<string, Row>>()
  private seq = 0

  private serverNow(): string {
    this.seq += 1
    return new Date(Date.UTC(2030, 0, 1) + this.seq).toISOString()
  }

  private store(table: string): Map<string, Row> {
    let m = this.data.get(table)
    if (!m) {
      m = new Map()
      this.data.set(table, m)
    }
    return m
  }

  /** Seed a row as if another device had written it. */
  seed(table: string, row: Row): void {
    this.store(table).set(String(row.id), {
      ...row,
      updated_at: row.updated_at ?? this.serverNow(),
    })
  }

  /** Current server rows for a table (test assertions). */
  rows(table: string): Row[] {
    return [...this.store(table).values()].map((r) => ({ ...r }))
  }

  from(table: string): MockQuery {
    return new MockQuery(this, table)
  }

  _upsert(table: string, payload: Row[]): { data: null; error: null } {
    const m = this.store(table)
    for (const r of payload) {
      const prev = m.get(String(r.id)) ?? {}
      m.set(String(r.id), {
        ...prev,
        ...r,
        created_at: (prev as Row).created_at ?? this.serverNow(),
        updated_at: this.serverNow(),
      })
    }
    return { data: null, error: null }
  }

  _select(
    table: string,
    q: { gt?: [string, string]; order?: [string, boolean]; limit?: number },
  ): { data: Row[]; error: null } {
    let rows = [...this.store(table).values()]
    if (q.gt) {
      const [col, val] = q.gt
      rows = rows.filter((r) => String(r[col]) > val)
    }
    if (q.order) {
      const [col, asc] = q.order
      rows = rows.sort((a, b) => {
        const av = String(a[col])
        const bv = String(b[col])
        return av < bv ? (asc ? -1 : 1) : av > bv ? (asc ? 1 : -1) : 0
      })
    }
    if (q.limit != null) rows = rows.slice(0, q.limit)
    return { data: rows.map((r) => ({ ...r })), error: null }
  }
}

class MockQuery {
  private op: 'select' | 'upsert' = 'select'
  private payload: Row[] = []
  private q: { gt?: [string, string]; order?: [string, boolean]; limit?: number } = {}

  constructor(
    private readonly srv: MockSupabase,
    private readonly table: string,
  ) {}

  upsert(payload: Row[], _opts?: unknown): Promise<{ data: null; error: null }> {
    this.op = 'upsert'
    this.payload = payload
    return Promise.resolve(this.srv._upsert(this.table, payload))
  }

  select(_cols: string): this {
    this.op = 'select'
    return this
  }

  gt(col: string, val: string): this {
    this.q.gt = [col, val]
    return this
  }

  order(col: string, opts: { ascending: boolean }): this {
    this.q.order = [col, opts.ascending]
    return this
  }

  limit(n: number): Promise<{ data: Row[]; error: null }> {
    this.q.limit = n
    return Promise.resolve(this.srv._select(this.table, this.q))
  }
}
