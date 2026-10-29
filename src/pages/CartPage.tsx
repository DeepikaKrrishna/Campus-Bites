import { useState } from 'react'
import { fetchOrderById, addOrderToCache, normalizeOrder, type Order } from '../lib/orders'
import {
  createBackendPaymentOrder,
  loadRazorpayScript,
  openRazorpayCheckout,
  verifyPaymentOnBackend,
  type PaymentMethod,
} from '../lib/payments'
import type { AppUser } from '../lib/auth'
import type { CartItem, Tab } from '../App'

type Props = {
  cart: CartItem[]
  updateQty: (id: number, delta: number) => void
  user: AppUser | null
  onTabChange: (tab: Tab) => void
  onOrderPlaced: (order: Order) => void
}

const PAYMENT: Array<{ key: PaymentMethod; label: string; sub: string; icon: string }> = [
  { key: 'netbanking', label: 'Netbanking', sub: 'SBI · HDFC (Select Bank)', icon: '🏦' },
  { key: 'upi', label: 'UPI', sub: 'GPay · PhonePe · Paytm', icon: '📱' },
  { key: 'card', label: 'Card', sub: 'Debit or Credit', icon: '💳' },
  { key: 'cash', label: 'Cash', sub: 'Pay at counter', icon: '💵' },
]

export default function CartPage({
  cart,
  updateQty,
  user,
  onTabChange,
  onOrderPlaced,
}: Props) {
  const [payment, setPayment] = useState<PaymentMethod>('netbanking')
  const [busy, setBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const tax = Math.round(subtotal * 0.05)
  const packing = cart.length > 0 ? 10 : 0
  const total = subtotal + tax + packing

  // Complete order placement via authoritative backend and Razorpay payment gateway
  const executeOrder = async (method: PaymentMethod) => {
    if (busy || cart.length === 0) return
    setBusy(true)
    setCheckoutError('')

    try {
      const currentUser: AppUser = user ?? {
        id: 'demo-student',
        name: 'Deepika K',
        email: 'deepika@campusbites.edu',
        phone: '9876543210',
        rollNo: '24CB7821',
        roomNo: 'Hostel 3 - Room 102',
      }

      // 1. Authoritative Backend Payment Order Creation
      const paymentOrderRes = await createBackendPaymentOrder(currentUser, cart, method)

      // Cash payments are completed immediately
      if (method === 'cash') {
        const placedOrder = await fetchOrderById(paymentOrderRes.orderId)
        if (!placedOrder) throw new Error('The saved order could not be loaded. Please check order tracking.')
        addOrderToCache(placedOrder)
        onOrderPlaced(placedOrder)
        onTabChange('track')
        return
      }

      // 2. Online / Netbanking / UPI payment: Open Razorpay Test Mode Checkout Directly
      if (!paymentOrderRes.razorpayOrderId) {
        throw new Error('Razorpay did not return an order ID. Please try again.')
      }
      if (!paymentOrderRes.keyId?.startsWith('rzp_test_')) {
        throw new Error('Razorpay Test Mode is not configured on the server.')
      }

      if (!(await loadRazorpayScript())) {
        throw new Error('Razorpay Checkout SDK could not be loaded. Please check your internet connection.')
      }

      const checkoutResponse = await openRazorpayCheckout({
        key: paymentOrderRes.keyId,
        orderId: paymentOrderRes.razorpayOrderId,
        amount: paymentOrderRes.amount,
        currency: paymentOrderRes.currency || 'INR',
        name: 'CampusBites',
        description: `Campus canteen order ${paymentOrderRes.orderNumber}`,
        user: currentUser,
        method,
      })

      if (!checkoutResponse) {
        // User closed the Razorpay popup without completing payment
        return
      }

      // 3. Cryptographic Signature Verification on Backend
      const verifyRes = await verifyPaymentOnBackend({
        orderId: paymentOrderRes.orderId,
        razorpayOrderId: checkoutResponse.razorpay_order_id,
        razorpayPaymentId: checkoutResponse.razorpay_payment_id,
        razorpaySignature: checkoutResponse.razorpay_signature,
      })

      if (!verifyRes.verified) {
        throw new Error(verifyRes.error || 'Payment verification failed on server.')
      }

      const placedOrder = verifyRes.order
        ? normalizeOrder(verifyRes.order)
        : await fetchOrderById(paymentOrderRes.orderId)
      if (!placedOrder || placedOrder.payment_status !== 'PAID') {
        throw new Error('Payment was received, but the saved order is not available yet. Please refresh order tracking.')
      }

      addOrderToCache(placedOrder)
      onOrderPlaced(placedOrder)
      onTabChange('track')
    } catch (err: any) {
      console.error('Order checkout error:', err)
      setCheckoutError(err.message || 'Failed to place order. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleCheckout = () => executeOrder(payment)

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

      {/* Razorpay Test Mode Active Indicator */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          border: '1px solid #86efac',
          borderRadius: 14,
          margin: '12px 20px 4px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🧪</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#166534' }}>
              Razorpay Test Mode Active
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#15803d' }}>
              Test Key: <code style={{ fontWeight: 700 }}>rzp_test_TsHQqNzjSdRCWH</code>
            </p>
          </div>
        </div>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            background: '#16a34a',
            color: '#ffffff',
            padding: '3px 8px',
            borderRadius: 6,
            letterSpacing: 0.5,
          }}
        >
          SANDBOX
        </span>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {PAYMENT.map((p) => {
                const isSelected = payment === p.key
                return (
                  <button
                    key={p.key}
                    onClick={() => {
                      setPayment(p.key)
                    }}
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

            {/* Netbanking Option Hint */}
            {payment === 'netbanking' && (
              <div
                style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  background: '#f0fdf4',
                  borderRadius: 12,
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 20 }}>🏦</span>
                <span style={{ fontSize: 12, color: '#166534', lineHeight: 1.45 }}>
                  <strong>Bank Simulator:</strong> Click Pay to open Razorpay's Bank Selection (SBI, HDFC, ICICI, etc.) and click the simulated <strong>"Success"</strong> button. No QR code needed!
                </span>
              </div>
            )}

            {/* UPI Option Hint */}
            {payment === 'upi' && (
              <div
                style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  background: '#f8fafc',
                  borderRadius: 12,
                  border: '1px dashed #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>⚡</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                    How to complete test payment in Razorpay:
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: '#475569', margin: 0, lineHeight: 1.45 }}>
                  In the Razorpay popup, enter UPI ID: <code style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: 4, fontWeight: 700, color: '#0f172a' }}>success@razorpay</code>, or switch to <strong>Card / Netbanking</strong> to click the simulated <strong>"Success"</strong> button. <em>Do not scan with a real mobile app on your phone</em>, as test mode transactions are sandboxed.
                </p>
              </div>
            )}

            {payment === 'card' && (
              <div
                style={{
                  marginTop: 16,
                  padding: '14px 16px',
                  background: '#f8fafc',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                When Razorpay is configured, card details are entered securely in its hosted checkout. CampusBites does not collect or store your card number or CVV.
              </div>
            )}
          </div>

          {/* Pickup Timing */}
          <div
            style={{
              background: '#ffffff',
              padding: '14px 20px',
              marginBottom: 12,
              borderTop: '1px solid #f1f5f9',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#22c55e', fontSize: 18 }}>⏱️</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Estimated Prep Time
                  </p>
                  <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                    Pickup at Counter 2 (Main Canteen)
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#16a34a', background: '#f0fdf4', padding: '4px 10px', borderRadius: 8 }}>
                12–15 mins
              </span>
            </div>
          </div>

          {/* Bill Summary */}
          <div
            style={{
              background: '#ffffff',
              padding: '16px 20px',
              marginBottom: 20,
              borderTop: '1px solid #f1f5f9',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#0f172a' }}>
              Bill Details
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>Item Total</span>
              <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>₹{subtotal}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>Campus Canteen Tax (5%)</span>
              <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>₹{tax}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>Eco Packaging & Container</span>
              <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>₹{packing}</span>
            </div>

            <div style={{ height: 1, background: '#f1f5f9', margin: '10px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>To Pay</span>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Inclusive of all taxes</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>₹{total}</span>
            </div>
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
                    {payment === 'netbanking'
                      ? `Pay via Netbanking · ₹${total}`
                      : payment === 'upi'
                      ? `Pay via UPI · ₹${total}`
                      : payment === 'card'
                      ? `Pay Securely · ₹${total}`
                      : `Place Order · ₹${total}`}
                  </span>
                  <span style={{ fontSize: 18 }}>→</span>
                </>
              )}
            </button>

            {checkoutError && (
              <div
                style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 12,
                  color: '#b91c1c',
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>⚠️</span>
                <span>{checkoutError}</span>
              </div>
            )}
          </div>
        </>
      )}


    </div>
  )
}
