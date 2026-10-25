import { getAuthHeaders } from './auth'
import type { CartItem } from '../App'

export type PaymentMethod = 'upi' | 'card' | 'cash'

export type CreateOrderResponse = {
  success: boolean
  orderId: string
  orderNumber: string
  tokenNumber: number
  amount: number
  total?: number
  currency: string
  razorpayOrderId?: string
  keyId?: string
  isCash?: boolean
  etaMinutes?: number
  error?: string
  message?: string
}

export type VerifyPaymentResponse = {
  success: boolean
  verified: boolean
  orderId?: string
  paymentId?: string
  orderStatus?: string
  status?: string
  message?: string
  error?: string
}

export type PaymentStatusResponse = {
  success: boolean
  orderId: string
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  paymentFailureReason?: string | null
  error?: string
}

export type RazorpayCheckoutResponse = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export type RazorpayCheckoutOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  prefill: { name: string; email: string }
  theme: { color: string }
  handler: (response: RazorpayCheckoutResponse) => void | Promise<void>
  modal: { ondismiss: () => void }
}

export type RazorpayFailure = {
  error?: { description?: string; reason?: string }
}

export interface RazorpayCheckoutInstance {
  open(): void
  close(): void
  on(event: 'payment.failed', handler: (response: RazorpayFailure) => void): void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]')
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpayCheckout = 'true'
    script.onload = () => resolve(Boolean(window.Razorpay))
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

async function postPaymentRequest<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  })
  const data = (await response.json()) as T & { success?: boolean; error?: string }
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'The payment request could not be completed.')
  }
  return data
}

export function createBackendPaymentOrder(
  items: CartItem[],
  paymentMethod: PaymentMethod,
  orderId?: string
): Promise<CreateOrderResponse> {
  return postPaymentRequest<CreateOrderResponse>('/api/payments/create-order', {
    items: orderId ? undefined : items.map(({ id, quantity }) => ({ id, quantity })),
    paymentMethod,
    orderId,
  })
}

export function verifyPaymentOnBackend(params: {
  orderId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}): Promise<VerifyPaymentResponse> {
  return postPaymentRequest<VerifyPaymentResponse>('/api/payments/verify', params)
}

export async function getPaymentStatus(orderId: string): Promise<PaymentStatusResponse> {
  const response = await fetch(`/api/payments/status/${encodeURIComponent(orderId)}`, {
    headers: await getAuthHeaders(),
  })
  const data = (await response.json()) as PaymentStatusResponse
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Payment status could not be checked.')
  }
  return data
}
