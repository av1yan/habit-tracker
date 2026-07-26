// Profile / settings. The row is auto-created on signup by a DB trigger, so
// reads should generally find one for an authenticated user.

import type { DB } from './client'
import { currentUserId, maybeOne, one } from './helpers'
import type { Profile, TablesUpdate } from '../../supabase/types/database.types'

export type UpdateProfilePatch = Pick<
  TablesUpdate<'profiles'>,
  'display_name' | 'avatar_emoji' | 'theme' | 'week_start' | 'timezone'
>

export async function getProfile(db: DB): Promise<Profile | null> {
  const id = await currentUserId(db)
  return maybeOne(await db.from('profiles').select('*').eq('id', id).maybeSingle())
}

export async function updateProfile(db: DB, patch: UpdateProfilePatch): Promise<Profile> {
  const id = await currentUserId(db)
  return one(
    await db.from('profiles').update(patch).eq('id', id).select('*').single(),
  )
}
