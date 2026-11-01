import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** False until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set — the app shows a setup screen instead of crashing. */
export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key', {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

// Sign-in only needs the basic profile. Directory access is granted separately, once per
// company, through the admin-consent flow handled by /api/microsoft/connect.
export const MS_LOGIN_SCOPES = 'openid profile email offline_access User.Read'

export async function uploadAsset(orgId: string, file: Blob, name: string) {
  const ext = { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/gif': 'gif', 'image/webp': 'webp' }[file.type] ?? 'jpg'
  const path = `${orgId}/${name}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  const { error } = await supabase.storage.from('assets').upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  return supabase.storage.from('assets').getPublicUrl(path).data.publicUrl
}
