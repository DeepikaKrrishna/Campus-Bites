import { useState } from "react"
import LoginPage from "./pages/LoginPage"
import HomePage from "./pages/HomePage"
import MenuPage from "./pages/MenuPage"
import CartPage from "./pages/CartPage"
import TrackPage from "./pages/TrackPage"
import ProfilePage from "./pages/ProfilePage"
import BottomNav from "./components/BottomNav"

export type CartItem = {
  id: number
  name: string
  price: number
  image: string
  quantity: number
}

export type Tab = "home" | "menu" | "cart" | "track" | "profile"

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [tab, setTab] = useState<Tab>("home")
  const [cart, setCart] = useState<CartItem[]>([])

  const addToCart = (item: Omit<CartItem, "quantity">) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === item.id)
      if (ex)
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        )
      return [...prev, { ...item, quantity: 1 }]
    })
  }
  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev.flatMap((c) => {
        if (c.id !== id) return [c]
        const q = c.quantity + delta
        return q <= 0 ? [] : [{ ...c, quantity: q }]
      }),
    )
  }

  const totalItems = cart.reduce((s, c) => s + c.quantity, 0)

  if (!loggedIn) return <LoginPage onLogin={() => setLoggedIn(true)} />

  const renderPage = () => {
    switch (tab) {
      case "home":
        return (
          <HomePage onAddToCart={addToCart} cart={cart} onTabChange={setTab} />
        )
      case "menu":
        return <MenuPage onAddToCart={addToCart} cart={cart} />
      case "cart":
        return <CartPage cart={cart} updateQty={updateQty} />
      case "track":
        return <TrackPage />
      case "profile":
        return <ProfilePage />
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
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 72 }}>
          {renderPage()}
        </div>
        <BottomNav tab={tab} onChange={setTab} totalItems={totalItems} />
      </div>
    </div>
  )
}
