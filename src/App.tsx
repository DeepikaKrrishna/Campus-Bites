import { useState, useEffect, useCallback } from 'react'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import MenuPage from './pages/MenuPage'
import CartPage from './pages/CartPage'
import TrackPage from './pages/TrackPage'
import ProfilePage from './pages/ProfilePage'
import BottomNav from './components/BottomNav'
import {
  restoreSession,
  getStoredUser,
  signOut,
  onAuthStateChange,
  type AppUser,
} from './lib/auth'
import { isSupabaseConfigured } from './lib/supabase'

export type CartItem = {
  id: number
  name: string
  price: number
  image: string
  quantity: number
}

export type Tab = 'home' | 'menu' | 'cart' | 'track' | 'profile'

const CART_KEY = 'cb_cart'

function loadSavedCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(getStoredUser)
  const [tab, setTab] = useState<Tab>('home')
  const [cart, setCart] = useState<CartItem[]>(loadSavedCart)
  const [loading, setLoading] = useState(true)

  // Restore user session on mount and listen to Google OAuth callbacks
  useEffect(() => {
    restoreSession().then((u) => {
      if (u) setUser(u)
      setLoading(false)
    })

    const unsubscribe = onAuthStateChange((u) => {
      if (u) setUser(u)
      setLoading(false)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  const addToCart = useCallback((item: Omit<CartItem, 'quantity'>) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id)
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      }
      return [...prev, { ...item, quantity: 1 }]
    })
  }, [])

  const updateQty = useCallback((id: number, delta: number) => {
    setCart((prev) =>
      prev.flatMap((c) => {
        if (c.id !== id) return [c]
        const q = c.quantity + delta
        return q <= 0 ? [] : [{ ...c, quantity: q }]
      })
    )
  }, [])

  const handleLogin = useCallback((u: AppUser) => {
    setUser(u)
  }, [])

  const handleLogout = useCallback(async () => {
    await signOut()
    setUser(null)
    setCart([])
    setTab('home')
  }, [])

  const totalItems = cart.reduce((s, c) => s + c.quantity, 0)

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#f8fafc',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 68, height: 68, margin: '0 auto 16px' }}>
            <img
              src="/app-icon.jpg"
              alt="CampusBites"
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                objectFit: 'cover',
                boxShadow: '0 8px 24px rgba(34,197,94,0.3)',
                position: 'absolute',
                top: 7,
                left: 7,
              }}
            />
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 20,
                border: '3px solid #e2e8f0',
                borderTopColor: '#22c55e',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
          <p style={{ color: '#64748b', fontSize: 14, fontWeight: 700 }}>
            Loading CampusBites…
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  const renderPage = () => {
    switch (tab) {
      case 'home':
        return (
          <HomePage
            onAddToCart={addToCart}
            onRemoveFromCart={(id) => updateQty(id, -1)}
            cart={cart}
            onTabChange={setTab}
            user={user}
          />
        )
      case 'menu':
        return (
          <MenuPage
            onAddToCart={addToCart}
            onRemoveFromCart={(id) => updateQty(id, -1)}
            cart={cart}
          />
        )
      case 'cart':
        return (
          <CartPage
            cart={cart}
            updateQty={updateQty}
            user={user}
            onTabChange={setTab}
            onOrderPlaced={() => {
              setCart([])
            }}
          />
        )
      case 'track':
        return (
          <TrackPage
            user={user}
            onTabChange={setTab}
            onReorder={(items) => {
              items.forEach((it) => {
                addToCart({
                  id: it.id,
                  name: it.name,
                  price: it.price,
                  image: it.image,
                })
              })
              setTab('cart')
            }}
          />
        )
      case 'profile':
        return (
          <ProfilePage
            user={user}
            onLogout={handleLogout}
            onTabChange={setTab}
            onAddToCart={addToCart}
          />
        )
      default:
        return null
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100svh',
        background: '#e2e8f0',
        padding: '16px 0',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 412,
          minHeight: 'calc(100svh - 32px)',
          background: '#ffffff',
          borderRadius: 32,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
          position: 'relative',
        }}
      >
        {/* Live Backend Indicator Banner */}
        {isSupabaseConfigured && (
          <div
            style={{
              background: '#15803d',
              color: '#ffffff',
              textAlign: 'center',
              fontSize: 10.5,
              fontWeight: 800,
              padding: '4px 0',
              letterSpacing: '0.06em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 6px #4ade80',
              }}
            />
            <span>CONNECTED TO SUPABASE BACKEND</span>
          </div>
        )}

        {/* Scrollable View */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 68 }}>
          {renderPage()}
        </div>

        {/* Fixed Bottom Navigation */}
        <BottomNav tab={tab} onChange={setTab} totalItems={totalItems} />
      </div>
    </div>
  )
}
