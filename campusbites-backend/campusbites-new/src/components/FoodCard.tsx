import type { MenuItem } from '../data/menuItems'

type Props = {
  item: MenuItem
  onAdd: () => void
  qty: number
  compact?: boolean
}

export default function FoodCard({ item, onAdd, qty, compact }: Props) {
  if (compact) {
    // Horizontal list row (Menu page / All Items)
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid #f5f5f5',
      }}>
        {/* Image */}
        <div style={{ position: 'relative', flexShrink: 0, width: 84, height: 84, borderRadius: 12, overflow: 'hidden', background: '#f5f5f5' }}>
          <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {item.badge && (
            <span style={{
              position: 'absolute', bottom: 0, left: 0,
              background: '#FF6B35', color: '#fff',
              fontSize: 9, fontWeight: 700, padding: '2px 6px',
              letterSpacing: '0.04em',
            }}>{item.badge}</span>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 2 }}>
            <span style={{
              width: 14, height: 14, borderRadius: 2, border: '2px solid #22a64a', flexShrink: 0, marginTop: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22a64a', display: 'block' }} />
            </span>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: 0, lineHeight: 1.3 }}>{item.name}</p>
          </div>
          <p style={{ fontSize: 12, color: '#999', margin: '0 0 6px', lineHeight: 1.4, paddingLeft: 18 }}>
            {item.description.length > 60 ? item.description.slice(0, 60) + '…' : item.description}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 18 }}>
            <span style={{ fontSize: 11, color: '#555', display: 'flex', alignItems: 'center', gap: 3 }}>
              ⭐ <span style={{ fontWeight: 600 }}>{item.rating}</span>
              <span style={{ color: '#bbb' }}>({item.ratingCount})</span>
            </span>
            <span style={{ color: '#ddd' }}>·</span>
            <span style={{ fontSize: 11, color: '#888' }}>🕐 {item.time}</span>
          </div>
        </div>

        {/* Price + Add */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>₹{item.price}</span>
          {qty > 0 ? (
            <span style={{
              fontSize: 13, fontWeight: 700, color: '#22c55e',
              border: '1.5px solid #22c55e', borderRadius: 8,
              padding: '4px 12px',
            }}>{qty} ✓</span>
          ) : (
            <button
              onClick={onAdd}
              style={{
                border: '1.5px solid #22c55e', borderRadius: 8,
                padding: '5px 14px',
                color: '#22c55e', fontWeight: 700, fontSize: 13,
                background: '#fff',
                transition: 'all 0.15s',
              }}
            >
              ADD
            </button>
          )}
        </div>
      </div>
    )
  }

  // Grid card (Popular Meals / Today's Special)
  return (
    <div style={{
      borderRadius: 14,
      background: '#fff',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      overflow: 'hidden',
      cursor: 'pointer',
    }}>
      <div style={{ position: 'relative', height: 120, background: '#f5f5f5' }}>
        <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {item.badge && (
          <span style={{
            position: 'absolute', bottom: 0, left: 0,
            background: '#FF6B35', color: '#fff',
            fontSize: 9, fontWeight: 700, padding: '3px 8px',
            letterSpacing: '0.04em',
          }}>{item.badge}</span>
        )}
        <button
          onClick={e => { e.stopPropagation(); onAdd() }}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 28, height: 28, borderRadius: '50%',
            background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            fontSize: 14, color: qty > 0 ? '#FF6B35' : '#ccc',
          }}
        >
          ♥
        </button>
        {qty > 0 && (
          <span style={{
            position: 'absolute', top: 8, left: 8,
            background: '#FF6B35', color: '#fff',
            fontSize: 10, fontWeight: 700,
            width: 20, height: 20, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{qty}</span>
        )}
      </div>
      <div style={{ padding: '10px 10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{
            width: 12, height: 12, borderRadius: 2, border: '1.5px solid #22a64a',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22a64a', display: 'block' }} />
          </span>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', margin: 0, lineHeight: 1.3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120,
          }}>
            {item.name.length > 14 ? item.name.slice(0, 14) + '…' : item.name}
          </p>
        </div>
        <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 6px', paddingLeft: 16,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.description.length > 28 ? item.description.slice(0, 28) + '…' : item.description}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>₹{item.price}</span>
          <span style={{ fontSize: 11, color: '#888' }}>⭐ {item.rating}</span>
        </div>
      </div>
    </div>
  )
}
