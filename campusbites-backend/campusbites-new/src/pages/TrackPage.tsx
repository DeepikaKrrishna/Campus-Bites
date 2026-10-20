import { useState, useEffect, useCallback } from 'react'
import { getOrders, rateOrder, subscribeToOrder, type Order } from '../lib/orders'
import type { AppUser } from '../lib/auth'

const STEPS = [
  { label: 'Order Placed',       sub: 'Order received at the counter' },
  { label: 'Payment Confirmed',  sub: 'Payment successfully processed' },
  { label: 'Being Prepared',     sub: 'The canteen is preparing your food' },
  { label: 'Ready for Pickup',   sub: 'Collect from the pickup window' },
]

export default function TrackPage({ user }: { user: AppUser }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [rating, setRating] = useState(0)
  const [rated, setRated] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadOrders = useCallback(async () => {
    const data = await getOrders(user.id)
    setOrders(data)
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadOrders() }, [loadOrders])

  // Demo mode: listen for custom events
  useEffect(() => {
    const handler = () => loadOrders()
    window.addEventListener('cb:order-update', handler)
    return () => window.removeEventListener('cb:order-update', handler)
  }, [loadOrders])

  // Supabase realtime for the latest order
  useEffect(() => {
    if (!orders.length) return
    const unsub = subscribeToOrder(orders[0].id, (updated) => {
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
    })
    return unsub
  }, [orders.length > 0 ? orders[0].id : ''])

  // Auto-refresh every 5s for demo mode
  useEffect(() => {
    const t = setInterval(loadOrders, 5000)
    return () => clearInterval(t)
  }, [loadOrders])

  const latest = orders[0]
  const past = orders.slice(1)

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#aaa', fontSize: 14 }}>Loading orders…</p>
      </div>
    )
  }

  if (!latest) {
    return (
      <div style={{ background: '#f8f8f8', minHeight: '100%', padding: '24px 20px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: '#1a1a1a' }}>Track your order</h1>
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>No orders yet</p>
          <p style={{ fontSize: 13, color: '#aaa' }}>Once you place an order, you can track it here.</p>
        </div>
      </div>
    )
  }

  const isReady = latest.stage === 3

  return (
    <div style={{ background: '#f8f8f8', minHeight: '100%', padding: '24px 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: '#1a1a1a' }}>Track your order</h1>
      <p style={{ fontSize: 13, color: '#aaa', margin: '0 0 20px' }}>
        {isReady ? 'Your food is ready at the pickup window!' : 'Live status from the canteen'}
      </p>

      {/* Status banner */}
      {latest.stage === 0 && (
        <div style={{ background: '#22c55e', borderRadius: 14, padding: '16px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff' }}>✓</div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>Order placed successfully!</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: 0 }}>Paid ₹{latest.total} via {latest.payment}</p>
          </div>
        </div>
      )}

      {isReady && (
        <div style={{ background: '#22c55e', borderRadius: 14, padding: '16px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff' }}>✓</div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>Ready for pickup!</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: 0 }}>Show order #{latest.order_number} at the counter</p>
          </div>
        </div>
      )}

      {/* Order info */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 4px' }}>Order number</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', margin: '0 0 4px' }}>#{latest.order_number}</p>
            <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>
              {latest.items.reduce((s: number, i: any) => s + i.quantity, 0)} items · ₹{latest.total} · {latest.payment}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 4px' }}>{isReady ? 'Status' : 'ETA'}</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: isReady ? '#22c55e' : '#f59e0b', margin: 0 }}>
              {isReady ? 'Ready!' : `${latest.eta_minutes} min`}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
        {STEPS.map((step, i) => {
          const done = i < latest.stage
          const current = i === latest.stage
          const isLast = i === STEPS.length - 1
          return (
            <div key={step.label} style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 20, position: 'relative' }}>
              {!isLast && (
                <div style={{ position: 'absolute', left: 15, top: 32, bottom: 0, width: 2, background: done ? '#22c55e' : '#e8e8e8' }} />
              )}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                background: done ? '#22c55e' : current ? '#f59e0b' : '#e8e8e8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                boxShadow: current ? '0 0 0 4px rgba(245,158,11,0.2)' : 'none',
                transition: 'all 0.5s ease',
              }}>
                {done && <span style={{ color: '#fff' }}>✓</span>}
                {current && <span style={{ color: '#fff', fontSize: 10 }}>●</span>}
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: done || current ? '#1a1a1a' : '#ccc', margin: '0 0 3px', transition: 'color 0.3s' }}>{step.label}</p>
                <p style={{ fontSize: 12, color: done || current ? '#888' : '#ddd', margin: 0, transition: 'color 0.3s' }}>{step.sub}{current && i < 3 ? '…' : ''}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Rating */}
      {isReady && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
          {rated || latest.rating ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', margin: '0 0 8px' }}>Thanks for your rating!</p>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 24, color: s <= (latest.rating ?? rating) ? '#f59e0b' : '#ddd' }}>★</span>)}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>⭐</span>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Don't forget to rate!</p>
              </div>
              <p style={{ fontSize: 13, color: '#888', margin: '0 0 14px' }}>Help your fellow foodies — how was the food?</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setRating(s)} style={{ fontSize: 32, color: s <= rating ? '#f59e0b' : '#ddd', transition: 'transform 0.15s', transform: s <= rating ? 'scale(1.15)' : 'scale(1)' }}>★</button>
                ))}
              </div>
              <button
                disabled={!rating}
                onClick={async () => { await rateOrder(latest.id, rating); setRated(true); loadOrders() }}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12,
                  background: rating ? '#22c55e' : '#e8e8e8',
                  color: rating ? '#fff' : '#888', fontWeight: 600, fontSize: 14,
                  transition: 'all 0.2s',
                }}
              >
                Submit rating
              </button>
            </>
          )}
        </div>
      )}

      {/* Items */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Items</p>
        {latest.items.map((item: any) => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#555' }}>{item.quantity}× {item.name}</span>
            <span style={{ fontSize: 13, color: '#555' }}>₹{item.price * item.quantity}</span>
          </div>
        ))}
        <div style={{ height: 1, background: '#f0f0f0', margin: '10px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Paid via {latest.payment}</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>₹{latest.total}</span>
        </div>
      </div>

      {/* Earlier orders */}
      {past.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Earlier orders</p>
          {past.slice(0, 5).map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>#{o.order_number}</p>
                <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>₹{o.total}</span>
                {o.rating && <p style={{ fontSize: 10, color: '#f59e0b', margin: '2px 0 0' }}>{o.rating}★</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}
