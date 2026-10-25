import { useState, useEffect, useCallback, useRef } from 'react'
import type { Order, OrderStatus } from '../lib/orders'
import {
  fetchStaffOrders,
  fetchStaffStats,
  updateStaffOrderStatus,
  collectCashPayment,
  subscribeToAllOrders,
  verifyStaffRole,
} from '../lib/staff'

type Props = {
  onBackToCustomer: () => void
}

const TABS: Array<{ key: string; label: string; countKey?: string }> = [
  { key: 'ALL', label: 'All Orders' },
  { key: 'PLACED', label: 'Incoming' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'PREPARING', label: 'In Kitchen' },
  { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
  { key: 'PICKED_UP', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
]

export default function StaffDashboard({ onBackToCustomer }: Props) {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false)
  const [authError, setAuthError] = useState('')
  const [verifyingAuth, setVerifyingAuth] = useState(false)

  // Verify staff role against backend on mount
  useEffect(() => {
    verifyStaffRole().then((ok) => {
      if (ok) setIsAuthorized(true)
    })
  }, [])

  // Orders State
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedTab, setSelectedTab] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    placed: 0,
    accepted: 0,
    preparing: 0,
    ready: 0,
    pickedUp: 0,
    cancelled: 0,
    totalRevenue: 0,
  })

  // Action status state
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [cancelModalOrderId, setCancelModalOrderId] = useState<string | null>(null)
  const [cancellationReason, setCancellationReason] = useState('Out of stock')
  const [newOrderAlert, setNewOrderAlert] = useState<string | null>(null)

  // Sound ref (web audio chime)
  const audioContextRef = useRef<AudioContext | null>(null)

  const playChime = useCallback(() => {
    try {
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = ctx
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1) // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
    } catch (e) {}
  }, [])

  // Load orders and stats
  const loadData = useCallback(async () => {
    try {
      const [fetchedOrders, fetchedStats] = await Promise.all([
        fetchStaffOrders(selectedTab),
        fetchStaffStats(),
      ])
      setOrders(fetchedOrders)
      setStats(fetchedStats)
      setLoading(false)
    } catch (err) {
      console.warn('Error fetching staff data:', err)
      setLoading(false)
    }
  }, [selectedTab])

  useEffect(() => {
    if (isAuthorized) {
      loadData()
    }
  }, [isAuthorized, loadData])

  // Setup Real-Time subscription for canteen orders
  useEffect(() => {
    if (!isAuthorized) return

    const unsub = subscribeToAllOrders(
      (updatedOrder) => {
        setOrders((prev) =>
          prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
        )
        fetchStaffStats().then(setStats)
      },
      (newOrder) => {
        setOrders((prev) => [newOrder, ...prev])
        setNewOrderAlert(`New Order #${newOrder.order_number} Received!`)
        playChime()
        fetchStaffStats().then(setStats)
        setTimeout(() => setNewOrderAlert(null), 5000)
      }
    )

    // Fallback polling every 5s
    const timer = setInterval(loadData, 5000)

    return () => {
      unsub()
      clearInterval(timer)
    }
  }, [isAuthorized, loadData, playChime])

  // Handle Passkey verification
  const handleVerifyPasskey = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifyingAuth(true)
    setAuthError('')
    const ok = await verifyStaffRole()
    setVerifyingAuth(false)
    if (ok) {
      setIsAuthorized(true)
    } else {
      setAuthError('Unauthorized: Your active session does not have staff permissions. Please sign in with an authorized canteen staff account (e.g. staff.canteen@campusbites.edu).')
    }
  }

  // Handle stage transitions
  const handleTransition = async (orderId: string, nextStatus: OrderStatus) => {
    setBusyOrderId(orderId)
    setActionError(null)
    try {
      const updated = await updateStaffOrderStatus(orderId, nextStatus)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)))
      await fetchStaffStats().then(setStats)
    } catch (err: any) {
      setActionError(err.message || 'Failed to update order status.')
    } finally {
      setBusyOrderId(null)
    }
  }

  // Handle cash collection
  const handleCollectCash = async (orderId: string) => {
    setBusyOrderId(orderId)
    setActionError(null)
    try {
      await collectCashPayment(orderId)
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, payment_status: 'PAID' } : o))
      )
    } catch (err: any) {
      setActionError(err.message || 'Failed to record cash payment.')
    } finally {
      setBusyOrderId(null)
    }
  }

  // Handle Order Cancellation
  const handleConfirmCancel = async () => {
    if (!cancelModalOrderId) return
    setBusyOrderId(cancelModalOrderId)
    try {
      const updated = await updateStaffOrderStatus(
        cancelModalOrderId,
        'CANCELLED',
        undefined,
        cancellationReason
      )
      setOrders((prev) => prev.map((o) => (o.id === cancelModalOrderId ? updated : o)))
      setCancelModalOrderId(null)
      await fetchStaffStats().then(setStats)
    } catch (err: any) {
      alert(err.message || 'Failed to cancel order.')
    } finally {
      setBusyOrderId(null)
    }
  }

  // If not authorized yet, show Passkey Entry Screen
  if (!isAuthorized) {
    return (
      <div
        style={{
          minHeight: '100%',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          padding: '32px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 360,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 24,
            padding: '28px 24px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
            }}
          >
            👨‍🍳
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: '#f8fafc' }}>
            Canteen Staff Portal
          </h2>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.4 }}>
            Verified staff authorization is required to access live kitchen order dispatch and queue controls.
          </p>

          <form onSubmit={handleVerifyPasskey}>
            <div style={{ textAlign: 'left', marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
                Sign in with your canteen staff account (e.g. <code>staff.canteen@campusbites.edu</code>) to manage orders.
              </span>
            </div>

            {authError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontSize: 12,
                  marginBottom: 16,
                  textAlign: 'left',
                }}
              >
                ⚠️ {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={verifyingAuth}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
              }}
            >
              {verifyingAuth ? 'Verifying…' : 'Authenticate Staff Access →'}
            </button>
          </form>

          <button
            onClick={onBackToCustomer}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 13,
              marginTop: 18,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ← Return to Student App
          </button>
        </div>
      </div>
    )
  }

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    if (selectedTab === 'ALL') return true
    return o.status === selectedTab
  })

  return (
    <div style={{ background: '#0f172a', minHeight: '100%', color: '#f8fafc', paddingBottom: 40 }}>
      {/* Top Staff Header */}
      <div
        style={{
          background: '#1e293b',
          borderBottom: '1px solid #334155',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>👨‍🍳</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                Canteen Kitchen Portal
              </h1>
              <span
                style={{
                  background: '#064e3b',
                  color: '#34d399',
                  fontSize: 9.5,
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 6px #10b981',
                  }}
                />
                LIVE
              </span>
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>
              Real-time student order queue & stage dispatcher
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={loadData}
            title="Refresh Orders"
            style={{
              background: '#334155',
              border: 'none',
              borderRadius: 8,
              padding: '6px 10px',
              color: '#cbd5e1',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            🔄
          </button>
          <button
            onClick={() => {
              setIsAuthorized(false)
              onBackToCustomer()
            }}
            style={{
              background: '#e11d48',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              color: '#ffffff',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Exit Portal
          </button>
        </div>
      </div>

      {/* New Order Alert Banner */}
      {newOrderAlert && (
        <div
          style={{
            background: 'linear-gradient(90deg, #10b981, #059669)',
            color: '#ffffff',
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
            animation: 'pulse 1.5s infinite',
          }}
        >
          <span>🔔 {newOrderAlert}</span>
          <button
            onClick={() => setNewOrderAlert(null)}
            style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: 14, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            borderLeft: '4px solid #ef4444',
            color: '#fca5a5',
            padding: '10px 16px',
            fontSize: 12.5,
            margin: '12px 16px 0',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>⚠️ {actionError}</span>
          <button
            onClick={() => setActionError(null)}
            style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats Quick Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          padding: '16px 16px 10px',
        }}
      >
        <div style={{ background: '#1e293b', padding: '10px 8px', borderRadius: 12, textAlign: 'center', border: '1px solid #334155' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8' }}>{stats.placed}</span>
          <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0', fontWeight: 700 }}>Incoming</p>
        </div>
        <div style={{ background: '#1e293b', padding: '10px 8px', borderRadius: 12, textAlign: 'center', border: '1px solid #334155' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>{stats.preparing}</span>
          <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0', fontWeight: 700 }}>In Kitchen</p>
        </div>
        <div style={{ background: '#1e293b', padding: '10px 8px', borderRadius: 12, textAlign: 'center', border: '1px solid #334155' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#4ade80' }}>{stats.ready}</span>
          <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0', fontWeight: 700 }}>Ready</p>
        </div>
        <div style={{ background: '#1e293b', padding: '10px 8px', borderRadius: 12, textAlign: 'center', border: '1px solid #334155' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#a78bfa' }}>{stats.pickedUp}</span>
          <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0', fontWeight: 700 }}>Served</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          padding: '4px 16px 12px',
          scrollbarWidth: 'none',
        }}
      >
        {TABS.map((t) => {
          const active = selectedTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setSelectedTab(t.key)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                fontSize: 11.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                border: 'none',
                cursor: 'pointer',
                background: active ? '#10b981' : '#1e293b',
                color: active ? '#ffffff' : '#94a3b8',
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Orders List */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>
            ⏳ Loading live orders…
          </div>
        ) : filteredOrders.length === 0 ? (
          <div
            style={{
              background: '#1e293b',
              borderRadius: 16,
              padding: '36px 20px',
              textAlign: 'center',
              border: '1px dashed #334155',
            }}
          >
            <span style={{ fontSize: 36, display: 'block', marginBottom: 8 }}>🍽️</span>
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: '#f8fafc' }}>
              No orders in this stage
            </p>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              Orders will automatically arrive here in real time via Supabase!
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isBusy = busyOrderId === order.id
            const isCashDue = order.payment === 'cash' && order.payment_status !== 'PAID'

            return (
              <div
                key={order.id}
                style={{
                  background: '#1e293b',
                  borderRadius: 18,
                  border:
                    order.status === 'READY_FOR_PICKUP'
                      ? '2px solid #10b981'
                      : order.status === 'PREPARING'
                      ? '1.5px solid #f59e0b'
                      : '1px solid #334155',
                  padding: 16,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  position: 'relative',
                }}
              >
                {/* Header Line */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          background: '#0f172a',
                          color: '#38bdf8',
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 900,
                          letterSpacing: '0.04em',
                          border: '1px solid #334155',
                        }}
                      >
                        TOKEN #{order.token_number}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>
                        {order.order_number}
                      </span>
                    </div>
                    <span style={{ fontSize: 10.5, color: '#64748b', display: 'block', marginTop: 4 }}>
                      Placed at {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {order.eta_minutes} min prep ETA
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {/* Payment Badge */}
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 800,
                        background:
                          order.payment_status === 'PAID'
                            ? '#064e3b'
                            : order.payment === 'cash'
                            ? '#7c2d12'
                            : '#78350f',
                        color:
                          order.payment_status === 'PAID'
                            ? '#34d399'
                            : order.payment === 'cash'
                            ? '#fdba74'
                            : '#fde047',
                      }}
                    >
                      {order.payment_status === 'PAID'
                        ? `${order.payment.toUpperCase()} PAID ✓`
                        : `CASH DUE (₹${order.total})`}
                    </span>

                    {/* Order Status Badge */}
                    <div style={{ marginTop: 4 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color:
                            order.status === 'READY_FOR_PICKUP'
                              ? '#4ade80'
                              : order.status === 'PREPARING'
                              ? '#fbbf24'
                              : order.status === 'CANCELLED'
                              ? '#f87171'
                              : '#94a3b8',
                        }}
                      >
                        ● {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div
                  style={{
                    background: '#0f172a',
                    borderRadius: 12,
                    padding: '10px 12px',
                    marginBottom: 12,
                  }}
                >
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: '#e2e8f0',
                        padding: '3px 0',
                      }}
                    >
                      <span>
                        <strong style={{ color: '#38bdf8' }}>{item.quantity}×</strong> {item.name}
                      </span>
                      <span style={{ color: '#94a3b8' }}>₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                  <div
                    style={{
                      borderTop: '1px solid #1e293b',
                      marginTop: 6,
                      paddingTop: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#f8fafc',
                    }}
                  >
                    <span>Total Amount</span>
                    <span style={{ color: '#10b981' }}>₹{order.total}</span>
                  </div>
                </div>

                {/* Action Buttons for Kitchen Staff */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {/* Step 1: PLACED -> ACCEPTED */}
                  {order.status === 'PLACED' && (
                    <button
                      disabled={isBusy}
                      onClick={() => handleTransition(order.id, 'ACCEPTED')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: 10,
                        background: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {isBusy ? 'Updating…' : '✓ Accept Ticket'}
                    </button>
                  )}

                  {/* Step 2: ACCEPTED -> PREPARING */}
                  {order.status === 'ACCEPTED' && (
                    <button
                      disabled={isBusy}
                      onClick={() => handleTransition(order.id, 'PREPARING')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: 10,
                        background: '#d97706',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {isBusy ? 'Updating…' : '🍳 Start Cooking'}
                    </button>
                  )}

                  {/* Step 3: PREPARING -> READY_FOR_PICKUP */}
                  {order.status === 'PREPARING' && (
                    <button
                      disabled={isBusy}
                      onClick={() => handleTransition(order.id, 'READY_FOR_PICKUP')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: 10,
                        background: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {isBusy ? 'Updating…' : '🔔 Ready for Pickup!'}
                    </button>
                  )}

                  {/* Step 4: READY_FOR_PICKUP -> PICKED_UP */}
                  {order.status === 'READY_FOR_PICKUP' && (
                    <button
                      disabled={isBusy}
                      onClick={() => handleTransition(order.id, 'PICKED_UP')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: 10,
                        background: '#059669',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {isBusy ? 'Updating…' : '✅ Handed Over (Complete)'}
                    </button>
                  )}

                  {/* Collect Cash Button */}
                  {isCashDue && order.status !== 'CANCELLED' && (
                    <button
                      disabled={isBusy}
                      onClick={() => handleCollectCash(order.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: '#4338ca',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: 11.5,
                        cursor: 'pointer',
                      }}
                    >
                      💵 Collect ₹{order.total}
                    </button>
                  )}

                  {/* Cancel Button (permitted only before READY_FOR_PICKUP) */}
                  {['PLACED', 'ACCEPTED', 'PREPARING'].includes(order.status) && (
                    <button
                      disabled={isBusy}
                      onClick={() => setCancelModalOrderId(order.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'transparent',
                        color: '#f87171',
                        border: '1px solid #7f1d1d',
                        fontWeight: 700,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Cancellation Modal */}
      {cancelModalOrderId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#1e293b',
              borderRadius: 20,
              padding: 24,
              maxWidth: 360,
              width: '100%',
              border: '1px solid #334155',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', margin: '0 0 8px' }}>
              Cancel Order Ticket
            </h3>
            <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '0 0 16px' }}>
              Please select a cancellation reason. The customer will be informed immediately in real time.
            </p>

            <select
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 10,
                background: '#0f172a',
                color: '#f8fafc',
                border: '1px solid #334155',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <option value="Item ingredients out of stock">Item ingredients out of stock</option>
              <option value="Kitchen equipment issue">Kitchen equipment issue</option>
              <option value="Counter closed for rush maintenance">Counter closed for rush maintenance</option>
              <option value="Customer requested cancellation">Customer requested cancellation</option>
            </select>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setCancelModalOrderId(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  background: '#334155',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Keep Order
              </button>
              <button
                onClick={handleConfirmCancel}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  background: '#e11d48',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
