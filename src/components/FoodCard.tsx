import type { MenuItem } from '../data/menuItems'

type Props = {
  item: MenuItem
  onAdd: () => void
  onRemove?: () => void
  qty: number
  compact?: boolean
  onClick?: () => void
}

export default function FoodCard({ item, onAdd, onRemove, qty, compact, onClick }: Props) {
  const isVeg = !/chicken|mutton|fish|egg|prawn|meat/i.test(item.name)

  if (compact) {
    // Horizontal list row (Menu page / Search results / All Items)
    return (
      <div
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 0',
          borderBottom: '1px solid #f1f5f9',
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        {/* Image */}
        <div
          style={{
            position: 'relative',
            flexShrink: 0,
            width: 88,
            height: 88,
            borderRadius: 14,
            overflow: 'hidden',
            background: '#f1f5f9',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {item.badge && (
            <span
              style={{
                position: 'absolute',
                top: 6,
                left: 6,
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                color: '#fff',
                fontSize: 9,
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: 4,
                letterSpacing: '0.04em',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            >
              {item.badge}
            </span>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                border: `1.5px solid ${isVeg ? '#16a34a' : '#dc2626'}`,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isVeg ? '#16a34a' : '#dc2626',
                  display: 'block',
                }}
              />
            </span>
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#0f172a',
                margin: 0,
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.name}
            </p>
          </div>
          <p
            style={{
              fontSize: 12,
              color: '#64748b',
              margin: '0 0 6px',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.description}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontWeight: 600,
              }}
            >
              ⭐ {item.rating}
              <span style={{ color: '#94a3b8', fontWeight: 400 }}>({item.ratingCount})</span>
            </span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>⏱ {item.time}</span>
          </div>
        </div>

        {/* Price + Add Stepper */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>₹{item.price}</span>

          {qty > 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#22c55e',
                borderRadius: 8,
                padding: '2px 4px',
                boxShadow: '0 2px 6px rgba(34, 197, 94, 0.25)',
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove?.()
                }}
                style={{
                  width: 26,
                  height: 26,
                  border: 'none',
                  background: 'none',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Decrease quantity"
              >
                −
              </button>
              <span
                style={{
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 13,
                  minWidth: 18,
                  textAlign: 'center',
                }}
              >
                {qty}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAdd()
                }}
                style={{
                  width: 26,
                  height: 26,
                  border: 'none',
                  background: 'none',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Increase quantity"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAdd()
              }}
              style={{
                border: '1.5px solid #22c55e',
                borderRadius: 8,
                padding: '5px 16px',
                color: '#22c55e',
                fontWeight: 800,
                fontSize: 12,
                background: '#ffffff',
                boxShadow: '0 2px 6px rgba(34, 197, 94, 0.15)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#22c55e'
                e.currentTarget.style.color = '#ffffff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff'
                e.currentTarget.style.color = '#22c55e'
              }}
            >
              ADD <span style={{ fontSize: 14 }}>+</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  // Grid card (HomePage Popular Meals, Today's Special, etc.)
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 16,
        background: '#ffffff',
        boxShadow: '0 3px 14px rgba(0,0,0,0.06)',
        border: '1px solid #f1f5f9',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {/* Top Image Banner */}
      <div style={{ position: 'relative', height: 130, background: '#f8fafc', overflow: 'hidden' }}>
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.3s ease',
          }}
        />

        {/* Badge */}
        {item.badge && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 6,
              letterSpacing: '0.04em',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
            }}
          >
            {item.badge}
          </span>
        )}

        {/* Rating pill on image */}
        <span
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          ⭐ {item.rating}
        </span>

        {/* Swiggy-style Add/Stepper on image overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            zIndex: 2,
          }}
        >
          {qty > 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#22c55e',
                borderRadius: 8,
                padding: '2px 4px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove?.()
                }}
                style={{
                  width: 24,
                  height: 24,
                  border: 'none',
                  background: 'none',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Decrease"
              >
                −
              </button>
              <span
                style={{
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 12,
                  minWidth: 16,
                  textAlign: 'center',
                }}
              >
                {qty}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAdd()
                }}
                style={{
                  width: 24,
                  height: 24,
                  border: 'none',
                  background: 'none',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Increase"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAdd()
              }}
              style={{
                background: '#ffffff',
                border: '1.5px solid #22c55e',
                borderRadius: 8,
                padding: '4px 14px',
                color: '#22c55e',
                fontWeight: 800,
                fontSize: 11,
                cursor: 'pointer',
                boxShadow: '0 3px 8px rgba(0,0,0,0.18)',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#22c55e'
                e.currentTarget.style.color = '#ffffff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff'
                e.currentTarget.style.color = '#22c55e'
              }}
            >
              ADD <span style={{ fontSize: 13 }}>+</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '12px 12px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: 3,
              border: `1.5px solid ${isVeg ? '#16a34a' : '#dc2626'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: isVeg ? '#16a34a' : '#dc2626',
                display: 'block',
              }}
            />
          </span>
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#0f172a',
              margin: 0,
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.name}
          </p>
        </div>

        <p
          style={{
            fontSize: 11,
            color: '#64748b',
            margin: '0 0 10px',
            lineHeight: 1.35,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.description}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'auto',
            paddingTop: 6,
            borderTop: '1px dashed #f1f5f9',
          }}
        >
          <div>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>₹{item.price}</span>
            <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>({item.time})</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b' }}>{item.counter}</span>
        </div>
      </div>
    </div>
  )
}
