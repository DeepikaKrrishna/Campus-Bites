import { getAuthHeaders } from './auth'
import type { CartItem } from '../App'

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance
  }
}

export type PaymentMethod = 'upi' | 'card' | 'cash'

export type RazorpayCheckoutResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayCheckoutOptions = {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description: string
  prefill?: {
    name?: string
    email?: string
    contact?: string
    method?: string
  }
  theme?: {
    color?: string
  }
  handler?: (response: RazorpayCheckoutResponse) => void
  modal?: {
    ondismiss?: () => void
    escape?: boolean
    backdropclose?: boolean
  }
  config?: any
  [key: string]: any
}

type RazorpayCheckoutInstance = {
  open: () => void
  on?: (event: string, callback: (response: any) => void) => void
}

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

export function openRazorpayCheckout(options: {
  key: string
  orderId: string
  amount: number
  currency: string
  name: string
  description: string
  user: AppUser
  method?: PaymentMethod
}): Promise<RazorpayCheckoutResponse | null> {
  if (!window.Razorpay) {
    return Promise.reject(new Error('Razorpay Checkout did not load. Please check your connection and try again.'))
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (response: RazorpayCheckoutResponse | null) => {
      if (settled) return
      settled = true
      resolve(response)
    }
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }

    try {
      const cleanPhone = (options.user.phone || '9876543210').replace(/\D/g, '').slice(-10) || '9876543210'

      const rzpOptions: any = {
        key: options.key,
        order_id: options.orderId,
        amount: options.amount,
        currency: options.currency || 'INR',
        name: options.name || 'CampusBites',
        description: options.description || 'Campus Canteen Order',
        prefill: {
          name: options.user.name || 'Student',
          email: options.user.email || 'student@campusbites.edu',
          contact: cleanPhone,
          method: options.method === 'upi' ? 'upi' : options.method === 'card' ? 'card' : undefined,
        },
        theme: { color: '#16a34a' },
        handler: (response: RazorpayCheckoutResponse) => finish(response),
        modal: {
          ondismiss: () => finish(null),
          escape: true,
          backdropclose: false,
        },
      }

      const checkout = new window.Razorpay!(rzpOptions)

      if (typeof checkout.on === 'function') {
        checkout.on('payment.failed', function (resp: any) {
          const reason = resp?.error?.description || resp?.error?.reason || 'Payment was declined or cancelled.'
          console.warn('Razorpay payment failed:', resp)
          fail(new Error(reason))
        })
      }

      checkout.open()
    } catch (error) {
      fail(error instanceof Error ? error : new Error('Unable to open Razorpay Checkout.'))
    }
  })
}

/**
 * Verifies the payment cryptographic signature on the backend server
 */
export async function verifyPaymentOnBackend(params: {
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
