import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// When no env vars are set, the app runs gracefully in offline/demo mode.
export const isSupabaseConfigured = Boolean(
  url &&
  key &&
  !url.includes('YOUR_PROJECT') &&
  url.startsWith('https://') &&
  url.includes('.supabase.co')
)

export const supabase = isSupabaseConfigured ? createClient(url, key) : null

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL in .env')
  }
  return supabase
}
