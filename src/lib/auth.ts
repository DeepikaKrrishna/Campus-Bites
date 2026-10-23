import { supabase, isSupabaseConfigured } from './supabase'

export type AppUser = {
  id: string
  name: string
  email: string
  phone?: string
  rollNo?: string
  roomNo?: string
}

const STORAGE_KEY = 'cb_user'

function demoLogin(email: string, password: string, name?: string): AppUser {
  if (password.toLowerCase() === 'wrong') throw new Error('Invalid credentials')
  if (password.length < 6) throw new Error('Password must be at least 6 characters')

  const parsedName =
    name ||
    email
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())

  const user: AppUser = {
    id: 'demo-' + Date.now(),
    name: parsedName,
    email,
    phone: '+91 98765 43210',
    rollNo: '24CB' + Math.floor(1000 + Math.random() * 9000),
    roomNo: 'Block B - 204',
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  return user
}

export async function signUp(email: string, password: string, name: string): Promise<AppUser> {
  if (!isSupabaseConfigured || !supabase) return demoLogin(email, password, name)

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Sign-up failed')

  const user: AppUser = {
    id: data.user.id,
    name,
    email,
    phone: '+91 98765 43210',
    rollNo: '24CB' + Math.floor(1000 + Math.random() * 9000),
    roomNo: 'Hostel 3 - Room 102',
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  return user
}

export async function signIn(email: string, password: string): Promise<AppUser> {
  if (!isSupabaseConfigured || !supabase) return demoLogin(email, password)

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)

  const user: AppUser = {
    id: data.user.id,
    name: data.user.user_metadata?.name ?? email.split('@')[0],
    email,
    phone: data.user.user_metadata?.phone ?? '+91 98765 43210',
    rollNo: data.user.user_metadata?.rollNo ?? '24CB' + Math.floor(1000 + Math.random() * 9000),
    roomNo: data.user.user_metadata?.roomNo ?? 'Hostel 3 - Room 102',
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  return user
}

export async function signInWithGoogle(): Promise<AppUser> {
  if (!isSupabaseConfigured || !supabase) {
    return demoLogin('deepika@gmail.com', 'google123', 'Deepika K')
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw new Error(error.message)

  return { id: '', name: '', email: '' }
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('cb_cart')
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('Sign out error', e)
    }
  }
}

export function getStoredUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveStoredUser(user: AppUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export async function restoreSession(): Promise<AppUser | null> {
  if (!isSupabaseConfigured || !supabase) return getStoredUser()

  try {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) {
      const u = data.session.user
      const local = getStoredUser()
      const user: AppUser = {
        id: u.id,
        name: u.user_metadata?.name ?? local?.name ?? u.email?.split('@')[0] ?? 'Student',
        email: u.email ?? '',
        phone: u.user_metadata?.phone ?? local?.phone ?? '+91 98765 43210',
        rollNo: u.user_metadata?.rollNo ?? local?.rollNo ?? '24CB7821',
        roomNo: u.user_metadata?.roomNo ?? local?.roomNo ?? 'Hostel 3 - Room 102',
      }
      saveStoredUser(user)
      return user
    }
  } catch (err) {
    console.warn('Failed restoring Supabase session:', err)
  }
  return getStoredUser()
}
