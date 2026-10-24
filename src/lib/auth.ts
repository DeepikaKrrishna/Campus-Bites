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

function demoLogin(email: string, password?: string, name?: string): AppUser {
  if (password && password.toLowerCase() === 'wrong') throw new Error('Invalid credentials')

  const parsedName =
    name ||
    email
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())

  const user: AppUser = {
    id: 'student-' + (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    name: parsedName || 'Deepika K',
    email: email || 'deepika.k@gmail.com',
    phone: '+91 98765 43210',
    rollNo: '24CB' + Math.floor(1000 + Math.random() * 9000),
    roomNo: 'Hostel 3 - Room 102',
  }
  saveStoredUser(user)
  return user
}

export async function signUp(email: string, password: string, name: string): Promise<AppUser> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      throw new Error(error.message)
    }

    if (data?.user) {
      // Supabase may require email confirmation — check identities
      // If identities array is empty, the user already exists (Supabase returns a fake user)
      if (data.user.identities && data.user.identities.length === 0) {
        throw new Error('An account with this email already exists. Please sign in instead.')
      }

      // If email confirmation is needed, session will be null
      if (!data.session) {
        throw new Error('Account created! Please check your email to confirm your account before signing in.')
      }

      const user: AppUser = {
        id: data.user.id,
        name,
        email,
        phone: '+91 98765 43210',
        rollNo: '24CB' + Math.floor(1000 + Math.random() * 9000),
        roomNo: 'Hostel 3 - Room 102',
      }
      saveStoredUser(user)
      return user
    }

    throw new Error('Sign-up failed. Please try again.')
  }

  return demoLogin(email, password, name)
}

export async function signIn(email: string, password: string): Promise<AppUser> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      throw new Error(error.message)
    }

    if (data?.user) {
      const u = data.user
      const user: AppUser = {
        id: u.id,
        name: u.user_metadata?.name ?? u.user_metadata?.full_name ?? email.split('@')[0],
        email,
        phone: u.user_metadata?.phone ?? '+91 98765 43210',
        rollNo: u.user_metadata?.rollNo ?? '24CB' + Math.floor(1000 + Math.random() * 9000),
        roomNo: u.user_metadata?.roomNo ?? 'Hostel 3 - Room 102',
      }
      saveStoredUser(user)
      return user
    }

    throw new Error('Sign-in failed. Please try again.')
  }

  return demoLogin(email, password)
}

export async function signInWithGoogle(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) {
      throw new Error(error.message)
    }
    // Browser will redirect to Google — no return value needed
    return
  }

  // Demo mode fallback — simulate a Google user
  const user = demoLogin('deepika.k@gmail.com', 'google123', 'Deepika K')
  // Store and let the caller handle it
  throw { __demoUser: user }
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
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

    // 1. Check for OAuth error in URL
    const oauthError =
      searchParams.get('error_description') ||
      hashParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error')

    if (oauthError) {
      console.error('Google OAuth redirect error:', oauthError)
      alert('Google Login Notice: ' + oauthError)
    }

    // 2. PKCE code exchange (Supabase Auth v2 default)
    const code = searchParams.get('code')
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.warn('exchangeCodeForSession warning:', error.message)
      } else if (data.session?.user) {
        const u = data.session.user
        const user: AppUser = {
          id: u.id,
          name:
            u.user_metadata?.full_name ??
            u.user_metadata?.name ??
            u.email?.split('@')[0] ??
            'Deepika K',
          email: u.email ?? '',
          phone: u.user_metadata?.phone ?? '+91 98765 43210',
          rollNo: u.user_metadata?.rollNo ?? '24CB7821',
          roomNo: u.user_metadata?.roomNo ?? 'Hostel 3 - Room 102',
        }
        saveStoredUser(user)
        try {
          window.history.replaceState({}, document.title, window.location.pathname)
        } catch (e) {}
        return user
      }
    }

    // 3. Check existing Supabase session
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) {
      const u = data.session.user
      const local = getStoredUser()
      const user: AppUser = {
        id: u.id,
        name:
          u.user_metadata?.full_name ??
          u.user_metadata?.name ??
          local?.name ??
          u.email?.split('@')[0] ??
          'Deepika K',
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

export function onAuthStateChange(callback: (user: AppUser | null) => void): () => void {
  if (!isSupabaseConfigured || !supabase) return () => {}

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      const u = session.user
      const local = getStoredUser()
      const user: AppUser = {
        id: u.id,
        name:
          u.user_metadata?.full_name ??
          u.user_metadata?.name ??
          local?.name ??
          u.email?.split('@')[0] ??
          'Deepika K',
        email: u.email ?? '',
        phone: u.user_metadata?.phone ?? local?.phone ?? '+91 98765 43210',
        rollNo: u.user_metadata?.rollNo ?? local?.rollNo ?? '24CB7821',
        roomNo: u.user_metadata?.roomNo ?? local?.roomNo ?? 'Hostel 3 - Room 102',
      }
      saveStoredUser(user)
      callback(user)
    } else if (event === 'SIGNED_OUT') {
      callback(null)
    }
  })

  return () => {
    subscription.unsubscribe()
  }
}
