import { supabase, isSupabaseConfigured } from './supabase'
import { normalizeOrder, type Order, type OrderStatus } from './orders'
import type { AppUser } from './auth'

const STAFF_PASSKEY_KEY = 'cb_staff_passkey'

export function getStoredStaffPasskey(): string | null {
  return localStorage.getItem(STAFF_PASSKEY_KEY)
}

export function saveStoredStaffPasskey(passkey: string): void {
  localStorage.setItem(STAFF_PASSKEY_KEY, passkey)
}

export function clearStoredStaffPasskey(): void {
  localStorage.removeItem(STAFF_PASSKEY_KEY)
}

export async function verifyStaffPasskey(passkey: string): Promise<boolean> {
  try {
    const res = await fetch('/api/staff/verify-passkey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passkey }),
    })
    const data = await res.json()
    if (res.ok && data.authorized) {
      saveStoredStaffPasskey(passkey)
      return true
    }
  } catch (err) {
    console.warn('Staff verify error:', err)
  }
  return false
}

export function isStaffUser(user: AppUser | null): boolean {
  if (!user) return false
  const passkey = getStoredStaffPasskey()
  if (passkey) return true
  if (user.email?.includes('staff') || user.email?.includes('canteen') || user.email === 'staff.canteen@campusbites.edu') {
    return true
  }
  return false
}

export async function fetchStaffOrders(status?: string): Promise<Order[]> {
  try {
    const url = status && status !== 'ALL' ? `/api/staff/orders?status=${status}` : '/api/staff/orders'
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      if (json.success && Array.isArray(json.orders)) {
        return json.orders.map(normalizeOrder)
      }
    }
  } catch (e) {
    console.warn('API fetchStaffOrders failed, trying direct Supabase:', e)
  }

  // Fallback to Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40)
      if (data) {
        return data.map(normalizeOrder)
      }
    } catch (e) {}
  }

  return []
}

export async function fetchStaffStats(): Promise<{
  placed: number
  accepted: number
  preparing: number
  ready: number
  pickedUp: number
  cancelled: number
  totalRevenue: number
}> {
  try {
    const res = await fetch('/api/staff/stats')
    if (res.ok) {
      const json = await res.json()
      if (json.success) {
        return json.stats
      }
    }
  } catch (e) {
    console.warn('fetchStaffStats warning:', e)
  }

  return {
    placed: 0,
    accepted: 0,
    preparing: 0,
    ready: 0,
    pickedUp: 0,
    cancelled: 0,
    totalRevenue: 0,
  }
}

export async function updateStaffOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  passkey: string,
  reason?: string
): Promise<Order> {
  const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      newStatus,
      staffPasskey: passkey,
      reason,
    }),
  })

  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Failed to transition order to ${newStatus}`)
  }

  return normalizeOrder(json.order)
}

export async function collectCashPayment(orderId: string, passkey: string): Promise<void> {
  const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/collect-cash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staffPasskey: passkey }),
  })

  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to collect cash payment.')
  }
}

/**
 * Real-Time subscription for Canteen Kitchen Staff Dashboard
 * Notifies immediately when new orders are placed or updated across all customers!
 */
export function subscribeToAllOrders(
  onOrderChanged: (order: Order) => void,
  onNewOrder?: (order: Order) => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {}
  }

  try {
    const channelName = `realtime-all-orders-${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            const order = normalizeOrder(payload.new)
            if (payload.eventType === 'INSERT' && onNewOrder) {
              onNewOrder(order)
            } else {
              onOrderChanged(order)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  } catch (e) {
    console.warn('Realtime all orders subscription error:', e)
    return () => {}
  }
}
