import { useState } from 'react'
import type { CartItem } from '../App'

type Props = { cart: CartItem[]; updateQty: (id: number, delta: number) => void }

const PAYMENT = [
  { key: 'cash', label: 'Cash', sub: 'Pay at counter', icon: '💵' },
  { key: 'upi',  label: 'UPI',  sub: 'GPay · PhonePe', icon: '📱' },
  { key: 'card', label: 'Card', sub: 'Debit or Credit',  icon: '💳' },
]

export default function CartPage({ cart, updateQty }: Props) {
  const [payment, setPayment] = useState('cash')
  const [placed, setPlaced] = useState(false)

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const tax = Math.round(subtotal * 0.05)
  const packing = cart.length > 0 ? 10 : 0
  const total = subtotal + tax + packing

  if (placed) {
    return (
      <div style={{ padding: 24, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a', margin: '0 0 8px' }}>Order Placed!</h2>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>Your order #CB{Math.floor(Math.random()*90000+10000)} is being prepared.</p>
        <button
          onClick={() => setPlaced(false)}
          style={{ padding: '12px 32px', borderRadius: 12, background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 15 }}
        >
          Track Order →
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: '#f8f8f8', minHeight: '100%' }}>
      <div style={{ background: '#fff', padding: '20px 20px 16px', marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 2px', color: '#1a1a1a' }}>Cart</h1>
        <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>Your order</p>
      </div>

      {cart.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Your cart is empty</p>
          <p style={{ fontSize: 13, color: '#aaa' }}>Add something from the menu!</p>
        </div>
      ) : (
        <>
          {/* Cart items */}
          <div style={{ background: '#fff', padding: '0 20px', marginBottom: 8 }}>
            {cart.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 0',
                borderBottom: '1px solid #f5f5f5',
              }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, overflow: 'hidden', background: '#f5f5f5', flexShrink: 0 }}>
                  <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#1a1a1a' }}>{item.name}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => updateQty(item.id, -1)}
                    style={{
                      width: 28, height: 28, borderRadius: 6, border: '1.5px solid #e0e0e0',
                      background: '#fff', fontSize: 16, color: '#555',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >−</button>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', minWidth: 16, textAlign: 'center' }}>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQty(item.id, 1)}
                    style={{
                      width: 28, height: 28, borderRadius: 6, border: 'none',
                      background: '#22c55e', fontSize: 16, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >+</button>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', minWidth: 40, textAlign: 'right' }}>
                  ₹{item.price * item.quantity}
                </span>
              </div>
            ))}
            <button style={{
              width: '100%', padding: '12px 0',
              color: '#22c55e', fontWeight: 600, fontSize: 13,
              border: '1.5px dashed #22c55e', borderRadius: 10, marginTop: 12, marginBottom: 4,
            }}>
              + Add more items
            </button>
          </div>

          {/* Payment method */}
          <div style={{ background: '#fff', padding: '16px 20px', marginBottom: 8 }}>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px', color: '#1a1a1a' }}>Payment method</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {PAYMENT.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPayment(p.key)}
                  style={{
                    padding: '12px 8px', borderRadius: 12,
                    border: '1.5px solid ' + (payment === p.key ? '#22c55e' : '#e8e8e8'),
                    background: payment === p.key ? '#f0fdf4' : '#fff',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{p.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>{p.label}</span>
                  <span style={{ fontSize: 10, color: '#aaa', lineHeight: 1.3, textAlign: 'center' }}>{p.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pickup info */}
          <div style={{ background: '#fff', padding: '14px 20px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#22c55e', fontSize: 16 }}>⏱</span>
                <span style={{ fontSize: 13, color: '#555' }}>Pickup in</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>14–19 min</span>
            </div>
          </div>

          {/* Order summary */}
          <div style={{ background: '#fff', padding: '16px 20px', marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px', color: '#1a1a1a' }}>Order summary</p>
            {[
              ['Subtotal', `₹${subtotal}`],
              ['Tax', `₹${tax}`],
              ['Packing', `₹${packing}`],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
                <span style={{ fontSize: 13, color: '#555' }}>{val}</span>
              </div>
            ))}
            <div style={{ height: 1, background: '#f0f0f0', margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>Total</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a' }}>₹{total}</span>
            </div>
          </div>

          <div style={{ padding: '0 20px 24px' }}>
            <button
              onClick={() => setPlaced(true)}
              style={{
                width: '100%', padding: '15px',
                borderRadius: 14, background: '#22c55e',
                color: '#fff', fontWeight: 700, fontSize: 15,
              }}
            >
              Place order · ₹{total}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
