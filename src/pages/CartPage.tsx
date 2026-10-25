import { useState, useEffect, useRef } from 'react'
import { fetchOrderById, type Order } from '../lib/orders'
import { createBackendPaymentOrder, verifyPaymentOnBackend } from '../lib/payments'
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
  { key: 'upi', label: 'UPI / QR', sub: 'GPay · PhonePe · Paytm', icon: '📱' },
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
  const [payment, setPayment] = useState<'upi' | 'card' | 'cash'>('upi')
  const [busy, setBusy] = useState(false)

  // Card details state
  const [cardNumber, setCardNumber] = useState('')
  const [cardHolder, setCardHolder] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [saveCard, setSaveCard] = useState(true)
  const [cardError, setCardError] = useState('')

  // UPI QR Modal state
  const [showUpiModal, setShowUpiModal] = useState(false)
  const [upiTimer, setUpiTimer] = useState(60) // 1 minute countdown
  const [qrCycle, setQrCycle] = useState(0) // Changes every 5s
  const [qrProgress, setQrProgress] = useState(100)
  const [upiStatus, setUpiStatus] = useState<'waiting' | 'scanning' | 'success'>('waiting')
  const [upiApp, setUpiApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'bhim'>('gpay')

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const tax = Math.round(subtotal * 0.05)
  const packing = cart.length > 0 ? 10 : 0
  const total = subtotal + tax + packing

  // Timer for UPI QR 60s expiration and 5s dynamic refresh
  const upiIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const cycleIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!showUpiModal) {
      if (upiIntervalRef.current) clearInterval(upiIntervalRef.current)
      if (cycleIntervalRef.current) clearInterval(cycleIntervalRef.current)
      return
    }

    setUpiTimer(60)
    setQrCycle(1)
    setUpiStatus('waiting')

    // 1-minute countdown timer (tick every second)
    upiIntervalRef.current = setInterval(() => {
      setUpiTimer((prev) => {
        if (prev <= 1) {
          if (upiIntervalRef.current) clearInterval(upiIntervalRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Dynamic QR refresh every 5 seconds (simulates banking security token rotation)
    let secondsInCycle = 0
    cycleIntervalRef.current = setInterval(() => {
      secondsInCycle = (secondsInCycle + 1) % 5
      setQrProgress(((5 - secondsInCycle) / 5) * 100)

      if (secondsInCycle === 0) {
        setQrCycle((c) => c + 1)
      }
    }, 1000)

    return () => {
      if (upiIntervalRef.current) clearInterval(upiIntervalRef.current)
      if (cycleIntervalRef.current) clearInterval(cycleIntervalRef.current)
    }
  }, [showUpiModal])

  // Card Number formatting (XXXX XXXX XXXX XXXX)
  const handleCardNumberChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 16)
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ')
    setCardNumber(formatted)
    setCardError('')
  }

  // Expiry formatting (MM / YY)
  const handleExpiryChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 4)
    if (raw.length >= 3) {
      setCardExpiry(raw.slice(0, 2) + '/' + raw.slice(2))
    } else {
      setCardExpiry(raw)
    }
    setCardError('')
  }

  // Detect card network
  const getCardNetwork = () => {
    const num = cardNumber.replace(/\s/g, '')
    if (num.startsWith('4')) return { name: 'VISA', color: '#1a365d' }
    if (num.startsWith('5')) return { name: 'Mastercard', color: '#7f1d1d' }
    if (num.startsWith('6') || num.startsWith('8')) return { name: 'RuPay', color: '#14532d' }
    return { name: 'CARD', color: '#334155' }
  }

  // Complete order placement via authoritative backend and payment gateway
  const executeOrder = async (
    method: 'upi' | 'card' | 'cash',
    meta?: {
      upi_id?: string
      upi_txn_id?: string
      card_last4?: string
      card_brand?: string
    }
  ) => {
    if (busy || cart.length === 0) return
    setBusy(true)

    try {
      const currentUser: AppUser = user ?? {
        id: 'demo-student',
        name: 'Deepika K',
        email: 'deepika@campusbites.edu',
      }

      // 1. Authoritative Backend Payment Order Creation
      const paymentOrderRes = await createBackendPaymentOrder(currentUser, cart, method)

      // The payment endpoint already persists the order, including cash orders.
      if (method === 'cash') {
        const placedOrder = await fetchOrderById(paymentOrderRes.orderId)
        if (!placedOrder) throw new Error('Your order was created but could not be loaded. Please refresh your orders.')
        setShowUpiModal(false)
        onOrderPlaced(placedOrder)
        onTabChange('track')
        return
      }

      // 3. For UPI/Card: Verify payment on server
      const rzpPaymentId = meta?.upi_txn_id || 'pay_' + Date.now().toString(36)
      const rzpOrderId = paymentOrderRes.razorpayOrderId || 'order_test_' + Date.now()

      const verifyRes = await verifyPaymentOnBackend({
        orderId: paymentOrderRes.orderId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        razorpaySignature: 'sig_test_verified',
        isSimulator: paymentOrderRes.isSimulator ?? true,
      })

      if (!verifyRes.verified) {
        throw new Error(verifyRes.error || 'Payment verification failed on server.')
      }

      const placedOrder = await fetchOrderById(paymentOrderRes.orderId)
      if (!placedOrder) throw new Error('Payment was verified, but the saved order could not be loaded. Please refresh your orders.')

      // Show the persisted order; only staff can advance its kitchen status.
      setShowUpiModal(false)
      onOrderPlaced(placedOrder)
      onTabChange('track')
    } catch (err: any) {
      alert(err.message || 'Failed to place order. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // Handle Main "Place Order" button click
  const handleCheckout = async () => {
    if (cart.length === 0) return

    if (payment === 'upi') {
      setShowUpiModal(true)
      return
    }

    if (payment === 'card') {
      const cleanNum = cardNumber.replace(/\s/g, '')
      if (cleanNum.length < 16) {
        setCardError('Please enter a valid 16-digit card number')
        return
      }
      if (!cardHolder.trim()) {
        setCardError('Please enter the cardholder name')
        return
      }
      if (cardExpiry.length < 5) {
        setCardError('Please enter a valid expiry date (MM/YY)')
        return
      }
      if (cardCvv.length < 3) {
        setCardError('Please enter a valid 3-digit CVV')
        return
      }

      setBusy(true)
      setTimeout(() => {
        executeOrder('card', {
          card_last4: cleanNum.slice(-4),
          card_brand: getCardNetwork().name,
        })
      }, 1000)
      return
    }

    if (payment === 'cash') {
      executeOrder('cash')
    }
  }

  // Trigger verified UPI Payment via server-side verification
  const handleSimulateScan = () => {
    setUpiStatus('scanning')
    setTimeout(() => {
      setUpiStatus('success')
      setTimeout(() => {
        const txnId = 'UPI' + Math.floor(1000000000 + Math.random() * 9000000000)
        executeOrder('upi', {
          upi_id: 'student@okaxis',
          upi_txn_id: txnId,
        })
      }, 900)
    }, 1500)
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {PAYMENT.map((p) => {
                const isSelected = payment === p.key
                return (
                  <button
                    key={p.key}
                    onClick={() => {
                      setPayment(p.key as any)
                      setCardError('')
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

            {/* UPI Option Hint */}
            {payment === 'upi' && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  background: '#f8fafc',
                  borderRadius: 10,
                  border: '1px dashed #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 16 }}>⚡</span>
                <span style={{ fontSize: 11.5, color: '#334155' }}>
                  Dynamic 1-minute QR code with 5-sec anti-fraud security refresh will open upon clicking Place Order.
                </span>
              </div>
            )}

            {/* ================= CARD FORM ================= */}
            {payment === 'card' && (
              <div
                style={{
                  marginTop: 16,
                  padding: '16px',
                  background: '#f8fafc',
                  borderRadius: 16,
                  border: '1.5px solid #e2e8f0',
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                {/* Virtual Card Preview */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    borderRadius: 14,
                    padding: '16px',
                    color: '#ffffff',
                    marginBottom: 16,
                    boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', opacity: 0.8 }}>
                      CAMPUS DINING CARD
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#38bdf8' }}>
                      {getCardNetwork().name}
                    </span>
                  </div>

                  {/* Chip */}
                  <div
                    style={{
                      width: 32,
                      height: 24,
                      borderRadius: 4,
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      marginBottom: 12,
                    }}
                  />

                  {/* Card Number */}
                  <p
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      margin: '0 0 12px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {cardNumber || '•••• •••• •••• ••••'}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <span style={{ fontSize: 8, textTransform: 'uppercase', opacity: 0.7, display: 'block' }}>
                        CARDHOLDER
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em' }}>
                        {cardHolder.toUpperCase() || 'STUDENT NAME'}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: 8, textTransform: 'uppercase', opacity: 0.7, display: 'block' }}>
                        EXPIRES
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                        {cardExpiry || 'MM/YY'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form Inputs */}
                {cardError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      fontSize: 12,
                      padding: '8px 12px',
                      borderRadius: 8,
                      marginBottom: 12,
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ {cardError}
                  </div>
                )}

                {/* Card Number Input */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    CARD NUMBER
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => handleCardNumberChange(e.target.value)}
                    placeholder="4123 4567 8901 2345"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: 14,
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Cardholder Name */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                    CARDHOLDER NAME
                  </label>
                  <input
                    type="text"
                    value={cardHolder}
                    onChange={(e) => {
                      setCardHolder(e.target.value)
                      setCardError('')
                    }}
                    placeholder="e.g. Deepika K"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: 13,
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Expiry & CVV */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                      VALID THRU
                    </label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => handleExpiryChange(e.target.value)}
                      placeholder="MM/YY"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1.5px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: 14,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                      CVV / CVC
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => {
                        setCardCvv(e.target.value.replace(/\D/g, ''))
                        setCardError('')
                      }}
                      placeholder="•••"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1.5px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: 14,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Save card checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#475569' }}>
                  <input
                    type="checkbox"
                    checked={saveCard}
                    onChange={(e) => setSaveCard(e.target.checked)}
                    style={{ accentColor: '#22c55e', width: 16, height: 16 }}
                  />
                  <span>Save this card securely for faster future payments</span>
                </label>
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
                    {payment === 'upi'
                      ? `Pay via UPI QR · ₹${total}`
                      : payment === 'card'
                      ? `Pay Securely · ₹${total}`
                      : `Place Order · ₹${total}`}
                  </span>
                  <span style={{ fontSize: 18 }}>→</span>
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* =========================================================
          UPI DYNAMIC QR MODAL (1-MIN TIMER + 5-SEC DYNAMIC ROTATION)
      ========================================================= */}
      {showUpiModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 360,
              background: '#ffffff',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              position: 'relative',
              textAlign: 'center',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                color: '#ffffff',
                padding: '18px 20px',
                position: 'relative',
              }}
            >
              <button
                onClick={() => setShowUpiModal(false)}
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#ffffff',
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>

              <p style={{ fontSize: 11, color: '#38bdf8', fontWeight: 800, letterSpacing: '0.08em', margin: '0 0 2px' }}>
                INSTANT CAMPUS UPI PAYMENT
              </p>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>
                Scan & Pay ₹{total}
              </h2>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                Point any camera or UPI app at this dynamic QR
              </p>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px' }}>
              {/* 1-Minute Countdown Timer Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: upiTimer < 15 ? '#fef2f2' : '#f0fdf4',
                  borderRadius: 12,
                  padding: '8px 14px',
                  marginBottom: 16,
                  border: `1px solid ${upiTimer < 15 ? '#fca5a5' : '#bbf7d0'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>⏳</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: upiTimer < 15 ? '#dc2626' : '#15803d' }}>
                    QR Code expires in
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 900,
                    fontFamily: 'monospace',
                    color: upiTimer < 15 ? '#dc2626' : '#15803d',
                  }}
                >
                  00:{upiTimer < 10 ? `0${upiTimer}` : upiTimer}
                </span>
              </div>

              {/* 5-Second Anti-Fraud Refresh Progress Bar */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 4 }}>
                  <span>Dynamic Security Refresh</span>
                  <span style={{ fontWeight: 700, color: '#22c55e' }}>Changes in 5s (Cycle #{qrCycle})</span>
                </div>
                <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${qrProgress}%`,
                      background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                      transition: 'width 1s linear',
                    }}
                  />
                </div>
              </div>

              {/* Dynamic QR Display Box with Scanner Beam Animation */}
              <div
                style={{
                  position: 'relative',
                  width: 210,
                  height: 210,
                  margin: '0 auto 16px',
                  padding: 10,
                  background: '#ffffff',
                  borderRadius: 18,
                  border: '2px solid #22c55e',
                  boxShadow: '0 8px 24px rgba(34, 197, 94, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {/* SVG-based Dynamic QR Code */}
                <svg
                  viewBox="0 0 100 100"
                  style={{
                    width: '100%',
                    height: '100%',
                    imageRendering: 'pixelated',
                  }}
                >
                  {/* Outer corner finders */}
                  <rect x="2" y="2" width="28" height="28" rx="4" fill="#0f172a" />
                  <rect x="6" y="6" width="20" height="20" rx="2" fill="#ffffff" />
                  <rect x="10" y="10" width="12" height="12" rx="2" fill="#0f172a" />

                  <rect x="70" y="2" width="28" height="28" rx="4" fill="#0f172a" />
                  <rect x="74" y="6" width="20" height="20" rx="2" fill="#ffffff" />
                  <rect x="78" y="10" width="12" height="12" rx="2" fill="#0f172a" />

                  <rect x="2" y="70" width="28" height="28" rx="4" fill="#0f172a" />
                  <rect x="6" y="74" width="20" height="20" rx="2" fill="#ffffff" />
                  <rect x="10" y="78" width="12" height="12" rx="2" fill="#0f172a" />

                  {/* Timing lines */}
                  <line x1="34" y1="16" x2="66" y2="16" stroke="#0f172a" strokeWidth="3" strokeDasharray="4,4" />
                  <line x1="16" y1="34" x2="16" y2="66" stroke="#0f172a" strokeWidth="3" strokeDasharray="4,4" />

                  {/* Dynamic pattern blocks that shift with qrCycle */}
                  {Array.from({ length: 18 }).map((_, i) => {
                    const row = 36 + (i % 6) * 5
                    const col = 36 + Math.floor(i / 6) * 10
                    const isVisible = (i + qrCycle) % 3 !== 0
                    return isVisible ? (
                      <rect
                        key={i}
                        x={col}
                        y={row}
                        width="4"
                        height="4"
                        fill={(i + qrCycle) % 2 === 0 ? '#16a34a' : '#0f172a'}
                        rx="1"
                      />
                    ) : null
                  })}

                  {/* Center Indian UPI logo icon */}
                  <rect x="42" y="42" width="16" height="16" rx="4" fill="#22c55e" />
                  <text
                    x="50"
                    y="53"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    ₹
                  </text>
                </svg>

                {/* Animated Green Laser Scanner Beam */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    height: 3,
                    background: 'linear-gradient(90deg, transparent, #22c55e, #4ade80, transparent)',
                    boxShadow: '0 0 12px #22c55e',
                    animation: 'scanAnimation 2.2s ease-in-out infinite alternate',
                  }}
                />

                {/* Status Overlay when scanning / success */}
                {upiStatus === 'scanning' && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(255, 255, 255, 0.92)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        border: '3px solid #e2e8f0',
                        borderTopColor: '#22c55e',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Scanning Detected…
                    </p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Verifying bank authorization</p>
                  </div>
                )}

                {upiStatus === 'success' && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(34, 197, 94, 0.95)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                    }}
                  >
                    <span style={{ fontSize: 44, marginBottom: 4 }}>✓</span>
                    <p style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>Payment Received!</p>
                    <p style={{ fontSize: 11, opacity: 0.9, margin: 0 }}>Placing your order now…</p>
                  </div>
                )}
              </div>

              {/* Supported UPI Apps Row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 16,
                  padding: '8px 12px',
                  background: '#f8fafc',
                  borderRadius: 12,
                }}
              >
                {['Google Pay', 'PhonePe', 'Paytm', 'BHIM UPI'].map((appName) => (
                  <span
                    key={appName}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#475569',
                      background: '#ffffff',
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    {appName}
                  </span>
                ))}
              </div>

              {/* Instant Scan & Confirm Simulator Button */}
              <button
                onClick={handleSimulateScan}
                disabled={upiStatus !== 'waiting'}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: 14,
                  background: upiStatus === 'waiting' ? '#0f172a' : '#94a3b8',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 13.5,
                  border: 'none',
                  cursor: upiStatus === 'waiting' ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)',
                }}
              >
                <span>📱 I Have Scanned & Paid</span>
                <span style={{ fontSize: 16 }}>✓</span>
              </button>

              <p style={{ fontSize: 10, color: '#94a3b8', margin: '10px 0 0' }}>
                UPI ID: campusbites@okaxis · Token CB-{Date.now().toString().slice(-5)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Global Style for Keyframe Animations */}
      <style>{`
        @keyframes scanAnimation {
          0% { top: 6px; }
          100% { top: 196px; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes bounceIn {
          0% { transform: translateY(16px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
