import { type AppUser, getAuthHeaders } from './auth'
import type { CartItem } from '../App'

declare global {
  interface Window {
    Razorpay: any
  }
}

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
  isSimulator?: boolean
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

/**
 * Loads the official Razorpay Standard Checkout SDK script dynamically
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => {
      console.warn('Failed to load Razorpay Checkout script from CDN.')
      resolve(false)
    }
    document.body.appendChild(script)
  })
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

/**
 * Verifies the payment cryptographic signature on the backend server
 */
export async function verifyPaymentOnBackend(params: {
  orderId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
  isSimulator?: boolean
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
