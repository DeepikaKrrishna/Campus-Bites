import { supabase, isSupabaseConfigured } from './supabase'
import { type AppUser, getAuthHeaders } from './auth'

export type OrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'CANCELLED'

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'

export type OrderItem = {
  id: number
  name: string
  price: number
  image?: string
  quantity: number
  subtotal?: number
}

export type Order = {
  id: string
  order_number: string
  token_number: number
  items: OrderItem[]
  subtotal: number
  tax: number
  packing: number
  total: number
  payment: 'cash' | 'upi' | 'card'
  payment_status: PaymentStatus
  status: OrderStatus
  stage: number // 0=Placed, 1=Accepted, 2=Preparing, 3=Ready for Pickup, 4=Picked up, -1=Cancelled
  rating: number | null
  rating_comment?: string
  rating_tags?: string[]
  eta_minutes: number
  estimated_ready_at?: string
  accepted_at?: string | null
  preparing_at?: string | null
  ready_at?: string | null
  picked_up_at?: string | null
  cancelled_at?: string | null
  cancellation_reason?: string
  notes?: string
  created_at: string
  updated_at?: string
}

export const STAGE_TO_STATUS: Record<number, OrderStatus> = {
  0: 'PLACED',
  1: 'ACCEPTED',
  2: 'PREPARING',
  3: 'READY_FOR_PICKUP',
  4: 'PICKED_UP',
}

export const STATUS_TO_STAGE: Record<OrderStatus, number> = {
  PLACED: 0,
  ACCEPTED: 1,
  PREPARING: 2,
  READY_FOR_PICKUP: 3,
  PICKED_UP: 4,
  CANCELLED: -1,
}

const STORAGE_KEY = 'cb_orders_cache'

function isTrackableOrder(order: Order): boolean {
  return order.payment === 'cash' || order.payment_status === 'PAID'
}

export function readCachedOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function writeCachedOrders(orders: Order[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  } catch {}
}

export function addOrderToCache(order: Order): void {
  try {
    const existing = readCachedOrders().filter((o) => o.id !== order.id)
    writeCachedOrders([order, ...existing])
  } catch {}
}

/**
 * Normalizes database order row into typed Order
 */
export function normalizeOrder(row: any): Order {
  const items: OrderItem[] = typeof row.items === 'string' ? JSON.parse(row.items) : row.items || []
  const stage = typeof row.stage === 'number' ? row.stage : 0
  const status: OrderStatus = row.status || STAGE_TO_STATUS[stage] || 'PLACED'

  return {
    id: String(row.id),
    order_number: row.order_number || 'CB-00000',
    token_number:
      row.token_number ||
      parseInt(String(row.order_number).replace(/\D/g, '').slice(-2), 10) ||
      12,
    items,
    subtotal: Number(row.subtotal || 0),
    tax: Number(row.tax || 0),
    packing: Number(row.packing || 10),
    total: Number(row.total || 0),
    payment: row.payment || 'upi',
    payment_status: (row.payment_status || (row.stage >= 1 ? 'PAID' : 'PENDING')) as PaymentStatus,
    status,
    stage: STATUS_TO_STAGE[status] ?? stage,
    rating: row.rating ?? null,
    rating_comment: row.rating_comment,
    rating_tags: row.rating_tags,
    eta_minutes: Number(row.eta_minutes || 15),
    estimated_ready_at: row.estimated_ready_at,
    accepted_at: row.accepted_at,
    preparing_at: row.preparing_at,
    ready_at: row.ready_at,
    picked_up_at: row.picked_up_at,
    cancelled_at: row.cancelled_at,
    cancellation_reason: row.cancellation_reason,
    notes: row.notes,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at,
  }
}

/**
 * Fetch a single order by ID (authorized via API — ownership enforced server-side).
 */
export async function fetchOrderById(orderId: string): Promise<Order | null> {
  // 1. Backend API endpoint
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { headers })
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.order) {
        const order = normalizeOrder(json.order)
        addOrderToCache(order)
        return order
      }
    }
  } catch (e) {
    console.warn('fetchOrderById API error:', e)
  }

  // 2. Direct Supabase query
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle()
      if (!error && data) {
        const order = normalizeOrder(data)
        addOrderToCache(order)
        return order
      }
    } catch (e) {
      console.warn('fetchOrderById Supabase error:', e)
    }
  }

  // 3. Cached fallback
  const cached = readCachedOrders().find((o) => o.id === orderId)
  if (cached) return cached

  return null
}

/**
 * Fetch authoritative user orders from Supabase PostgreSQL (or API endpoint)
 */
export async function getOrders(userId: string): Promise<Order[]> {
  const cached = readCachedOrders().filter(isTrackableOrder)
  const effectiveUserId = (!userId || userId.startsWith('demo-'))
    ? '6ad74069-27c0-4bcc-8666-e6cce642ef27'
    : userId

  // 1. Direct Supabase query
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', effectiveUserId)
        .or('payment_status.eq.PAID,payment.eq.cash')
        .order('created_at', { ascending: false })
        .limit(25)

      if (!error && data && data.length > 0) {
        const parsed = data.map(normalizeOrder).filter(isTrackableOrder)
        writeCachedOrders(parsed)
        if (parsed.length > 0) return parsed
      }
    } catch (err) {
      console.warn('Supabase getOrders direct error, trying API endpoint:', err)
    }
  }

  // 2. Try backend API endpoint
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`/api/orders/user/${encodeURIComponent(effectiveUserId)}`, { headers })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json.success && Array.isArray(json.orders)) {
      const parsed = json.orders.map(normalizeOrder).filter(isTrackableOrder)
      writeCachedOrders(parsed)
      if (parsed.length > 0) return parsed
    }
  } catch (apiErr) {
    console.warn('API getOrders error:', apiErr)
  }

  // 3. Fallback to cached orders
  return cached
}

/**
 * Create a new order via authoritative server endpoint
 */
export async function placeOrder(
  user: AppUser,
  items: OrderItem[],
  payment: 'cash' | 'upi' | 'card',
  _meta?: any
): Promise<Order> {
  const headers = await getAuthHeaders()
  const res = await fetch('/api/orders/create', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
      paymentMethod: payment,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to place order.')
  }

  const data = await res.json()
  const order = normalizeOrder(data.order)

  // Update local cache
  const cached = readCachedOrders()
  cached.unshift(order)
  writeCachedOrders(cached)

  return order
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string, reason: string): Promise<Order> {
  const headers = await getAuthHeaders()
  const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      newStatus: 'CANCELLED',
      reason,
    }),
  })

  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to cancel order.')
  }

  const updated = normalizeOrder(json.order)

  // Update cached orders
  const cached = readCachedOrders().map((o) => (o.id === updated.id ? updated : o))
  writeCachedOrders(cached)

  return updated
}

/**
 * Rate an order
 */
export async function rateOrder(
  orderId: string,
  rating: number,
  comment?: string,
  _tags?: string[]
): Promise<void> {
  try {
    const headers = await getAuthHeaders()
    await fetch(`/api/orders/${encodeURIComponent(orderId)}/rate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating, comment }),
    })
  } catch (e) {
    console.warn('Rate order API warning:', e)
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('orders')
        .update({ rating, rating_comment: comment || null })
        .eq('id', orderId)
    } catch (e) {}
  }

  const cached = readCachedOrders().map((o) =>
    o.id === orderId ? { ...o, rating, rating_comment: comment } : o
  )
  writeCachedOrders(cached)
}

/**
 * Real-Time Supabase Subscription to listen to live database updates for an order!
 * Subscribes to postgres_changes on table 'orders' where id = orderId.
 * Automatically cleans up the channel when unsubscribed.
 */
export function subscribeToOrder(
  orderId: string,
  onUpdate: (order: Order) => void
): () => void {
  if (!isSupabaseConfigured || !supabase || !orderId) {
    return () => {}
  }

  try {
    const channelName = `realtime-order-${orderId}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to both INSERT and UPDATE
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            const updated = normalizeOrder(payload.new)
            onUpdate(updated)

            // Sync with local cache
            const cached = readCachedOrders().map((o) => (o.id === updated.id ? updated : o))
            writeCachedOrders(cached)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // A fresh authoritative read closes the gap after reconnects or missed events.
          fetchOrderById(orderId).then((fresh) => fresh && onUpdate(fresh))
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`Realtime channel error for order ${orderId}`)
        }
      })

    return () => {
      supabase?.removeChannel(channel)
    }
  } catch (err) {
    console.warn('Realtime subscription error:', err)
    return () => {}
  }
}
