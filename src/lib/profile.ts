import { supabase } from './supabase'

const avatarBucket = 'avatars'
const signedUrlLifetimeSeconds = 60 * 60

export type AccountProfile = {
  displayName: string | null
  avatarPath: string | null
  avatarUrl: string | null
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Account settings require a connected Supabase project.')
  }
  return supabase
}

async function createAvatarUrl(path: string | null) {
  if (!path) return null
  const client = requireSupabase()
  const { data, error } = await client.storage
    .from(avatarBucket)
    .createSignedUrl(path, signedUrlLifetimeSeconds)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function loadAccountProfile(userId: string): Promise<AccountProfile> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_profiles')
    .select('display_name, avatar_path')
    .eq('id', userId)
    .single()
  if (error) throw new Error(error.message)

  return {
    displayName: data.display_name,
    avatarPath: data.avatar_path,
    avatarUrl: await createAvatarUrl(data.avatar_path),
  }
}

export async function saveProfileDisplayName(userId: string, displayName: string): Promise<void> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('user_profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
    .select('id')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Your profile could not be updated.')
}

function avatarExtension(file: File) {
  switch (file.type) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      throw new Error('Choose a JPG, PNG, or WebP image.')
  }
}

export async function uploadProfileAvatar(
  userId: string,
  file: File,
  previousPath: string | null,
): Promise<AccountProfile> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 5 MB.')
  }

  const client = requireSupabase()
  const path = `${userId}/avatar.${avatarExtension(file)}`
  const { error: uploadError } = await client.storage
    .from(avatarBucket)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    })
  if (uploadError) throw new Error(uploadError.message)

  const { data, error: profileError } = await client
    .from('user_profiles')
    .update({ avatar_path: path })
    .eq('id', userId)
    .select('id')
    .maybeSingle()

  if (profileError || !data) {
    if (previousPath !== path) {
      const { error: cleanupError } = await client.storage.from(avatarBucket).remove([path])
      if (cleanupError) {
        throw new Error(
          `${profileError?.message ?? 'Your profile could not be updated.'} The uploaded image also could not be cleaned up: ${cleanupError.message}`,
        )
      }
    }
    throw new Error(profileError?.message ?? 'Your profile could not be updated.')
  }

  if (previousPath && previousPath !== path) {
    const { error: removeError } = await client.storage.from(avatarBucket).remove([previousPath])
    if (removeError) throw new Error(`Avatar updated, but the previous image could not be removed: ${removeError.message}`)
  }

  return loadAccountProfile(userId)
}

export async function removeProfileAvatar(userId: string, previousPath: string | null): Promise<void> {
  if (!previousPath) return
  const client = requireSupabase()
  const { data, error: profileError } = await client
    .from('user_profiles')
    .update({ avatar_path: null })
    .eq('id', userId)
    .select('id')
    .maybeSingle()
  if (profileError) throw new Error(profileError.message)
  if (!data) throw new Error('Your profile could not be updated.')

  const { error } = await client.storage.from(avatarBucket).remove([previousPath])
  if (error) throw new Error(`Avatar was removed from your profile, but its file could not be deleted: ${error.message}`)
}
