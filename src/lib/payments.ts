import { type AppUser, getAuthHeaders } from './auth'
import type { CartItem } from '../App'
import type { Order } from './orders'

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance
  }
}

export type PaymentMethod = 'netbanking' | 'upi' | 'card' | 'cash'

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
    vpa?: string
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
}

type RazorpayCheckoutInstance = {
  open: () => void
  on?: (event: 'payment.failed', callback: (response: RazorpayPaymentFailure) => void) => void
}

type RazorpayPaymentFailure = {
  error?: {
    description?: string
    reason?: string
  }
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
  order?: Order
}

let razorpayScriptPromise: Promise<boolean> | null = null

/**
 * Loads the official Razorpay Standard Checkout SDK script dynamically
 */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false)
  }
  if (window.Razorpay) return Promise.resolve(true)
  if (razorpayScriptPromise) return razorpayScriptPromise

  razorpayScriptPromise = new Promise((resolve) => {
    let settled = false
    let pollInterval: number | null = null

    const finish = (available: boolean) => {
      if (settled) return
      settled = true
      if (pollInterval) window.clearInterval(pollInterval)
      window.clearTimeout(timer)
      if (!available) {
        razorpayScriptPromise = null
      }
      resolve(available)
    }

    // Fast polling in case script is already loaded or loads without event
    pollInterval = window.setInterval(() => {
      if (window.Razorpay) {
        finish(true)
      }
    }, 100)

    const timer = window.setTimeout(() => {
      finish(Boolean(window.Razorpay))
    }, 10_000)

    let script = document.querySelector<HTMLScriptElement>('script[src*="checkout.razorpay.com"]')
    if (!script) {
      script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      document.body.appendChild(script)
    }

    script.addEventListener('load', () => {
      window.setTimeout(() => finish(Boolean(window.Razorpay)), 50)
    }, { once: true })
    script.addEventListener('error', () => {
      finish(false)
    }, { once: true })
  })

  return razorpayScriptPromise
}

/**
 * Calls the backend to create an authoritative payment order
 */
export async function createBackendPaymentOrder(
  user: AppUser,
  items: CartItem[],
  paymentMethod: PaymentMethod
): Promise<CreateOrderResponse> {
  const payload = {
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    items: items.map((it) => ({
      id: it.id,
      quantity: it.quantity,
    })),
    paymentMethod,
  }
  const headers = await getAuthHeaders()
  const response = await fetch('/api/payments/create-order', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const data = await response.json()
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to initialize payment order on server.')
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
  if (typeof window === 'undefined' || !window.Razorpay) {
    return Promise.reject(new Error('Razorpay Checkout SDK is not loaded. Please disable any ad-blockers and try again.'))
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
      const isTestMode = options.key.startsWith('rzp_test_')

      const rzpOptions: RazorpayCheckoutOptions = {
        key: options.key,
        order_id: options.orderId,
        amount: options.amount,
        currency: options.currency || 'INR',
        name: 'CampusBites',
        description: options.description || 'Campus Canteen Order',
        prefill: {
          name: options.user.name || 'Student',
          email: options.user.email || 'student@campusbites.edu',
          contact: cleanPhone,
          ...(options.method === 'netbanking'
            ? { method: 'netbanking' }
            : options.method === 'card'
            ? { method: 'card' }
            : options.method === 'upi'
            ? { method: 'upi', ...(isTestMode ? { vpa: 'success@razorpay' } : {}) }
            : {}),
        },
        theme: { color: '#16a34a' },
        handler: (response: RazorpayCheckoutResponse) => {
          if (
            !response.razorpay_order_id ||
            !response.razorpay_payment_id ||
            !response.razorpay_signature
          ) {
            fail(new Error('Razorpay returned an incomplete payment response.'))
            return
          }
          finish(response)
        },
        modal: {
          ondismiss: () => finish(null),
          escape: true,
          backdropclose: false,
        },
      }

      const Razorpay = window.Razorpay
      if (!Razorpay) {
        throw new Error('Razorpay Checkout SDK is not loaded.')
      }

      const checkout = new Razorpay(rzpOptions)

      if (typeof checkout.on === 'function') {
        checkout.on('payment.failed', (resp) => {
          const reason = resp?.error?.description || resp?.error?.reason || 'Payment was declined or cancelled.'
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
  const headers = await getAuthHeaders()
  const response = await fetch('/api/payments/verify', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  })

  const data = await response.json()
  if (!response.ok || !data.verified) {
    throw new Error(data.error || 'Payment signature verification failed on backend.')
  }

  return data
}
