import { useState, useEffect } from 'react'
import type { AppUser } from '../lib/auth'
import { saveStoredUser } from '../lib/auth'
import { getOrders, type Order } from '../lib/orders'
import type { Tab, CartItem } from '../App'

type Props = {
  user: AppUser | null
  onLogout: () => void
  onTabChange?: (tab: Tab) => void
  onAddToCart?: (item: Omit<CartItem, 'quantity'>) => void
}

export default function ProfilePage({ user, onLogout, onTabChange, onAddToCart }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [activeModal, setActiveModal] = useState<
    'history' | 'favourites' | 'payments' | 'settings' | 'help' | 'editProfile' | null
  >(null)

  // Edit profile state
  const [editName, setEditName] = useState(user?.name ?? 'Deepika K')
  const [editPhone, setEditPhone] = useState(user?.phone ?? '+91 98765 43210')
  const [editRoll, setEditRoll] = useState(user?.rollNo ?? '24CB7821')
  const [editRoom, setEditRoom] = useState(user?.roomNo ?? 'Hostel 3 - Room 102')
  const [profileSavedToast, setProfileSavedToast] = useState(false)

  useEffect(() => {
    if (user?.id) {
      getOrders(user.id).then(setOrders)
    }
  }, [user])

  const totalSpent = orders.reduce((s, o) => s + o.total, 0)
  const completedOrdersCount = orders.length

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const updated: AppUser = {
      ...user,
      name: editName,
      phone: editPhone,
      rollNo: editRoll,
      roomNo: editRoom,
    }
    saveStoredUser(updated)
    setProfileSavedToast(true)
    setTimeout(() => {
      setProfileSavedToast(false)
      setActiveModal(null)
    }, 900)
  }

  const favouritesList = [
    {
      id: 5,
      name: 'Chicken Biryani',
      price: 160,
      image: 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=400&h=300&fit=crop&auto=format',
      rating: 4.9,
    },
    {
      id: 4,
      name: 'Filter Coffee',
      price: 25,
      image: 'https://images.unsplash.com/photo-1758387941825-a6ecaec9c14d?w=400&h=300&fit=crop&auto=format',
      rating: 4.9,
    },
    {
      id: 7,
      name: 'Cheese Burger',
      price: 130,
      image: 'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=400&h=300&fit=crop&auto=format',
      rating: 4.8,
    },
  ]

  const menuSections = [
    {
      id: 'history',
      icon: '📋',
      label: 'Order History',
      sub: `${completedOrdersCount} orders placed so far`,
      badge: `${completedOrdersCount} Orders`,
    },
    {
      id: 'favourites',
      icon: '❤️',
      label: 'Favourite Dishes',
      sub: '3 saved dishes for quick reorder',
      badge: '3 Saved',
    },
    {
      id: 'payments',
      icon: '💳',
      label: 'Saved Payment Methods',
      sub: 'UPI IDs and Campus Dining Card',
      badge: 'Active',
    },
    {
      id: 'settings',
      icon: '⏱️',
      label: 'Canteen Hours & Timings',
      sub: 'Meal schedules & counter layout',
      badge: 'Open Now',
    },
    {
      id: 'help',
      icon: '❓',
      label: 'Help & Canteen Support',
      sub: 'FAQs, refund policy & manager helpline',
      badge: '24/7',
    },
  ]

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%', padding: '24px 20px 32px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 2px', color: '#0f172a' }}>
            My Account
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
            Student profile & canteen preferences
          </p>
        </div>

        <button
          onClick={() => setActiveModal('editProfile')}
          style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 10,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: '#0f172a',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>✏️</span>
          <span>Edit</span>
        </button>
      </div>

      {/* ================= PROFILE CARD ================= */}
      <div
        style={{
          background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
          borderRadius: 22,
          padding: '22px 20px',
          marginBottom: 20,
          color: '#ffffff',
          boxShadow: '0 8px 24px rgba(34, 197, 94, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              background: 'rgba(255,255,255,0.25)',
              border: '2px solid rgba(255,255,255,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 900,
              color: '#ffffff',
            }}
          >
            {editName[0]?.toUpperCase() ?? 'U'}
          </div>

          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', margin: '0 0 3px' }}>
              {editName}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', margin: '0 0 2px' }}>
              {user?.email ?? 'deepika@campusbites.edu'}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              {editRoll} · {editRoom}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            ['ORDERS', String(completedOrdersCount)],
            ['SPENT', `₹${totalSpent}`],
            ['SAVED', '₹140'],
          ].map(([label, val]) => (
            <div
              key={label}
              style={{
                background: 'rgba(255,255,255,0.18)',
                borderRadius: 12,
                padding: '10px 8px',
                textAlign: 'center',
                backdropFilter: 'blur(4px)',
              }}
            >
              <p style={{ fontSize: 17, fontWeight: 900, color: '#ffffff', margin: '0 0 2px' }}>
                {val}
              </p>
              <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.75)', margin: 0, letterSpacing: '0.06em', fontWeight: 700 }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ================= INTERACTIVE MENU SECTIONS ================= */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          overflow: 'hidden',
          border: '1px solid #f1f5f9',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
          marginBottom: 20,
        }}
      >
        {menuSections.map((item, i) => (
          <button
            key={item.id}
            onClick={() => setActiveModal(item.id as any)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '16px 18px',
              border: 'none',
              borderBottom: i < menuSections.length - 1 ? '1px solid #f1f5f9' : 'none',
              background: '#ffffff',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff'
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              {item.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>
                  {item.label}
                </p>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#15803d',
                    background: '#f0fdf4',
                    padding: '2px 6px',
                    borderRadius: 6,
                  }}
                >
                  {item.badge}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{item.sub}</p>
            </div>

            <span style={{ color: '#94a3b8', fontSize: 18, fontWeight: 700 }}>›</span>
          </button>
        ))}
      </div>

      {/* ================= SIGN OUT BUTTON ================= */}
      <button
        onClick={() => {
          if (window.confirm('Are you sure you want to sign out from CampusBites?')) {
            onLogout()
          }
        }}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 16,
          background: '#fee2e2',
          border: '1.5px solid #fecaca',
          color: '#b91c1c',
          fontWeight: 800,
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#fecaca'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#fee2e2'
        }}
      >
        <span>🚪</span>
        <span>Sign Out of CampusBites</span>
      </button>

      <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 24 }}>
        CampusBites v2.0 · Live Connected
      </p>

      {/* =========================================================
          MODALS & SHEETS FOR SECTIONS
      ========================================================= */}

      {/* 1. ORDER HISTORY MODAL */}
      {activeModal === 'history' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 410,
              maxHeight: '85vh',
              background: '#ffffff',
              borderRadius: '24px 24px 0 0',
              overflowY: 'auto',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Past Orders ({orders.length})
              </h2>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {orders.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#64748b', padding: '30px 0' }}>
                No past orders recorded yet.
              </p>
            ) : (
              orders.map((o) => (
                <div
                  key={o.id}
                  style={{
                    background: '#f8fafc',
                    borderRadius: 14,
                    padding: '14px',
                    marginBottom: 12,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                        #{o.order_number}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                        Token #{o.token_number}
                      </span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                      ₹{o.total}
                    </span>
                  </div>

                  <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 8px' }}>
                    {o.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#15803d',
                        background: '#dcfce7',
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}
                    >
                      Paid via {o.payment.toUpperCase()}
                    </span>

                    <button
                      onClick={() => {
                        setActiveModal(null)
                        onTabChange?.('track')
                      }}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#0f172a',
                        cursor: 'pointer',
                      }}
                    >
                      Track Order →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. FAVOURITES DISHES MODAL */}
      {activeModal === 'favourites' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 410,
              maxHeight: '85vh',
              background: '#ffffff',
              borderRadius: '24px 24px 0 0',
              overflowY: 'auto',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Your Favourites ❤️
              </h2>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {favouritesList.map((fav) => (
              <div
                key={fav.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <img
                  src={fav.image}
                  alt={fav.name}
                  style={{ width: 50, height: 50, borderRadius: 10, objectFit: 'cover' }}
                />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>
                    {fav.name}
                  </p>
                  <p style={{ fontSize: 12, fontWeight: 800, color: '#22c55e', margin: 0 }}>
                    ₹{fav.price} · ⭐ {fav.rating}
                  </p>
                </div>
                <button
                  onClick={() => {
                    onAddToCart?.({
                      id: fav.id,
                      name: fav.name,
                      price: fav.price,
                      image: fav.image,
                    })
                    alert(`Added ${fav.name} to cart!`)
                  }}
                  style={{
                    background: '#22c55e',
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 12px',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Add +
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. PAYMENT METHODS MODAL */}
      {activeModal === 'payments' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 410,
              maxHeight: '85vh',
              background: '#ffffff',
              borderRadius: '24px 24px 0 0',
              overflowY: 'auto',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Payment Methods
              </h2>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 14, marginBottom: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>📱</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Primary UPI ID
                  </p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>deepika@okaxis</p>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 14, marginBottom: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>💳</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Campus RuPay Student Card
                  </p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Ending in •••• 4242</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                alert('UPI ID verified successfully!')
                setActiveModal(null)
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                background: '#22c55e',
                color: '#ffffff',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Add New UPI / Card
            </button>
          </div>
        </div>
      )}

      {/* 4. CANTEEN TIMINGS & HOURS */}
      {activeModal === 'settings' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 410,
              maxHeight: '85vh',
              background: '#ffffff',
              borderRadius: '24px 24px 0 0',
              overflowY: 'auto',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Canteen Timings & Windows
              </h2>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>
                🍳 Breakfast
              </p>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>7:30 AM – 10:30 AM (Tiffin Counter 1)</p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>
                🍛 Lunch
              </p>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>12:00 PM – 3:30 PM (Main Meals Counter 2)</p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>
                🍔 Evening Snacks & Beverages
              </p>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>4:00 PM – 9:00 PM (Snack Bar & Cafe)</p>
            </div>

            <p style={{ fontSize: 11, color: '#94a3b8' }}>
              Pickup token displays on counter LED boards automatically upon order completion.
            </p>
          </div>
        </div>
      )}

      {/* 5. HELP & SUPPORT MODAL */}
      {activeModal === 'help' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 410,
              maxHeight: '85vh',
              background: '#ffffff',
              borderRadius: '24px 24px 0 0',
              overflowY: 'auto',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Help & Support
              </h2>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#15803d', margin: '0 0 4px' }}>
                📞 Canteen Manager Helpline
              </p>
              <p style={{ fontSize: 12, color: '#16a34a', margin: 0 }}>
                Direct Hotline: +91 98765 43210 (Mon-Sat 8am-9pm)
              </p>
            </div>

            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>
                Q: What if my order is delayed?
              </p>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                Show your digital token at Counter 2. Priority is given to verified app orders.
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>
                Q: How do UPI refunds work?
              </p>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                If an item is out of stock, refund is initiated automatically to your source VPA.
              </p>
            </div>

            <button
              onClick={() => {
                window.open('https://wa.me/919876543210', '_blank')
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                background: '#0f172a',
                color: '#ffffff',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              💬 Chat on WhatsApp Support
            </button>
          </div>
        </div>
      )}

      {/* 6. EDIT PROFILE MODAL */}
      {activeModal === 'editProfile' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 360,
              background: '#ffffff',
              borderRadius: 20,
              padding: '20px',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Edit Student Profile
              </h2>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  STUDENT NAME
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1.5px solid #cbd5e1',
                    fontSize: 13,
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  PHONE NUMBER
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1.5px solid #cbd5e1',
                    fontSize: 13,
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  ROLL / STUDENT ID
                </label>
                <input
                  type="text"
                  value={editRoll}
                  onChange={(e) => setEditRoll(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1.5px solid #cbd5e1',
                    fontSize: 13,
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  HOSTEL / CAMPUS ROOM
                </label>
                <input
                  type="text"
                  value={editRoom}
                  onChange={(e) => setEditRoom(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1.5px solid #cbd5e1',
                    fontSize: 13,
                    fontWeight: 600,
                    outline: 'none',
                  }}
                />
              </div>

              {profileSavedToast && (
                <div style={{ textAlign: 'center', color: '#15803d', fontWeight: 700, fontSize: 12, marginBottom: 10 }}>
                  ✓ Profile changes saved!
                </div>
              )}

              <button
                type="submit"
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
                }}
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
