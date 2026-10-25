export type OrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'CANCELLED'

export type OrderItem = {
  id?: number
  name?: string
  item_name?: string
  price?: number
  unit_price?: number
  quantity: number
  subtotal?: number
  customizations?: Record<string, unknown> | string
}

export type CustomerInfo = {
  name?: string
  email?: string
  phone?: string
  roll_no?: string
}

export type Order = {
  id: string
  user_id?: string
  order_number: string
  token_number: number
  customer?: CustomerInfo | null
  items: OrderItem[]
  subtotal: number
  tax: number
  packing: number
  total: number
  currency: string
  payment: string
  payment_status: string
  status: OrderStatus
  stage: number
  eta_minutes: number
  cancellation_reason?: string | null
  created_at: string
  updated_at?: string
  accepted_at?: string | null
  preparing_at?: string | null
  ready_at?: string | null
  picked_up_at?: string | null
  cancelled_at?: string | null
}

export const statusNames: Record<OrderStatus, string> = {
  PLACED: 'New order',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for pickup',
  PICKED_UP: 'Completed',
  CANCELLED: 'Declined / cancelled',
}

export const nextStep: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  PLACED: { status: 'ACCEPTED', label: 'Accept order' },
  ACCEPTED: { status: 'PREPARING', label: 'Start preparing' },
  PREPARING: { status: 'READY_FOR_PICKUP', label: 'Mark ready for pickup' },
  READY_FOR_PICKUP: { status: 'PICKED_UP', label: 'Mark picked up' },
}
