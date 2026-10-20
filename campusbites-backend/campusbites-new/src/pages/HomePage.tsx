import { useState } from "react"
import { menuItems } from "../data/menuItems"
import FoodCard from "../components/FoodCard"
import type { CartItem, Tab } from "../App"
import type { AppUser } from "../lib/auth"

type Props = {
  onAddToCart: (item: Omit<CartItem, "quantity">) => void
  cart: CartItem[]
  onTabChange: (t: Tab) => void
  user: AppUser
}

const categories = ["All", "Breakfast", "Snacks", "Lunch"]

export default function HomePage({ onAddToCart, cart, onTabChange, user }: Props) {
  const [activeCategory, setActiveCategory] = useState("All")

  const qty = (id: number) => cart.find((c) => c.id === id)?.quantity ?? 0

  const popular = menuItems.filter((m) => m.ratingCount > 100).slice(0, 6)

  const specials = menuItems.filter((m) => m.badge === "SPECIAL")

  return (
    <div
      style={{
        background: "#f8f8f8",
        minHeight: "100%",
      }}
    >
      {/* ================= HEADER ================= */}
      <div
        style={{
          background: "#fff",
          padding: "20px 20px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p
              style={{
                fontSize: 12,
                color: "#aaa",
                margin: "0 0 4px",
                fontWeight: 500,
              }}
            >
              Good morning
            </p>

            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#1a1a1a",
                margin: 0,
                lineHeight: 1.25,
              }}
            >
              {user.name.split(' ')[0]}, what would you
              <br />
              like to order?
            </h1>
          </div>

          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: "#22c55e",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            D
          </div>
        </div>

        {/* Search */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#f5f5f5",
            borderRadius: 12,
            padding: "10px 14px",
          }}
        >
          <span
            style={{
              color: "#bbb",
              fontSize: 16,
            }}
          >
            🔍
          </span>

          <input
            placeholder="Search for food, drinks…"
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontSize: 14,
              color: "#1a1a1a",
            }}
          />
        </div>
      </div>

      {/* ================= CATEGORIES ================= */}
      <div
        style={{
          background: "#fff",
          padding: "0 20px 16px",
          marginBottom: 8,
        }}
      >
        <p
          style={{
            fontSize: 14,
            fontWeight: 700,
            margin: "12px 0 10px",
            color: "#1a1a1a",
          }}
        >
          Categories
        </p>

        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                background: cat === activeCategory ? "#22c55e" : "#f0f0f0",
                color: cat === activeCategory ? "#fff" : "#555",
                fontWeight: cat === activeCategory ? 600 : 400,
                fontSize: 13,
                border: "none",
                flexShrink: 0,
                transition: "all 0.15s",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ==================================================
          POPULAR MEALS - HORIZONTAL SLIDER
      ================================================== */}
      <div
        style={{
          background: "#fff",
          padding: "0 0 18px",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            padding: "4px 20px 0",
          }}
        >
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: 0,
              color: "#1a1a1a",
            }}
          >
            Popular Meals 🔥
          </p>

          <button
            onClick={() => onTabChange("menu")}
            style={{
              fontSize: 12,
              color: "#22c55e",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 4,
              border: "none",
              background: "none",
              cursor: "pointer",
            }}
          >
            See all →
          </button>
        </div>

        {/* ===== SLIDER ===== */}
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            padding: "0 20px 8px",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {popular
            .filter(
              (m) => activeCategory === "All" || m.category === activeCategory,
            )
            .map((item) => (
              <div
                key={item.id}
                style={{
                  minWidth: 220,
                  maxWidth: 220,
                  flexShrink: 0,
                  scrollSnapAlign: "start",
                }}
              >
                <FoodCard
                  item={item}
                  qty={qty(item.id)}
                  onAdd={() =>
                    onAddToCart({
                      id: item.id,
                      name: item.name,
                      price: item.price,
                      image: item.image,
                    })
                  }
                />
              </div>
            ))}
        </div>
      </div>

      {/* ==================================================
          TODAY'S SPECIAL - HORIZONTAL SLIDER
      ================================================== */}
      <div
        style={{
          background: "#fff",
          padding: "0 0 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            padding: "4px 20px 0",
          }}
        >
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: 0,
              color: "#1a1a1a",
            }}
          >
            Today's Special ✨
          </p>

          <span
            style={{
              fontSize: 11,
              color: "#999",
            }}
          >
            Swipe →
          </span>
        </div>

        {/* ===== SLIDER ===== */}
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            padding: "0 20px 8px",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {specials.map((item) => (
            <div
              key={item.id}
              style={{
                minWidth: 220,
                maxWidth: 220,
                flexShrink: 0,
                scrollSnapAlign: "start",
              }}
            >
              <FoodCard
                item={item}
                qty={qty(item.id)}
                onAdd={() =>
                  onAddToCart({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    image: item.image,
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
