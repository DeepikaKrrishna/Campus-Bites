import { supabase, isSupabaseConfigured } from './supabase'

export type AppUser = {
  id: string
  name: string
  email: string
}

const STORAGE_KEY = 'cb_user'

// ---- Demo auth (no backend) ----
function demoLogin(email: string, password: string, name?: string): AppUser {
  if (password.toLowerCase() === 'wrong') throw new Error('Invalid credentials')
  if (password.length < 6) throw new Error('Password must be at least 6 characters')
  const user: AppUser = {
    id: 'demo-' + Date.now(),
    name: name || email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    email,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  return user
}

// ---- Supabase auth ----
export async function signUp(email: string, password: string, name: string): Promise<AppUser> {
  if (!isSupabaseConfigured) return demoLogin(email, password, name)

  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Sign-up failed')

  const user: AppUser = { id: data.user.id, name, email }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  return user
}

export async function signIn(email: string, password: string): Promise<AppUser> {
  if (!isSupabaseConfigured) return demoLogin(email, password)

  const { data, error } = await supabase!.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)

  const user: AppUser = {
    id: data.user.id,
    name: data.user.user_metadata?.name ?? email.split('@')[0],
    email,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  return user
}

export async function signInWithGoogle(): Promise<AppUser> {
  if (!isSupabaseConfigured) {
    return demoLogin('deepika@gmail.com', 'google123', 'Deepika K')
  }

  const { error } = await supabase!.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw new Error(error.message)

  // OAuth redirects, so we won't reach here immediately.
  // The user will be picked up by getStoredUser() on reload.
  return { id: '', name: '', email: '' }
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('cb_cart')
  localStorage.removeItem('cb_orders')
  if (isSupabaseConfigured) await supabase!.auth.signOut()
}

export function getStoredUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// On app start, sync with Supabase session if configured
export async function restoreSession(): Promise<AppUser | null> {
  if (!isSupabaseConfigured) return getStoredUser()

  const { data } = await supabase!.auth.getSession()
  if (data.session?.user) {
    const u = data.session.user
    const user: AppUser = {
      id: u.id,
      name: u.user_metadata?.name ?? u.email?.split('@')[0] ?? 'Student',
      email: u.email ?? '',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    return user
  }
  return getStoredUser()
}
