// In-memory stand-in for the Supabase client, implementing enough of the
// PostgREST query-builder surface for the DAL tests: from().select/insert/
// update/upsert/delete with eq/is/gt/gte/lt/lte/order/limit/single/maybeSingle
// (thenable, like the real builder), plus rpc() and auth.getUser().

type Row = Record<string, unknown>
interface Result {
  data: unknown
  error: { message: string; code?: string } | null
}
type FilterOp = 'eq' | 'is' | 'gt' | 'gte' | 'lt' | 'lte'
type RpcHandler = (args: Record<string, unknown>, db: MockDb) => Result

const uuid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(16).slice(2)}`)

export class MockDb {
  readonly tables = new Map<string, Row[]>()
  user: { id: string } | null = { id: 'user-1' }
  private readonly rpcHandlers: Record<string, RpcHandler> = {}

  seed(table: string, rows: Row[]): this {
    this.tables.set(table, rows.map((r) => ({ ...r })))
    return this
  }
  rowsOf(table: string): Row[] {
    let t = this.tables.get(table)
    if (!t) {
      t = []
      this.tables.set(table, t)
    }
    return t
  }
  onRpc(name: string, fn: RpcHandler): this {
    this.rpcHandlers[name] = fn
    return this
  }

  from(table: string): MockQuery {
    return new MockQuery(this, table)
  }
  rpc(name: string, args: Record<string, unknown> = {}): Promise<Result> {
    const h = this.rpcHandlers[name]
    return Promise.resolve(h ? h(args, this) : { data: null, error: null })
  }
  readonly auth = {
    getUser: async () => ({ data: { user: this.user }, error: null }),
  }
}

class MockQuery {
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: Row | Row[] = {}
  private readonly filters: [string, FilterOp, unknown][] = []
  private orderBy?: [string, boolean]
  private limitN?: number
  private card: 'many' | 'single' | 'maybe' = 'many'
  private returning = false

  constructor(
    private readonly db: MockDb,
    private readonly table: string,
  ) {}

  select(_cols?: string): this {
    this.returning = true
    return this
  }
  insert(payload: Row | Row[]): this {
    this.op = 'insert'
    this.payload = payload
    return this
  }
  update(patch: Row): this {
    this.op = 'update'
    this.payload = patch
    return this
  }
  upsert(payload: Row | Row[]): this {
    this.op = 'upsert'
    this.payload = payload
    return this
  }
  delete(): this {
    this.op = 'delete'
    return this
  }
  eq(c: string, v: unknown): this {
    this.filters.push([c, 'eq', v])
    return this
  }
  is(c: string, v: unknown): this {
    this.filters.push([c, 'is', v])
    return this
  }
  gt(c: string, v: unknown): this {
    this.filters.push([c, 'gt', v])
    return this
  }
  gte(c: string, v: unknown): this {
    this.filters.push([c, 'gte', v])
    return this
  }
  lt(c: string, v: unknown): this {
    this.filters.push([c, 'lt', v])
    return this
  }
  lte(c: string, v: unknown): this {
    this.filters.push([c, 'lte', v])
    return this
  }
  order(c: string, o: { ascending: boolean }): this {
    this.orderBy = [c, o.ascending]
    return this
  }
  limit(n: number): this {
    this.limitN = n
    return this
  }
  single(): this {
    this.card = 'single'
    return this
  }
  maybeSingle(): this {
    this.card = 'maybe'
    return this
  }

  // Thenable: awaiting the builder runs the query.
  then(resolve: (r: Result) => void, reject: (e: unknown) => void): void {
    try {
      resolve(this.run())
    } catch (e) {
      reject(e)
    }
  }

  private match(row: Row): boolean {
    return this.filters.every(([c, op, v]) => {
      const x = row[c]
      switch (op) {
        case 'eq':
          return x === v
        case 'is':
          return v === null ? x === null || x === undefined : x === v
        case 'gt':
          return String(x) > String(v)
        case 'gte':
          return String(x) >= String(v)
        case 'lt':
          return String(x) < String(v)
        case 'lte':
          return String(x) <= String(v)
      }
    })
  }

  private run(): Result {
    const store = this.db.rowsOf(this.table)
    let result: Row[] = []

    if (this.op === 'select') {
      result = store.filter((r) => this.match(r))
      if (this.orderBy) {
        const [c, asc] = this.orderBy
        result = [...result].sort((a, b) => {
          const av = a[c] as never
          const bv = b[c] as never
          return (av < bv ? -1 : av > bv ? 1 : 0) * (asc ? 1 : -1)
        })
      }
      if (this.limitN != null) result = result.slice(0, this.limitN)
    } else if (this.op === 'insert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload]
      const inserted = rows.map((r) => ({ id: r.id ?? uuid(), ...r }))
      store.push(...inserted.map((r) => ({ ...r })))
      result = inserted
    } else if (this.op === 'update') {
      result = store.filter((r) => this.match(r))
      for (const r of result) Object.assign(r, this.payload)
    } else if (this.op === 'upsert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload]
      for (const r of rows) {
        const i = store.findIndex((x) => x.id === r.id)
        if (i >= 0) Object.assign(store[i], r)
        else store.push({ ...r })
      }
      result = rows
    } else if (this.op === 'delete') {
      result = store.filter((r) => this.match(r))
      this.db.tables.set(
        this.table,
        store.filter((r) => !this.match(r)),
      )
    }

    if (!this.returning && this.op !== 'select') return { data: null, error: null }
    if (this.card === 'single') {
      if (result.length !== 1) return { data: null, error: { message: 'Expected one row', code: 'PGRST116' } }
      return { data: result[0], error: null }
    }
    if (this.card === 'maybe') return { data: result[0] ?? null, error: null }
    return { data: result, error: null }
  }
}
