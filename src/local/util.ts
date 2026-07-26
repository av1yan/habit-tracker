// Small platform utilities for the local layer.

/** ISO timestamp (UTC) — used for local updated_at / deleted_at stamps. */
export function nowISO(): string {
  return new Date().toISOString()
}

/** UUID v4. Prefers platform crypto; falls back to a Math.random generator. */
export function newId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } }
  if (g.crypto?.randomUUID) return g.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
