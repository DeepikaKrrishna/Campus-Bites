import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL  ?? ''
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// When no env vars are set, the app runs in offline/demo mode.
export const isSupabaseConfigured = !!(url && key && !url.includes('YOUR_PROJECT'))

export const supabase = isSupabaseConfigured
  ? createClient(url, key)
  : null  // null = demo mode, everything stays in localStorage

// Helper to check if we have a live backend
export function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
  return supabase
}
