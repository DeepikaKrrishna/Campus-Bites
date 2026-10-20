import type { Tab } from '../App'

const NAV = [
  { key: 'home',    label: 'Home',    icon: HomeIcon },
  { key: 'menu',    label: 'Menu',    icon: MenuIcon },
  { key: 'cart',    label: 'Cart',    icon: CartIcon },
  { key: 'track',   label: 'Track',   icon: TrackIcon },
  { key: 'profile', label: 'Profile', icon: ProfileIcon },
] as const

export default function BottomNav({
  tab, onChange, totalItems,
}: { tab: Tab; onChange: (t: Tab) => void; totalItems: number }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 72,
      background: '#fff',
      borderTop: '1px solid #f0f0f0',
      display: 'flex', alignItems: 'center',
      borderRadius: '0 0 32px 32px',
      padding: '0 8px',
    }}>
      {NAV.map(({ key, label, icon: Icon }) => {
        const active = tab === key
        const isCart = key === 'cart'
        return (
          <button
            key={key}
            onClick={() => onChange(key as Tab)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4,
              padding: '8px 0',
              position: 'relative',
            }}
          >
            <div style={{ position: 'relative' }}>
              <Icon color={active ? '#22c55e' : '#b0b0b0'} />
              {isCart && totalItems > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -7,
                  background: '#FF6B35',
                  color: '#fff', fontSize: 9, fontWeight: 700,
                  minWidth: 16, height: 16, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px',
                  border: '1.5px solid #fff',
                }}>{totalItems}</span>
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? '#22c55e' : '#b0b0b0' }}>
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function HomeIcon({ color }: { color: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" stroke={color} strokeWidth="2" strokeLinejoin="round"/><path d="M9 21V12h6v9" stroke={color} strokeWidth="2" strokeLinejoin="round"/></svg>
}
function MenuIcon({ color }: { color: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="2" rx="1" fill={color}/><rect x="3" y="11" width="18" height="2" rx="1" fill={color}/><rect x="3" y="17" width="18" height="2" rx="1" fill={color}/></svg>
}
function CartIcon({ color }: { color: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke={color} strokeWidth="2" strokeLinejoin="round"/><line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth="2"/><path d="M16 10a4 4 0 01-8 0" stroke={color} strokeWidth="2" strokeLinecap="round"/></svg>
}
function TrackIcon({ color }: { color: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke={color} strokeWidth="2" strokeLinecap="round"/></svg>
}
function ProfileIcon({ color }: { color: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="2" strokeLinecap="round"/></svg>
}
