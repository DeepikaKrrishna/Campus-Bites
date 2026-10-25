import { useState } from 'react'
import { fetchOrderById, type Order } from '../lib/orders'
import {
  createBackendPaymentOrder,
  getPaymentStatus,
  loadRazorpayScript,
  verifyPaymentOnBackend,
} from '../lib/payments'
import type { RazorpayCheckoutResponse } from '../lib/payments'
import type { AppUser } from '../lib/auth'
import type { CartItem, Tab } from '../App'

type Props = {
  cart: CartItem[]
  updateQty: (id: number, delta: number) => void
  user: AppUser | null
  onTabChange: (tab: Tab) => void
  onOrderPlaced: (order: Order) => void
}

const PAYMENT = [
  { key: 'upi', label: 'Pay Online with Razorpay', sub: 'UPI · Card · Test Mode', icon: '🔒' },
  { key: 'cash', label: 'Cash', sub: 'Pay at counter', icon: '💵' },
] as const

export default function CartPage({
  cart,
  updateQty,
  user,
  onTabChange,
  onOrderPlaced,
}: Props) {
  const [payment, setPayment] = useState<'upi' | 'cash'>('upi')
  const [busy, setBusy] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [retryOrderId, setRetryOrderId] = useState<string | null>(null)
  const [canRetryPayment, setCanRetryPayment] = useState(false)

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const tax = Math.round(subtotal * 0.05)
  const packing = cart.length > 0 ? 10 : 0
  const total = subtotal + tax + packing

  const openOrderTracking = async (orderId: string) => {
    const placedOrder = await fetchOrderById(orderId)
    if (!placedOrder) throw new Error('Your order could not be loaded. Please refresh your orders.')
    onOrderPlaced(placedOrder)
    onTabChange('track')
    setRetryOrderId(null)
    setCanRetryPayment(false)
    setPaymentMessage('')
  }

  const checkPayment = async (orderId: string) => {
    try {
      const status = await getPaymentStatus(orderId)
      if (status.paymentStatus === 'PAID') {
        await openOrderTracking(orderId)
        return
      }
      setCanRetryPayment(status.paymentStatus === 'FAILED')
      setPaymentMessage(
        status.paymentStatus === 'FAILED'
          ? 'Payment failed. Your order is not marked paid; you can safely retry.'
          : 'Payment is still pending confirmation. Check again shortly or retry checkout.'
      )
    } catch (error) {
      setCanRetryPayment(false)
      setPaymentMessage(error instanceof Error ? error.message : 'Payment status could not be checked.')
    }
  }

  const executeOrder = async (method: 'upi' | 'cash', existingOrderId?: string) => {
    if (busy || cart.length === 0) return
    setBusy(true)
    setPaymentMessage('')
    setCanRetryPayment(false)

    try {
      if (method === 'upi' && !(await loadRazorpayScript())) {
        throw new Error('Razorpay Checkout could not be loaded. Check your connection and try again.')
      }

      const paymentOrderRes = await createBackendPaymentOrder(cart, method, existingOrderId)
      setRetryOrderId(paymentOrderRes.orderId)

      if (method === 'cash') {
        await openOrderTracking(paymentOrderRes.orderId)
        return
      }

      if (!window.Razorpay || !paymentOrderRes.keyId || !paymentOrderRes.razorpayOrderId) {
        throw new Error('Razorpay Test Mode is not configured. Please contact the canteen.')
      }

      const checkoutResult = await new Promise<'paid' | 'pending' | 'check'>((resolve, reject) => {
        let settled = false
        const finish = (result: 'paid' | 'pending' | 'check') => {
          if (settled) return
          settled = true
          resolve(result)
        }
        const checkout = new window.Razorpay!({
          key: paymentOrderRes.keyId!,
          amount: paymentOrderRes.amount,
          currency: paymentOrderRes.currency,
          name: 'CampusBites',
          description: 'Demo Payment — Test Mode',
          order_id: paymentOrderRes.razorpayOrderId!,
          prefill: { name: user?.name || '', email: user?.email || '' },
          theme: { color: '#16a34a' },
          handler: async (response: RazorpayCheckoutResponse) => {
            try {
              const verification = await verifyPaymentOnBackend({
                orderId: paymentOrderRes.orderId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              })
              if (verification.verified && verification.status === 'PAID') {
                await openOrderTracking(paymentOrderRes.orderId)
                finish('paid')
              } else {
                setPaymentMessage('Payment is pending confirmation. Do not pay again until you check its status.')
                finish('pending')
              }
            } catch (error) {
              if (settled) return
              settled = true
              reject(error)
            }
          },
          modal: {
            ondismiss: () => finish('check'),
          },
        })
        checkout.on('payment.failed', (failure) => {
          checkout.close()
          setPaymentMessage(
            failure.error?.description
              ? `Payment failed: ${failure.error.description}. Check its status before retrying.`
              : 'Payment attempt failed. Check its status before retrying.'
          )
          finish('check')
        })
        checkout.open()
      })

      if (checkoutResult !== 'paid') {
        await checkPayment(paymentOrderRes.orderId)
      }
    } catch (error: unknown) {
      setPaymentMessage(error instanceof Error ? error.message : 'Failed to place order. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
    executeOrder(payment)
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%', paddingBottom: 24 }}>
      {/* Top Header */}
      <div
        style={{
          background: '#ffffff',
          padding: '20px 20px 16px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 2px', color: '#0f172a' }}>
            Checkout
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
            {cart.length} {cart.length === 1 ? 'item' : 'items'} in your basket
          </p>
        </div>

        <button
          onClick={() => onTabChange('menu')}
          style={{
            background: '#f1f5f9',
            border: 'none',
            borderRadius: 10,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          + Add More
        </button>
      </div>

      {cart.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🛒</div>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
            Your cart is empty
          </p>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
            Explore our delicious canteen menu and add your favourites!
          </p>
          <button
            onClick={() => onTabChange('menu')}
            style={{
              padding: '12px 28px',
              borderRadius: 14,
              background: '#22c55e',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 14,
              border: 'none',
              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.3)',
              cursor: 'pointer',
            }}
          >
            Explore Menu →
          </button>
        </div>
      ) : (
        <>
          {/* Cart Items List */}
          <div
            style={{
              background: '#ffffff',
              padding: '0 20px',
              margin: '12px 0 8px',
              borderTop: '1px solid #f1f5f9',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            {cart.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#f1f5f9',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 2px', color: '#0f172a' }}>
                    {item.name}
                  </p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>₹{item.price} each</p>
                </div>

                {/* Stepper */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#f8fafc',
                    padding: '3px 6px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <button
                    onClick={() => updateQty(item.id, -1)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      border: 'none',
                      background: '#ffffff',
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}
                  >
                    −
                  </button>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#0f172a',
                      minWidth: 16,
                      textAlign: 'center',
                    }}
                  >
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQty(item.id, 1)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      border: 'none',
                      background: '#22c55e',
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>

                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#0f172a',
                    minWidth: 50,
                    textAlign: 'right',
                  }}
                >
                  ₹{item.price * item.quantity}
                </span>
              </div>
            ))}
          </div>

          {/* ================= PAYMENT METHODS ================= */}
          <div
            style={{
              background: '#ffffff',
              padding: '16px 20px',
              marginBottom: 12,
              borderTop: '1px solid #f1f5f9',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Select Payment Method
              </p>
              <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, background: '#f0fdf4', padding: '2px 8px', borderRadius: 8 }}>
                🛡️ 100% Safe & Secure
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {PAYMENT.map((p) => {
                const isSelected = payment === p.key
                return (
                  <button
                    key={p.key}
                    onClick={() => setPayment(p.key)}
                    style={{
                      padding: '12px 8px',
                      borderRadius: 14,
                      border: isSelected ? '2px solid #22c55e' : '1.5px solid #e2e8f0',
                      background: isSelected ? '#f0fdf4' : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 8px rgba(34, 197, 94, 0.15)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{p.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{p.label}</span>
                    <span style={{ fontSize: 9.5, color: '#64748b', lineHeight: 1.2, textAlign: 'center' }}>
                      {p.sub}
                    </span>
                  </button>
                )
              })}
            </div>

            {payment === 'upi' && (
              <div role="note" style={{ marginTop: 12, padding: '10px 12px', background: '#f0fdf4', borderRadius: 10, color: '#166534', fontSize: 12 }}>
                Demo Payment — Test Mode. Complete payment in Razorpay Checkout; no real money is charged.
              </div>
            )}
            {paymentMessage && (
              <div role="status" aria-live="polite" style={{ marginTop: 12, padding: '10px 12px', background: '#fff7ed', borderRadius: 10, color: '#9a3412', fontSize: 12 }}>
                {paymentMessage}
              </div>
            )}
            {retryOrderId && payment === 'upi' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" disabled={busy} onClick={() => checkPayment(retryOrderId)} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                  Check payment status
                </button>
                {canRetryPayment && (
                  <button type="button" disabled={busy} onClick={() => executeOrder('upi', retryOrderId)} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                    Retry payment
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Checkout Action Button */}
          <div style={{ padding: '0 20px' }}>
            <button
              onClick={handleCheckout}
              disabled={busy}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 16,
                background: busy ? '#94a3b8' : 'linear-gradient(135deg, #16a34a, #22c55e)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 15,
                border: 'none',
                boxShadow: '0 6px 20px rgba(34, 197, 94, 0.35)',
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.15s ease',
              }}
            >
              {busy ? (
                <span>Processing Order…</span>
              ) : (
                <>
                  <span>
                    {payment === 'upi' ? `Pay Online · ₹${total}` : `Place Order · ₹${total}`}
                  </span>
                  <span style={{ fontSize: 18 }}>→</span>
                </>
              )}
            </button>
          </div>
        </>
      )}


    </div>
  )
}
