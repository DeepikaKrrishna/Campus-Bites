import { useState, useEffect, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { getOrders, rateOrder, subscribeToOrder, type Order } from '../lib/orders'
import type { AppUser } from '../lib/auth'
import type { Tab } from '../App'

type Props = {
  user: AppUser | null
  onTabChange?: (tab: Tab) => void
  onReorder?: (items: Order['items']) => void
}

const STAGES = [
  {
    stage: 0,
    label: 'Order Placed',
    sub: 'Order received at canteen counter',
    icon: '📝',
    duration: '0-2 min',
  },
  {
    stage: 1,
    label: 'Payment Confirmed',
    sub: 'Kitchen has accepted your order ticket',
    icon: '💳',
    duration: '2-4 min',
  },
  {
    stage: 2,
    label: 'Cooking in Kitchen',
    sub: 'Chef is preparing your meal fresh and hot',
    icon: '🍳',
    duration: '4-10 min',
  },
  {
    stage: 3,
    label: 'Quality Check & Packing',
    sub: 'Packed in eco container with condiments',
    icon: '📦',
    duration: '10-13 min',
  },
  {
    stage: 4,
    label: 'Ready for Pickup! 🎉',
    sub: 'Collect from Pickup Window (Counter 2)',
    icon: '🔔',
    duration: 'Ready',
  },
]

const RATING_TAGS = [
  '🔥 Hot & Fresh',
  '⚡ Super Quick',
  '🤤 Delicious',
  '💰 Great Value',
  '📦 Clean Packaging',
  '☕ Perfect Coffee',
]

export default function TrackPage({ user, onTabChange, onReorder }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  // Rating interactive state
  const [selectedRating, setSelectedRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>(['🔥 Hot & Fresh'])
  const [feedbackComment, setFeedbackComment] = useState('')
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [submittingRating, setSubmittingRating] = useState(false)

  // Live countdown timer state (in seconds)
  const [remainingSecs, setRemainingSecs] = useState<number>(780) // 13 mins

  const loadOrders = useCallback(async () => {
    const currentUserId = user?.id || 'demo-student'
    const data = await getOrders(currentUserId)
    setOrders(data)
    setLoading(false)

    if (data.length > 0 && data[0].rating) {
      setSelectedRating(data[0].rating)
      setRatingSubmitted(true)
    }
  }, [user])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Listen to order updates from local demo tracking
  useEffect(() => {
    const handler = () => {
      loadOrders()
    }
    window.addEventListener('cb:order-update', handler)
    return () => window.removeEventListener('cb:order-update', handler)
  }, [loadOrders])

  // Supabase realtime subscription for active order
  useEffect(() => {
    if (!orders.length) return
    const activeOrder = orders[0]
    const unsub = subscribeToOrder(activeOrder.id, (updated) => {
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
    })
    return unsub
  }, [orders.length > 0 ? orders[0].id : ''])

  // Auto-refresh fallback every 4 seconds
  useEffect(() => {
    const interval = setInterval(loadOrders, 4000)
    return () => clearInterval(interval)
  }, [loadOrders])

  // Active countdown timer ticker
  useEffect(() => {
    const active = orders[0]
    if (!active) return

    // Calculate initial remaining seconds based on stage
    const totalSecs = (active.eta_minutes || 15) * 60
    const stageProgress = active.stage / 4
    const initialRemaining = Math.max(0, Math.round(totalSecs * (1 - stageProgress)))
    setRemainingSecs(initialRemaining)

    const timer = setInterval(() => {
      setRemainingSecs((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [orders.length > 0 ? orders[0]?.stage : 0])

  const activeOrder = orders[0]
  const pastOrders = orders.slice(1)

  const handleRatingSubmit = async () => {
    if (!activeOrder) return
    setSubmittingRating(true)

    try {
      await rateOrder(activeOrder.id, selectedRating, feedbackComment, selectedTags)
      setRatingSubmitted(true)

      // Confetti burst for rewarding user feedback
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.65 },
          colors: ['#22c55e', '#38bdf8', '#fbbf24', '#f43f5e'],
        })
      } catch (e) {
        // ignore if canvas not supported
      }
    } catch (err) {
      console.error('Failed submitting rating:', err)
    } finally {
      setSubmittingRating(false)
    }
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '3px solid #e2e8f0',
            borderTopColor: '#22c55e',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <p style={{ color: '#64748b', fontSize: 14, fontWeight: 600 }}>Loading your live orders…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!activeOrder) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100%', padding: '32px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>
          Track Your Order
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 48px' }}>
          Live kitchen preparation updates
        </p>

        <div style={{ fontSize: 60, marginBottom: 16 }}>🥡</div>
        <p style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
          No Active Orders
        </p>
        <p style={{ fontSize: 13, color: '#64748b', maxWidth: 280, margin: '0 auto 24px' }}>
          When you place a food order from the menu or cart, you will see its step-by-step preparation here!
        </p>

        <button
          onClick={() => onTabChange?.('menu')}
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
          Browse Menu Now →
        </button>
      </div>
    )
  }

  const isReady = activeOrder.stage >= 4
  const formattedMinutes = Math.floor(remainingSecs / 60)
  const formattedSeconds = remainingSecs % 60

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%', padding: '20px 20px 32px' }}>
      {/* Page Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 2px', color: '#0f172a' }}>
            Live Order Status
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
            {isReady ? 'Your meal is ready for collection!' : 'Real-time kitchen tracking'}
          </p>
        </div>

        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: isReady ? '#15803d' : '#0369a1',
            background: isReady ? '#dcfce7' : '#e0f2fe',
            padding: '4px 10px',
            borderRadius: 12,
            border: `1px solid ${isReady ? '#86efac' : '#7dd3fc'}`,
          }}
        >
          {isReady ? 'READY FOR PICKUP' : 'PREPARING'}
        </span>
      </div>

      {/* ================= HERO TOKEN & STATUS BANNER ================= */}
      <div
        style={{
          background: isReady
            ? 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)'
            : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: 20,
          padding: '18px 20px',
          marginBottom: 16,
          color: '#ffffff',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, color: isReady ? '#bbf7d0' : '#38bdf8', fontWeight: 800, letterSpacing: '0.08em', margin: '0 0 4px' }}>
              COLLECTION TOKEN
            </p>
            <p style={{ fontSize: 28, fontWeight: 900, margin: '0 0 4px', letterSpacing: '0.05em' }}>
              Token #{activeOrder.token_number || '14'}
            </p>
            <p style={{ fontSize: 12, opacity: 0.9, margin: 0 }}>
              Order #{activeOrder.order_number} · Counter 2 Window
            </p>
          </div>

          {/* Big countdown or Checkmark badge */}
          <div
            style={{
              textAlign: 'center',
              background: 'rgba(255,255,255,0.15)',
              padding: '10px 14px',
              borderRadius: 16,
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            {isReady ? (
              <>
                <span style={{ fontSize: 26, display: 'block' }}>🎉</span>
                <span style={{ fontSize: 11, fontWeight: 800 }}>Ready!</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 18, fontWeight: 900, fontFamily: 'monospace', display: 'block' }}>
                  {formattedMinutes}:{formattedSeconds < 10 ? `0${formattedSeconds}` : formattedSeconds}
                </span>
                <span style={{ fontSize: 10, opacity: 0.85, fontWeight: 600 }}>mins left</span>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar Fill */}
        <div style={{ marginTop: 16 }}>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(12, ((activeOrder.stage + 1) / 5) * 100))}%`,
                background: '#4ade80',
                borderRadius: 3,
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* ================= STEP-BY-STEP PHASES BASED ON TIME ================= */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: '18px 20px',
          marginBottom: 16,
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          border: '1px solid #f1f5f9',
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 800, margin: '0 0 16px', color: '#0f172a' }}>
          Preparation Timeline
        </p>

        <div style={{ position: 'relative' }}>
          {STAGES.map((s, idx) => {
            const isCompleted = activeOrder.stage > s.stage
            const isCurrent = activeOrder.stage === s.stage
            const isPending = activeOrder.stage < s.stage
            const isLast = idx === STAGES.length - 1

            return (
              <div
                key={s.stage}
                style={{
                  display: 'flex',
                  gap: 14,
                  paddingBottom: isLast ? 0 : 20,
                  position: 'relative',
                }}
              >
                {/* Connecting Vertical Track Line */}
                {!isLast && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 17,
                      top: 36,
                      bottom: 0,
                      width: 2.5,
                      background: isCompleted ? '#22c55e' : '#e2e8f0',
                      transition: 'background 0.3s ease',
                    }}
                  />
                )}

                {/* Step Circle with Icon */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    flexShrink: 0,
                    zIndex: 2,
                    background: isCompleted
                      ? '#22c55e'
                      : isCurrent
                      ? 'linear-gradient(135deg, #0284c7, #38bdf8)'
                      : '#f1f5f9',
                    border: isCurrent
                      ? '3px solid #bae6fd'
                      : isCompleted
                      ? '2px solid #86efac'
                      : '2px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    color: isCompleted || isCurrent ? '#ffffff' : '#94a3b8',
                    boxShadow: isCurrent ? '0 0 0 4px rgba(56, 189, 248, 0.25)' : 'none',
                    animation: isCurrent ? 'pulseRing 2s infinite' : 'none',
                  }}
                >
                  {isCompleted ? '✓' : isCurrent ? s.icon : <span style={{ fontSize: 11 }}>{idx + 1}</span>}
                </div>

                {/* Step Label & Description */}
                <div style={{ flex: 1, paddingTop: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: isCurrent ? 800 : isCompleted ? 700 : 500,
                        color: isCurrent ? '#0284c7' : isCompleted ? '#0f172a' : '#94a3b8',
                        margin: 0,
                      }}
                    >
                      {s.label}
                    </p>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: isCurrent ? '#0284c7' : '#94a3b8',
                      }}
                    >
                      {s.duration}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: isPending ? '#cbd5e1' : '#64748b',
                      margin: 0,
                      lineHeight: 1.35,
                    }}
                  >
                    {s.sub}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ================= INTERACTIVE RATING SECTION ================= */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: '20px',
          marginBottom: 16,
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          border: '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>⭐</span>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Rate Your Canteen Experience
            </p>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              Help canteen chefs improve dishes & service
            </p>
          </div>
        </div>

        {ratingSubmitted ? (
          <div
            style={{
              background: '#f0fdf4',
              borderRadius: 14,
              padding: '16px',
              textAlign: 'center',
              border: '1.5px solid #bbf7d0',
              marginTop: 12,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 4 }}>🎉</div>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#15803d', margin: '0 0 2px' }}>
              Rating Submitted! ⭐ {selectedRating}/5
            </p>
            <p style={{ fontSize: 12, color: '#16a34a', margin: '0 0 10px' }}>
              Thank you for supporting our campus food staff!
            </p>
            <button
              onClick={() => setRatingSubmitted(false)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#15803d',
                background: '#ffffff',
                border: '1px solid #86efac',
                padding: '4px 12px',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Update Rating ✏️
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {/* Interactive Stars */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '10px 0',
              }}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating ?? selectedRating) >= star
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSelectedRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: 34,
                      color: isFilled ? '#eab308' : '#e2e8f0',
                      transition: 'transform 0.15s ease, color 0.15s ease',
                      padding: 2,
                    }}
                    title={`${star} Star`}
                  >
                    ★
                  </button>
                )
              })}
            </div>

            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#334155', margin: '0 0 12px' }}>
              {selectedRating === 5 && 'Outstanding! 🌟'}
              {selectedRating === 4 && 'Very Good! 😊'}
              {selectedRating === 3 && 'Good / Satisfactory 👍'}
              {selectedRating === 2 && 'Needs Improvement 😕'}
              {selectedRating === 1 && 'Poor Experience 😞'}
            </p>

            {/* Quick Feedback Tags */}
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '0 0 6px' }}>
              WHAT WENT WELL?
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {RATING_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 16,
                      fontSize: 11.5,
                      fontWeight: 600,
                      border: isSelected ? '1.5px solid #22c55e' : '1px solid #e2e8f0',
                      background: isSelected ? '#f0fdf4' : '#ffffff',
                      color: isSelected ? '#15803d' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>

            {/* Comment Text Area */}
            <textarea
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Any additional feedback for the cook? (Optional)"
              rows={2}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 12,
                border: '1.5px solid #e2e8f0',
                fontSize: 12.5,
                outline: 'none',
                marginBottom: 12,
                fontFamily: 'inherit',
                resize: 'none',
              }}
            />

            {/* Submit Rating Button */}
            <button
              onClick={handleRatingSubmit}
              disabled={submittingRating}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                background: '#22c55e',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 13.5,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {submittingRating ? 'Saving Rating…' : `Submit ${selectedRating}-Star Rating`}
            </button>
          </div>
        )}
      </div>

      {/* ================= ORDERED ITEMS RECEIPT ================= */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: '18px 20px',
          marginBottom: 16,
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          border: '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#0f172a' }}>
            Items in This Order
          </p>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Paid via {activeOrder.payment}
          </span>
        </div>

        {activeOrder.items?.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>
                {item.quantity}×
              </span>
              <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>{item.name}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
              ₹{item.price * item.quantity}
            </span>
          </div>
        ))}

        <div style={{ height: 1, background: '#f1f5f9', margin: '12px 0 10px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Total Paid</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>₹{activeOrder.total}</span>
        </div>
      </div>

      {/* ================= EARLIER ORDERS ================= */}
      {pastOrders.length > 0 && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: '18px 20px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
            border: '1px solid #f1f5f9',
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 800, margin: '0 0 12px', color: '#0f172a' }}>
            Past Orders
          </p>

          {pastOrders.slice(0, 3).map((past) => (
            <div
              key={past.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid #f8fafc',
              }}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>
                  #{past.order_number} · Token #{past.token_number}
                </p>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                  {new Date(past.created_at).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {past.items?.length ?? 1} items
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', display: 'block' }}>
                  ₹{past.total}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#15803d',
                    background: '#dcfce7',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  Completed
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Animation Style */}
      <style>{`
        @keyframes pulseRing {
          0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(56, 189, 248, 0); }
          100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
        }
      `}</style>
    </div>
  )
}
