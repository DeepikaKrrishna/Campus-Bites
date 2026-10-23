import { createClient } from '@supabase/supabase-js'

const defaultUrl = 'https://knxtcyedsbhgwbpvthhy.supabase.co'
const defaultKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtueHRjeWVkc2JoZ3dicHZ0aGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0OTgwODQsImV4cCI6MjEwODA3NDA4NH0.8osxOT29NujHzkAAYvR2Ig3xosaGyVhvDTPMtYLPUJI'

const url = import.meta.env.VITE_SUPABASE_URL || defaultUrl
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || defaultKey

export const isSupabaseConfigured = Boolean(
  url &&
  key &&
  !url.includes('YOUR_PROJECT') &&
  url.startsWith('https://') &&
  url.includes('.supabase.co')
)

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }
  return supabase
}
