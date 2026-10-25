import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { config } from './config'

export const supabase: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey || config.supabase.anonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

export type TrustedMenuItem = {
  id: number
  name: string
  price: number
  available: boolean
  category: string
}

export async function getAuthoritativeMenu(): Promise<TrustedMenuItem[]> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, name, price, available, category')
    .order('id')
  if (error || !data?.length) {
    console.error('Authoritative menu could not be loaded:', error?.message || 'No menu rows found')
    throw new Error('The canteen menu is temporarily unavailable. Please try again.')
  }
  return data.map((d: any) => ({
    id: Number(d.id),
    name: d.name,
    price: Number(d.price),
    available: Boolean(d.available),
    category: d.category,
  }))
}

export function validateCartAndCalculateTotals(
  items: Array<{ id: number; quantity: number }>,
  menu: TrustedMenuItem[]
): {
  valid: boolean
  error?: string
  validatedItems: Array<{
    id: number
    name: string
    price: number
    quantity: number
    subtotal: number
  }>
  subtotal: number
  tax: number
  packing: number
  total: number
  amountInPaise: number
} {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      valid: false,
      error: 'Cart is empty. Please add items to your cart.',
      validatedItems: [],
      subtotal: 0,
      tax: 0,
      packing: 0,
      total: 0,
      amountInPaise: 0,
    }
  }

  const menuMap = new Map<number, TrustedMenuItem>()
  menu.forEach((m) => menuMap.set(m.id, m))

  let subtotal = 0
  const validatedItems: Array<{
    id: number
    name: string
    price: number
    quantity: number
    subtotal: number
  }> = []

  for (const it of items) {
    const q = Number(it.quantity)
    if (!Number.isInteger(q) || q <= 0 || q > 50) {
      return {
        valid: false,
        error: `Invalid quantity for item ${it.id}. Must be between 1 and 50.`,
        validatedItems: [],
        subtotal: 0,
        tax: 0,
        packing: 0,
        total: 0,
        amountInPaise: 0,
      }
    }

    const menuItem = menuMap.get(Number(it.id))
    if (!menuItem) {
      return {
        valid: false,
        error: `Item with ID ${it.id} does not exist in the official canteen menu.`,
        validatedItems: [],
        subtotal: 0,
        tax: 0,
        packing: 0,
        total: 0,
        amountInPaise: 0,
      }
    }

    if (!menuItem.available) {
      return {
        valid: false,
        error: `"${menuItem.name}" is currently sold out. Please remove it from your cart.`,
        validatedItems: [],
        subtotal: 0,
        tax: 0,
        packing: 0,
        total: 0,
        amountInPaise: 0,
      }
    }

    const itemSubtotal = menuItem.price * q
    subtotal += itemSubtotal
    validatedItems.push({
      id: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: q,
      subtotal: itemSubtotal,
    })
  }

  const tax = Math.round(subtotal * 0.05)
  const packing = 10
  const total = subtotal + tax + packing
  const amountInPaise = Math.round(total * 100)

  return {
    valid: true,
    validatedItems,
    subtotal,
    tax,
    packing,
    total,
    amountInPaise,
  }
}

// ==============================================================================
// Supabase is the authoritative order and payment store.
// ==============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(val: string): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val)
}


export async function saveOrder(orderPayload: any): Promise<any> {
  // Require a valid authenticated Supabase customer ID.
  if (!isUuid(orderPayload?.user_id)) {
    throw new Error('A valid authenticated customer ID is required.')
  }

  // Validate and parse order items.
  let items: any

  try {
    items =
      typeof orderPayload.items === 'string'
        ? JSON.parse(orderPayload.items)
        : orderPayload.items
  } catch {
    throw new Error('Order items contain invalid JSON.')
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Cannot save an order without valid items.')
  }

  // Use a UUID for the order ID.
  const id = orderPayload.id || crypto.randomUUID()

  if (!isUuid(id)) {
    throw new Error('Order ID must be a valid UUID.')
  }

  const payload = {
    ...orderPayload,
    id,
    items,
    updated_at: new Date().toISOString(),
  }

  // Supabase is the source of truth.
  // Do not silently return an in-memory order if persistence fails.
  const { data, error } = await supabase.rpc('create_order_with_items', {
    p_order: payload,
    p_items: items,
  })

  if (error) {
    console.error('Order persistence failed:', {
      code: error.code,
      message: error.message,
    })

    throw new Error('Your order could not be saved. Please try again.')
  }

  if (!data) {
    throw new Error('The database did not return the saved order.')
  }

  const persisted = parseOrderRow(Array.isArray(data) ? data[0] : data)
  if (!persisted) throw new Error('The database did not return the saved order.')

  return persisted
}

function parseOrderRow(data: any): any {
  return {
    ...data,
    items: typeof data.items === 'string' ? JSON.parse(data.items) : data.items,
  }
}

export async function getOrderById(id: string): Promise<any | null> {
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()
  if (!error && data) {
    const order = parseOrderRow(data)
    return order
  }

  if (error) throw new Error('Order could not be loaded from the database.')
  return null
}

export async function updateOrderRecord(
  id: string,
  updates: any
): Promise<any | null> {
  const existing = await getOrderById(id)
  if (!existing) return null

  const now = new Date().toISOString()
  const supabaseUpdates = { ...updates, updated_at: now }
  if (supabaseUpdates.items && typeof supabaseUpdates.items !== 'string') {
    supabaseUpdates.items = JSON.stringify(supabaseUpdates.items)
  }

  const { data, error } = await supabase
    .from('orders')
    .update(supabaseUpdates)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error || !data) {
    console.error('Order update persistence failed:', error?.message || 'No updated order returned')
    throw new Error('Order update could not be saved.')
  }
  return parseOrderRow(data)
}

export type TransitionOrderResult =
  | { ok: true; order: any }
  | { ok: false; code: 'NOT_FOUND' | 'CONFLICT' | 'DB_ERROR'; message?: string }

/**
 * Atomically transition order status when the row still matches expectedStatus.
 */
export async function transitionOrderStatus(input: {
  orderId: string
  expectedStatus: string
  newStatus: string
  updates?: Record<string, unknown>
  history: {
    previous_status: string
    new_status: string
    actor_id?: string
    actor_role: string
    status_note?: string
  }
}): Promise<TransitionOrderResult> {
  const { data, error } = await supabase.rpc('transition_order_status', {
    p_order_id: input.orderId,
    p_expected_status: input.expectedStatus,
    p_new_status: input.newStatus,
    p_actor_id: input.history.actor_id || null,
    p_actor_role: input.history.actor_role,
    p_note: input.history.status_note || null,
    p_updates: input.updates || {},
  })

  if (error) {
    console.error('transitionOrderStatus DB error:', error.message)
    if (error.message.includes('ORDER_CONFLICT')) return { ok: false, code: 'CONFLICT' }
    if (error.message.includes('ORDER_NOT_FOUND')) return { ok: false, code: 'NOT_FOUND' }
    return { ok: false, code: 'DB_ERROR', message: error.message }
  }

  if (!data) return { ok: false, code: 'NOT_FOUND' }

  const order = parseOrderRow(Array.isArray(data) ? data[0] : data)
  if (!order) return { ok: false, code: 'NOT_FOUND' }
  return { ok: true, order }
}

export async function getUserOrdersList(userId: string): Promise<any[]> {
  if (!isUuid(userId)) throw new Error('A valid authenticated customer ID is required.')
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw new Error('Orders could not be loaded from the database.')
  return (data || []).map(parseOrderRow)
}

export async function getStaffOrdersList(statusFilter?: string, limit: number = 50): Promise<any[]> {
  let query = supabase.from('orders').select('*').order('created_at', { ascending: false })
  if (statusFilter && statusFilter !== 'ALL') query = query.eq('status', statusFilter)
  const { data, error } = await query.limit(Math.min(Math.max(limit, 1), 200))
  if (error) throw new Error('Staff orders could not be loaded from the database.')
  return (data || []).map(parseOrderRow)
}

export async function getStaffOrderStats(): Promise<{
  placed: number
  accepted: number
  preparing: number
  ready: number
  pickedUp: number
  cancelled: number
  totalRevenue: number
}> {
  const allOrders = await getStaffOrdersList('ALL', 500)
  const stats = {
    placed: 0,
    accepted: 0,
    preparing: 0,
    ready: 0,
    pickedUp: 0,
    cancelled: 0,
    totalRevenue: 0,
  }

  for (const o of allOrders) {
    const st = o.status || 'PLACED'
    if (st === 'PLACED') stats.placed++
    else if (st === 'ACCEPTED') stats.accepted++
    else if (st === 'PREPARING') stats.preparing++
    else if (st === 'READY_FOR_PICKUP') stats.ready++
    else if (st === 'PICKED_UP') {
      stats.pickedUp++
      stats.totalRevenue += Number(o.total || 0)
    } else if (st === 'CANCELLED') stats.cancelled++
  }

  return stats
}

export async function savePaymentRecord(payment: any): Promise<any> {
  const id = payment.id || ('pay-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6))
  const record = {
    ...payment,
    id,
    created_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('payments')
    .insert(payment)
    .select()
    .single()
  if (error || !data) throw new Error('Payment record could not be saved.')
  return data
}

export async function updatePaymentRecord(gatewayOrderId: string, updates: any): Promise<any> {
  const { data, error } = await supabase
    .from('payments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('gateway_order_id', gatewayOrderId)
    .select()
    .maybeSingle()
  if (error || !data) throw new Error('Payment record could not be updated.')
  return data
}

export async function getPaymentRecord(gatewayOrderId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('gateway_order_id', gatewayOrderId)
    .maybeSingle()
  if (error) throw new Error('Payment record could not be loaded.')
  return data
}

