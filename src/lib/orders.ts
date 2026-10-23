import { supabase, isSupabaseConfigured } from './supabase'
import type { AppUser } from './auth'

export type OrderItem = {
  id: number
  name: string
  price: number
  image: string
  quantity: number
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
  payment_meta?: {
    upi_id?: string
    upi_txn_id?: string
    card_last4?: string
    card_brand?: string
  }
  stage: number // 0=Placed, 1=Confirmed, 2=Preparing, 3=Packing, 4=Ready for Pickup
  rating: number | null
  rating_comment?: string
  rating_tags?: string[]
  eta_minutes: number
  created_at: string
}

const STORAGE_KEY = 'cb_orders'

export function readLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function writeLocalOrders(orders: Order[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

function genOrderNumber(): string {
  return 'CB' + String(Math.floor(10000 + Math.random() * 90000))
}

function genTokenNumber(): number {
  return Math.floor(10 + Math.random() * 89)
}

// Stage advancement timers for realistic interactive demo/local simulation
const activeTimers: Record<string, NodeJS.Timeout[]> = {}

export function startDemoTracking(orderId: string, baseEtaMin: number = 15) {
  // Clear any existing timers for this order
  if (activeTimers[orderId]) {
    activeTimers[orderId].forEach(clearTimeout)
    activeTimers[orderId] = []
  }

  const timers: NodeJS.Timeout[] = []

  const updateOrderStage = (targetStage: number) => {
    const all = readLocalOrders()
    const idx = all.findIndex((o) => o.id === orderId)
    if (idx >= 0 && all[idx].stage < targetStage) {
      all[idx].stage = targetStage
      writeLocalOrders(all)
      window.dispatchEvent(new CustomEvent('cb:order-update', { detail: all[idx] }))
    }
  }

  // Fast-forward demo intervals (seconds)
  // Stage 1: Confirmed after 4 seconds
  timers.push(setTimeout(() => updateOrderStage(1), 4000))
  // Stage 2: Preparing in Kitchen after 12 seconds
  timers.push(setTimeout(() => updateOrderStage(2), 12000))
  // Stage 3: Quality Check & Packing after 22 seconds
  timers.push(setTimeout(() => updateOrderStage(3), 22000))
  // Stage 4: Ready for Pickup after 34 seconds
  timers.push(setTimeout(() => updateOrderStage(4), 34000))

  activeTimers[orderId] = timers
}

// Place order
export async function placeOrder(
  user: AppUser,
  items: OrderItem[],
  payment: 'cash' | 'upi' | 'card',
  payment_meta?: Order['payment_meta']
): Promise<Order> {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const tax = Math.round(subtotal * 0.05)
  const packing = 10
  const total = subtotal + tax + packing
  const orderNumber = genOrderNumber()
  const tokenNumber = genTokenNumber()
  const etaMinutes = Math.min(25, Math.max(10, Math.round(subtotal / 30) + 8))

  const order: Order = {
    id: 'cb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    order_number: orderNumber,
    token_number: tokenNumber,
    items,
    subtotal,
    tax,
    packing,
    total,
    payment,
    payment_meta,
    stage: 0,
    rating: null,
    eta_minutes: etaMinutes,
    created_at: new Date().toISOString(),
  }

  let savedToSupabase = false

  if (isSupabaseConfigured && supabase && !user.id.startsWith('demo-')) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          order_number: orderNumber,
          items: JSON.stringify(items),
          subtotal,
          tax,
          packing,
          total,
          payment,
          stage: 0,
          eta_minutes: etaMinutes,
        })
        .select()
        .single()

      if (!error && data) {
        order.id = data.id
        savedToSupabase = true
      } else if (error) {
        console.warn('Supabase order insert warning (falling back to local):', error.message)
      }
    } catch (e) {
      console.warn('Supabase order insert error, using local storage:', e)
    }
  }

  // Always keep in local storage for instant availability and seamless offline support
  const local = readLocalOrders()
  local.unshift(order)
  writeLocalOrders(local)

  // Start real-time progression
  startDemoTracking(order.id, etaMinutes)

  return order
}

// Fetch orders
export async function getOrders(userId: string): Promise<Order[]> {
  const localOrders = readLocalOrders()

  if (isSupabaseConfigured && supabase && !userId.startsWith('demo-')) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!error && data && data.length > 0) {
        const remoteOrders: Order[] = data.map((row: any) => ({
          id: row.id,
          order_number: row.order_number,
          token_number: row.token_number || parseInt(row.order_number.replace(/\D/g, '').slice(-2), 10) || 12,
          items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
          subtotal: row.subtotal,
          tax: row.tax,
          packing: row.packing ?? 10,
          total: row.total,
          payment: row.payment,
          stage: row.stage,
          rating: row.rating,
          eta_minutes: row.eta_minutes ?? 15,
          created_at: row.created_at,
        }))

        // Merge local & remote (avoiding duplicates)
        const combined = [...remoteOrders]
        for (const loc of localOrders) {
          if (!combined.some((r) => r.order_number === loc.order_number)) {
            combined.push(loc)
          }
        }
        return combined.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }
    } catch (e) {
      console.warn('Failed fetching orders from Supabase:', e)
    }
  }

  return localOrders
}

// Rate an order
export async function rateOrder(
  orderId: string,
  rating: number,
  comment?: string,
  tags?: string[]
): Promise<void> {
  const all = readLocalOrders()
  const idx = all.findIndex((o) => o.id === orderId)
  if (idx >= 0) {
    all[idx].rating = rating
    all[idx].rating_comment = comment
    all[idx].rating_tags = tags
    writeLocalOrders(all)
    window.dispatchEvent(new CustomEvent('cb:order-update', { detail: all[idx] }))
  }

  if (isSupabaseConfigured && supabase && !orderId.startsWith('cb-')) {
    try {
      await supabase.from('orders').update({ rating }).eq('id', orderId)
    } catch (err) {
      console.warn('Failed updating rating on Supabase:', err)
    }
  }
}

// Real-time order subscription
export function subscribeToOrder(
  orderId: string,
  onUpdate: (order: Order) => void
): () => void {
  if (!isSupabaseConfigured || !supabase || orderId.startsWith('cb-')) {
    return () => {}
  }

  try {
    const channel = supabase
      .channel('order-' + orderId)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const row = payload.new as any
          onUpdate({
            ...row,
            items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
          })
        }
      )
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  } catch (err) {
    console.warn('Realtime subscription error:', err)
    return () => {}
  }
}
