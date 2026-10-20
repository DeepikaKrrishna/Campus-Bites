import { useState } from "react"
import { menuItems, categories } from "../data/menuItems"
import FoodCard from "../components/FoodCard"
import type { CartItem } from "../App"

type Props = {
  onAddToCart: (item: Omit<CartItem, "quantity">) => void
  cart: CartItem[]
}

const sorts = ["Most ordered", "Price: Low-High", "Rating"]

export default function MenuPage({ onAddToCart, cart }: Props) {
  const [activeCategory, setActiveCategory] = useState("All")
  const [vegOnly, setVegOnly] = useState(false)
  const [sortIdx, setSortIdx] = useState(0)
  const [search, setSearch] = useState("")

  // Selected food for customization
  const [selectedItem, setSelectedItem] =
    useState<typeof menuItems[number] | null>(null)

  // Customization
  const [cheese, setCheese] = useState("None")
  const [sauce, setSauce] = useState("None")
  const [extra, setExtra] = useState("None")
  const [customQty, setCustomQty] = useState(1)

  const qty = (id: number) => cart.find((c) => c.id === id)?.quantity ?? 0

  let filtered = menuItems

  if (activeCategory !== "All") {
    filtered = filtered.filter((m) => m.category === activeCategory)
  }

  if (vegOnly) {
    filtered = filtered.filter((m) => {
      const name = m.name.toLowerCase()
      return (
        !name.includes("chicken") &&
        !name.includes("egg") &&
        !name.includes("fish") &&
        !name.includes("mutton")
      )
    })
  }

  if (search) {
    filtered = filtered.filter((m) =>
      m.name.toLowerCase().includes(search.toLowerCase()),
    )
  }

  if (sortIdx === 1) {
    filtered = [...filtered].sort((a, b) => a.price - b.price)
  }

  if (sortIdx === 2) {
    filtered = [...filtered].sort((a, b) => b.rating - a.rating)
  }

  // Check whether this food supports burger-style customizations
  const supportsBurgerCustomization = selectedItem
    ? /burger|sandwich|wrap|pizza|roll|fries/i.test(selectedItem.name)
    : false

  // Open customization
  const openCustomization = (item: typeof menuItems[number]) => {
    setSelectedItem(item)
    setCheese("None")
    setSauce("None")
    setExtra("None")
    setCustomQty(1)
  }

  // Close customization
  const closeCustomization = () => {
    setSelectedItem(null)
  }

  // Calculate additional price
  const getExtraPrice = () => {
    let price = 0

    if (cheese === "Regular") price += 10
    if (cheese === "Extra") price += 20

    if (sauce === "Mayonnaise") price += 10
    if (sauce === "Spicy") price += 10

    if (extra === "Onion") price += 5
    if (extra === "Jalapeño") price += 10

    return price
  }

  // Add customized food to cart
  const handleCustomizedAdd = () => {
    if (!selectedItem) return

    const customizedPrice = selectedItem.price + getExtraPrice()

    onAddToCart({
      id: selectedItem.id,
      name: selectedItem.name,
      price: customizedPrice,
      image: selectedItem.image,
    })

    closeCustomization()
  }

  return (
    <div
      style={{
        background: "#f8f8f8",
        minHeight: "100%",
      }}
    >
      {/* =========================
          HEADER
      ========================= */}
      <div
        style={{
          background: "#fff",
          padding: "20px 20px 0",
        }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            margin: "0 0 2px",
            color: "#1a1a1a",
          }}
        >
          Menu
        </h1>

        <p
          style={{
            fontSize: 12,
            color: "#aaa",
            margin: "0 0 14px",
          }}
        >
          {filtered.length} items across all counters
        </p>

        {/* =========================
            SEARCH
        ========================= */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#f5f5f5",
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 14,
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your favourite food"
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

        {/* =========================
            CATEGORY TABS
        ========================= */}
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 14,
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                flexShrink: 0,
                background: cat === activeCategory ? "#22c55e" : "#f0f0f0",
                color: cat === activeCategory ? "#fff" : "#555",
                fontWeight: cat === activeCategory ? 600 : 400,
                fontSize: 13,
                border: "none",
                cursor: "pointer",
              }}
            >
              {cat}
            </button>
          ))}

          <button
            onClick={() => setVegOnly(!vegOnly)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              flexShrink: 0,
              background: vegOnly ? "#22c55e" : "#f0f0f0",
              color: vegOnly ? "#fff" : "#555",
              fontWeight: vegOnly ? 600 : 400,
              fontSize: 13,
              border: "none",
              cursor: "pointer",
            }}
          >
            🌿 Veg
          </button>
        </div>
      </div>

      {/* =========================
          SORT ROW
      ========================= */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#fff",
          marginBottom: 8,
          marginTop: 2,
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: "#888",
            }}
          >
            ⇅
          </span>

          <select
            value={sortIdx}
            onChange={(e) => setSortIdx(Number(e.target.value))}
            style={{
              fontSize: 13,
              color: "#555",
              fontWeight: 500,
              border: "none",
              background: "none",
              outline: "none",
              cursor: "pointer",
            }}
          >
            {sorts.map((s, i) => (
              <option key={i} value={i}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <span
          style={{
            fontSize: 12,
            color: "#aaa",
          }}
        >
          {filtered.length} items
        </span>
      </div>

      {/* =========================
          TODAY'S SPECIAL
      ========================= */}
      <div
        style={{
          background: "#fff",
          padding: "0 20px 16px",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 14,
            marginBottom: 12,
          }}
        >
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: 0,
            }}
          >
            Today's Special ✨
          </p>

          <span
            style={{
              fontSize: 12,
              color: "#aaa",
            }}
          >
            {new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {menuItems
            .filter((m) => m.badge === "SPECIAL")
            .slice(0, 2)
            .map((item) => (
              <FoodCard
                key={item.id}
                item={item}
                qty={qty(item.id)}
                onAdd={() => openCustomization(item)}
              />
            ))}
        </div>
      </div>

      {/* =========================
          ALL ITEMS
      ========================= */}
      <div
        style={{
          background: "#fff",
          padding: "0 20px 20px",
        }}
      >
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            margin: "0 0 2px",
            paddingTop: 14,
          }}
        >
          All Items
        </p>

        {filtered.map((item) => (
          <FoodCard
            key={item.id}
            item={item}
            compact
            qty={qty(item.id)}
            onAdd={() => openCustomization(item)}
          />
        ))}
      </div>

      {/* ==================================================
          CUSTOMIZATION POPUP
      ================================================== */}
      {selectedItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 430,
              maxHeight: "92vh",
              background: "#fff",
              borderRadius: "28px 28px 0 0",
              overflowY: "auto",
              position: "relative",
            }}
          >
            {/* =========================
                FOOD IMAGE
            ========================= */}
            <div
              style={{
                width: "100%",
                height: 230,
                background: "#f3f3f3",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <img
                src={selectedItem.image}
                alt={selectedItem.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />

              {/* Close button */}
              <button
                onClick={closeCustomization}
                style={{
                  position: "absolute",
                  top: 14,
                  left: 14,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "none",
                  background: "#fff",
                  fontSize: 18,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                }}
              >
                ×
              </button>
            </div>

            {/* =========================
                FOOD DETAILS
            ========================= */}
            <div
              style={{
                padding: "18px 20px 24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 21,
                      fontWeight: 800,
                      color: "#1a1a1a",
                    }}
                  >
                    {selectedItem.name}
                  </h2>

                  <p
                    style={{
                      margin: "5px 0 0",
                      color: "#888",
                      fontSize: 12,
                    }}
                  >
                    ⭐ {selectedItem.rating}
                  </p>
                </div>

                <strong
                  style={{
                    fontSize: 18,
                    color: "#078f69",
                    whiteSpace: "nowrap",
                  }}
                >
                  ₹{selectedItem.price}
                </strong>
              </div>

              {/* =========================
                  CUSTOMIZATION
              ========================= */}
              {supportsBurgerCustomization ? (
                <>
                  {/* CHEESE */}
                  <div
                    style={{
                      marginTop: 22,
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 10px",
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#222",
                      }}
                    >
                      Add Cheese
                    </h3>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {[
                        ["None", "No cheese", 0],
                        ["Regular", "Regular cheese", 10],
                        ["Extra", "Extra cheese", 20],
                      ].map(([value, label, price]) => (
                        <button
                          key={String(value)}
                          onClick={() => setCheese(String(value))}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            padding: "13px 14px",
                            borderRadius: 11,
                            border:
                              cheese === value
                                ? "2px solid #22a879"
                                : "1px solid #e2e2e2",
                            background: cheese === value ? "#effaf5" : "#fff",
                            cursor: "pointer",
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#333",
                            }}
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                border:
                                  cheese === value
                                    ? "5px solid #22a879"
                                    : "2px solid #ccc",
                                boxSizing: "border-box",
                              }}
                            />

                            {label}
                          </span>

                          <span
                            style={{
                              fontSize: 11,
                              color: "#777",
                            }}
                          >
                            {Number(price) === 0 ? "Free" : `+ ₹${price}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SAUCE */}
                  <div
                    style={{
                      marginTop: 20,
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 10px",
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#222",
                      }}
                    >
                      Choose Sauce
                    </h3>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {[
                        ["None", "No sauce", 0],
                        ["Mayonnaise", "Mayonnaise", 10],
                        ["Spicy", "Spicy sauce", 10],
                      ].map(([value, label, price]) => (
                        <button
                          key={String(value)}
                          onClick={() => setSauce(String(value))}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            padding: "13px 14px",
                            borderRadius: 11,
                            border:
                              sauce === value
                                ? "2px solid #22a879"
                                : "1px solid #e2e2e2",
                            background: sauce === value ? "#effaf5" : "#fff",
                            cursor: "pointer",
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#333",
                            }}
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                border:
                                  sauce === value
                                    ? "5px solid #22a879"
                                    : "2px solid #ccc",
                                boxSizing: "border-box",
                              }}
                            />

                            {label}
                          </span>

                          <span
                            style={{
                              fontSize: 11,
                              color: "#777",
                            }}
                          >
                            {Number(price) === 0 ? "Free" : `+ ₹${price}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* EXTRA TOPPINGS */}
                  <div
                    style={{
                      marginTop: 20,
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 10px",
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#222",
                      }}
                    >
                      Extra Toppings
                    </h3>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {[
                        ["None", "No extra topping", 0],
                        ["Onion", "Extra onion", 5],
                        ["Jalapeño", "Jalapeño", 10],
                      ].map(([value, label, price]) => (
                        <button
                          key={String(value)}
                          onClick={() => setExtra(String(value))}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            padding: "13px 14px",
                            borderRadius: 11,
                            border:
                              extra === value
                                ? "2px solid #22a879"
                                : "1px solid #e2e2e2",
                            background: extra === value ? "#effaf5" : "#fff",
                            cursor: "pointer",
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#333",
                            }}
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                border:
                                  extra === value
                                    ? "5px solid #22a879"
                                    : "2px solid #ccc",
                                boxSizing: "border-box",
                              }}
                            />

                            {label}
                          </span>

                          <span
                            style={{
                              fontSize: 11,
                              color: "#777",
                            }}
                          >
                            {Number(price) === 0 ? "Free" : `+ ₹${price}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* FOR FOODS THAT DON'T NEED BURGER-STYLE OPTIONS */
                <div
                  style={{
                    marginTop: 22,
                    padding: 14,
                    borderRadius: 12,
                    background: "#f7faf8",
                    border: "1px solid #e3eee8",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "#555",
                      lineHeight: 1.5,
                    }}
                  >
                    Customize your quantity below and add this item to your
                    cart.
                  </p>
                </div>
              )}

              {/* =========================
                  QUANTITY
              ========================= */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 22,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#222",
                  }}
                >
                  Quantity
                </span>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    padding: "5px 8px",
                  }}
                >
                  <button
                    onClick={() => setCustomQty(Math.max(1, customQty - 1))}
                    style={{
                      border: "none",
                      background: "none",
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    −
                  </button>

                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {customQty}
                  </span>

                  <button
                    onClick={() => setCustomQty(customQty + 1)}
                    style={{
                      border: "none",
                      background: "none",
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* =========================
                  TOTAL
              ========================= */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 18,
                  paddingTop: 15,
                  borderTop: "1px solid #eee",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: "#777",
                  }}
                >
                  Total
                </span>

                <strong
                  style={{
                    fontSize: 18,
                    color: "#1a1a1a",
                  }}
                >
                  ₹{(selectedItem.price + getExtraPrice()) * customQty}
                </strong>
              </div>

              {/* =========================
                  ADD TO CART
              ========================= */}
              <button
                onClick={handleCustomizedAdd}
                style={{
                  width: "100%",
                  height: 50,
                  marginTop: 16,
                  border: "none",
                  borderRadius: 13,
                  background: "#08a879",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 5px 14px rgba(0,140,100,0.25)",
                }}
              >
                Add to Cart • ₹
                {(selectedItem.price + getExtraPrice()) * customQty}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
