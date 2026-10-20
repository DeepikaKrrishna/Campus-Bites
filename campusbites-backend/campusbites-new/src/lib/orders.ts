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
  items: OrderItem[]
  subtotal: number
  tax: number
  packing: number
  total: number
  payment: string
  stage: number      // 0=placed, 1=confirmed, 2=preparing, 3=ready
  rating: number | null
  eta_minutes: number
  created_at: string
}

const STORAGE_KEY = 'cb_orders'

function readLocal(): Order[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') }
  catch { return [] }
}

function writeLocal(orders: Order[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

function genOrderNumber(): string {
  return 'CB' + String(Math.floor(10000 + Math.random() * 90000))
}

// ---- Place order ----
export async function placeOrder(
  user: AppUser,
  items: OrderItem[],
  payment: string,
): Promise<Order> {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const tax = Math.round(subtotal * 0.05)
  const packing = 10
  const total = subtotal + tax + packing
  const orderNumber = genOrderNumber()

  const order: Order = {
    id: '',
    order_number: orderNumber,
    items,
    subtotal,
    tax,
    packing,
    total,
    payment,
    stage: 0,
    rating: null,
    eta_minutes: 15,
    created_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured) {
    const { data, error } = await supabase!
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
        eta_minutes: 15,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    order.id = data.id
  } else {
    order.id = 'demo-' + Date.now()
    // In demo mode, save locally and auto-advance stages
    const all = readLocal()
    all.unshift(order)
    writeLocal(all)
    startDemoTracking(order.id)
  }

  return order
}

// ---- Get orders ----
export async function getOrders(userId: string): Promise<Order[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase!
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw new Error(error.message)
    return (data ?? []).map(row => ({
      ...row,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    }))
  }
  return readLocal()
}

// ---- Rate order ----
export async function rateOrder(orderId: string, rating: number): Promise<void> {
  if (isSupabaseConfigured) {
    await supabase!.from('orders').update({ rating }).eq('id', orderId)
  } else {
    const all = readLocal()
    const idx = all.findIndex(o => o.id === orderId)
    if (idx >= 0) { all[idx].rating = rating; writeLocal(all) }
  }
}

// ---- Real-time order tracking (Supabase) ----
export function subscribeToOrder(
  orderId: string,
  onUpdate: (order: Order) => void,
): () => void {
  if (!isSupabaseConfigured) return () => {}

  const channel = supabase!
    .channel('order-' + orderId)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
      (payload) => {
        const row = payload.new as any
        onUpdate({
          ...row,
          items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
        })
      },
    )
    .subscribe()

  return () => { supabase!.removeChannel(channel) }
}

// ---- Demo mode: auto-advance order stages ----
function startDemoTracking(orderId: string) {
  const advance = (delay: number, stage: number) => {
    setTimeout(() => {
      const all = readLocal()
      const idx = all.findIndex(o => o.id === orderId)
      if (idx >= 0 && all[idx].stage < stage) {
        all[idx].stage = stage
        writeLocal(all)
        window.dispatchEvent(new CustomEvent('cb:order-update', { detail: all[idx] }))
      }
    }, delay)
  }
  advance(4000,  1)  // Payment confirmed
  advance(12000, 2)  // Being prepared
  advance(25000, 3)  // Ready for pickup
}
