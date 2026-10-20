import { useState, useEffect, useCallback } from "react"
import LoginPage from "./pages/LoginPage"
import HomePage from "./pages/HomePage"
import MenuPage from "./pages/MenuPage"
import CartPage from "./pages/CartPage"
import TrackPage from "./pages/TrackPage"
import ProfilePage from "./pages/ProfilePage"
import BottomNav from "./components/BottomNav"
import { restoreSession, getStoredUser, signOut, type AppUser } from "./lib/auth"
import { isSupabaseConfigured } from "./lib/supabase"

export type CartItem = {
  id: number
  name: string
  price: number
  image: string
  quantity: number
}

export type Tab = "home" | "menu" | "cart" | "track" | "profile"

const CART_KEY = "cb_cart"

function loadCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") }
  catch { return [] }
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(getStoredUser)
  const [tab, setTab] = useState<Tab>("home")
  const [cart, setCart] = useState<CartItem[]>(loadCart)
  const [loading, setLoading] = useState(true)

  // Restore session on mount
  useEffect(() => {
    restoreSession().then(u => { if (u) setUser(u); setLoading(false) })
  }, [])

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  const addToCart = useCallback((item: Omit<CartItem, "quantity">) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === item.id)
      if (ex) return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { ...item, quantity: 1 }]
    })
  }, [])

  const updateQty = useCallback((id: number, delta: number) => {
    setCart((prev) =>
      prev.flatMap((c) => {
        if (c.id !== id) return [c]
        const q = c.quantity + delta
        return q <= 0 ? [] : [{ ...c, quantity: q }]
      }),
    )
  }, [])

  const handleLogin = useCallback((u: AppUser) => { setUser(u) }, [])

  const handleLogout = useCallback(async () => {
    await signOut()
    setUser(null)
    setCart([])
    setTab("home")
  }, [])

  const totalItems = cart.reduce((s, c) => s + c.quantity, 0)

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f0fdf4" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, border: "4px solid #e2e8f0", borderTopColor: "#22c55e", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#64748b", fontSize: 14, fontWeight: 500 }}>Loading CampusBites…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage onLogin={handleLogin} />

  const renderPage = () => {
    switch (tab) {
      case "home":
        return <HomePage onAddToCart={addToCart} cart={cart} onTabChange={setTab} user={user} />
      case "menu":
        return <MenuPage onAddToCart={addToCart} cart={cart} />
      case "cart":
        return <CartPage cart={cart} updateQty={updateQty} user={user} onOrderPlaced={() => { setCart([]); setTab("track") }} />
      case "track":
        return <TrackPage user={user} />
      case "profile":
        return <ProfilePage user={user} onLogout={handleLogout} />
      default:
        return null
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        minHeight: "100svh",
        background: "#e5e5e5",
        padding: "20px 0",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 390,
          minHeight: "calc(100svh - 40px)",
          background: "#fff",
          borderRadius: 32,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 48px rgba(0,0,0,0.18)",
          position: "relative",
        }}
      >
        {/* Backend indicator */}
        {isSupabaseConfigured && (
          <div style={{
            background: "#22c55e", color: "#fff", textAlign: "center",
            fontSize: 10, fontWeight: 700, padding: "3px 0", letterSpacing: "0.05em",
          }}>
            🟢 LIVE — Connected to backend
          </div>
        )}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 72 }}>
          {renderPage()}
        </div>
        <BottomNav tab={tab} onChange={setTab} totalItems={totalItems} />
      </div>
    </div>
  )
}
