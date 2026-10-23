import { useState, useMemo } from 'react'
import { menuItems, type MenuItem } from '../data/menuItems'
import FoodCard from '../components/FoodCard'
import type { CartItem, Tab } from '../App'
import type { AppUser } from '../lib/auth'

type Props = {
  onAddToCart: (item: Omit<CartItem, 'quantity'>) => void
  onRemoveFromCart: (id: number) => void
  cart: CartItem[]
  onTabChange: (t: Tab) => void
  user: AppUser | null
}

const categories = ['All', 'Breakfast', 'Snacks', 'Lunch', 'Veg Only']

export default function HomePage({
  onAddToCart,
  onRemoveFromCart,
  cart,
  onTabChange,
  user,
}: Props) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

  const qty = (id: number) => cart.find((c) => c.id === id)?.quantity ?? 0

  const totalCartCount = cart.reduce((s, c) => s + c.quantity, 0)
  const totalCartPrice = cart.reduce((s, c) => s + c.price * c.quantity, 0)

  // Real-time search filter
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return menuItems.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.counter.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    )
  }, [search])

  const popular = useMemo(() => {
    return menuItems.filter((m) => m.ratingCount > 100).slice(0, 8)
  }, [])

  const specials = useMemo(() => {
    return menuItems.filter((m) => m.badge === 'SPECIAL')
  }, [])

  const filteredPopular = useMemo(() => {
    if (activeCategory === 'All') return popular
    if (activeCategory === 'Veg Only') {
      return popular.filter((m) => !/chicken|fish|mutton|egg/i.test(m.name))
    }
    return popular.filter((m) => m.category === activeCategory)
  }, [popular, activeCategory])

  const userName = user?.name ? user.name.split(' ')[0] : 'Deepika'

  const handleAddItem = (item: MenuItem) => {
    onAddToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
    })
  }

  return (
    <div
      style={{
        background: '#f8fafc',
        minHeight: '100%',
        position: 'relative',
        paddingBottom: totalCartCount > 0 ? 70 : 16,
      }}
    >
      {/* ================= HEADER ================= */}
      <div
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          padding: '20px 20px 16px',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>👋</span>
              <p
                style={{
                  fontSize: 12,
                  color: '#64748b',
                  margin: 0,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
              >
                Welcome back
              </p>
            </div>

            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: '#0f172a',
                margin: 0,
                lineHeight: 1.25,
              }}
            >
              {userName}, what would you
              <br />
              like to eat today?
            </h1>
          </div>

          {/* User Avatar */}
          <button
            onClick={() => onTabChange('profile')}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 18,
              flexShrink: 0,
              border: '2px solid #ffffff',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.25)',
              cursor: 'pointer',
            }}
            title="Open Profile"
          >
            {userName[0]?.toUpperCase() ?? 'U'}
          </button>
        </div>

        {/* Real-time Search Bar */}
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#ffffff',
            borderRadius: 14,
            padding: '12px 14px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
            border: search ? '1.5px solid #22c55e' : '1.5px solid #e2e8f0',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ color: '#22c55e', fontSize: 16 }}>🔍</span>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for dosa, biryani, coffee, burger…"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 13.5,
              fontWeight: 500,
              color: '#0f172a',
            }}
          />

          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: '#f1f5f9',
                border: 'none',
                width: 22,
                height: 22,
                borderRadius: '50%',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ================= SEARCH RESULTS VIEW ================= */}
      {search.trim().length > 0 ? (
        <div style={{ padding: '16px 20px', minHeight: 350 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Search results for "{search}"
            </p>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#22c55e',
                background: '#f0fdf4',
                padding: '2px 8px',
                borderRadius: 12,
              }}
            >
              {searchResults.length} {searchResults.length === 1 ? 'dish' : 'dishes'} found
            </span>
          </div>

          {searchResults.length > 0 ? (
            <div style={{ background: '#ffffff', borderRadius: 16, padding: '0 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
              {searchResults.map((item) => (
                <FoodCard
                  key={item.id}
                  item={item}
                  compact={true}
                  qty={qty(item.id)}
                  onAdd={() => handleAddItem(item)}
                  onRemove={() => onRemoveFromCart(item.id)}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: '#ffffff',
                borderRadius: 16,
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ fontSize: 42, marginBottom: 12 }}>🍽️</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
                No dishes found
              </p>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>
                Try searching with another keyword
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {['Biryani', 'Dosa', 'Coffee', 'Burger', 'Omelette'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSearch(tag)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 16,
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================= MAIN DASHBOARD CONTENT ================= */
        <>
          {/* CATEGORIES PILLS */}
          <div
            style={{
              background: '#ffffff',
              padding: '12px 20px 14px',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                scrollbarWidth: 'none',
              }}
            >
              {categories.map((cat) => {
                const isActive = cat === activeCategory
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 24,
                      background: isActive ? '#22c55e' : '#f8fafc',
                      color: isActive ? '#ffffff' : '#475569',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: 12.5,
                      border: isActive ? '1px solid #22c55e' : '1px solid #e2e8f0',
                      flexShrink: 0,
                      cursor: 'pointer',
                      boxShadow: isActive ? '0 2px 8px rgba(34, 197, 94, 0.25)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ================= POPULAR MEALS - SLIDER ================= */}
          <div
            style={{
              padding: '16px 0 10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                padding: '0 20px',
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    margin: 0,
                    color: '#0f172a',
                  }}
                >
                  Popular Meals 🔥
                </p>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>
                  Most loved dishes on campus
                </p>
              </div>

              <button
                onClick={() => onTabChange('menu')}
                style={{
                  fontSize: 12,
                  color: '#22c55e',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                See all →
              </button>
            </div>

            {/* Slider with Swiggy add/stepper */}
            <div
              style={{
                display: 'flex',
                gap: 14,
                overflowX: 'auto',
                padding: '4px 20px 14px',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
              }}
            >
              {filteredPopular.map((item) => (
                <div
                  key={item.id}
                  style={{
                    minWidth: 220,
                    maxWidth: 220,
                    flexShrink: 0,
                    scrollSnapAlign: 'start',
                  }}
                >
                  <FoodCard
                    item={item}
                    qty={qty(item.id)}
                    onAdd={() => handleAddItem(item)}
                    onRemove={() => onRemoveFromCart(item.id)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ================= TODAY'S SPECIAL ================= */}
          <div
            style={{
              padding: '10px 0 20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                padding: '0 20px',
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    margin: 0,
                    color: '#0f172a',
                  }}
                >
                  Today's Special ✨
                </p>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>
                  Chef's fresh recommendations
                </p>
              </div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#64748b',
                  background: '#f1f5f9',
                  padding: '3px 8px',
                  borderRadius: 10,
                }}
              >
                Swipe →
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 14,
                overflowX: 'auto',
                padding: '4px 20px 14px',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
              }}
            >
              {specials.map((item) => (
                <div
                  key={item.id}
                  style={{
                    minWidth: 220,
                    maxWidth: 220,
                    flexShrink: 0,
                    scrollSnapAlign: 'start',
                  }}
                >
                  <FoodCard
                    item={item}
                    qty={qty(item.id)}
                    onAdd={() => handleAddItem(item)}
                    onRemove={() => onRemoveFromCart(item.id)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Campus Canteen Banner */}
          <div style={{ padding: '0 20px 16px' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: 16,
                padding: '16px 18px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              }}
            >
              <div>
                <p style={{ fontSize: 11, color: '#22c55e', fontWeight: 800, margin: '0 0 2px' }}>
                  ⚡ FAST COUNTER PICKUP
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>
                  Order ahead, skip the lunch rush!
                </p>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                  Show your digital token at Counter 2
                </p>
              </div>
              <button
                onClick={() => onTabChange('menu')}
                style={{
                  background: '#22c55e',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Explore
              </button>
            </div>
          </div>
        </>
      )}

      {/* Floating Swiggy-style Cart Pill Bar */}
      {totalCartCount > 0 && (
        <div
          style={{
            position: 'sticky',
            bottom: 12,
            left: 0,
            right: 0,
            padding: '0 16px',
            zIndex: 10,
          }}
        >
          <div
            onClick={() => onTabChange('cart')}
            style={{
              background: 'linear-gradient(135deg, #16a34a, #22c55e)',
              borderRadius: 14,
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4)',
              cursor: 'pointer',
              color: '#ffffff',
              animation: 'bounceIn 0.3s ease',
            }}
          >
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, margin: 0, letterSpacing: '0.02em' }}>
                {totalCartCount} {totalCartCount === 1 ? 'ITEM' : 'ITEMS'} ADDED
              </p>
              <p style={{ fontSize: 11, opacity: 0.9, margin: 0 }}>
                Total: ₹{totalCartPrice} plus taxes
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13 }}>
              <span>View Cart</span>
              <span style={{ fontSize: 16 }}>🛒 →</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
