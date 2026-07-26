// Offline profile repo — mirrors src/data/profile.ts.

import type { LocalDB } from './db'
import type { Profile } from '../../supabase/types/database.types'
import type { UpdateProfilePatch } from '../data/profile'

export async function getProfile(local: LocalDB): Promise<Profile | null> {
  const id = await local.getUserId()
  return local.getById<Profile>('profiles', id)
}

export async function updateProfile(
  local: LocalDB,
  patch: UpdateProfilePatch,
): Promise<Profile> {
  const id = await local.getUserId()
  await local.writeLocal('profiles', { id, ...patch })
  const row = await local.getById<Profile>('profiles', id)
  if (!row) throw new Error('profile not found')
  return row
}
