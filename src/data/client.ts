// Supabase client typed against our schema.
// The DAL functions take a `DB` instance as their first argument, so the same
// code runs in Expo/React Native, Node, or edge functions — you construct the
// client once (with the right storage adapter) and pass it in.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../supabase/types/database.types'

export type DB = SupabaseClient<Database>

export function createDbClient(
  url: string,
  anonKey: string,
  options?: Parameters<typeof createClient<Database>>[2],
): DB {
  return createClient<Database>(url, anonKey, options)
}
