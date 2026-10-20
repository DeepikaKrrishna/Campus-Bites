import type { AppUser } from '../lib/auth'

const menuItems = [
  { icon: '📋', label: 'Order History',  sub: 'View all your past orders' },
  { icon: '❤️', label: 'Favourites',    sub: 'Your saved dishes' },
  { icon: '⚙️', label: 'Settings',      sub: 'Preferences & account' },
  { icon: '❓', label: 'Help & Support', sub: 'FAQs & canteen help desk' },
]

export default function ProfilePage({ user, onLogout }: { user: AppUser; onLogout: () => void }) {
  return (
    <div style={{ background: '#f8f8f8', minHeight: '100%', padding: '24px 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 20px', color: '#1a1a1a' }}>Profile</h1>

      {/* Profile card */}
      <div style={{
        background: 'linear-gradient(135deg, #2d8a4e, #22c55e)',
        borderRadius: 18, padding: '20px 20px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 24,
            background: 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, color: '#fff',
          }}>D</div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: '0 0 3px' }}>Deepika K</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>deepika@gmail.com</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[['ORDERS', '2'], ['SPENT', '₹625'], ['SAVED', '4']].map(([label, val]) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.18)',
              borderRadius: 10, padding: '10px 8px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 3px' }}>{val}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', margin: 0, letterSpacing: '0.06em' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden' }}>
        {menuItems.map((item, i) => (
          <button
            key={item.label}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 18px',
              borderBottom: i < menuItems.length - 1 ? '1px solid #f5f5f5' : 'none',
              background: '#fff',
              transition: 'background 0.15s',
              textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fafafa' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: '#f5f5f5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>{item.icon}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: '0 0 3px' }}>{item.label}</p>
              <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>{item.sub}</p>
            </div>
            <span style={{ color: '#ccc', fontSize: 18 }}>›</span>
          </button>
        ))}
      </div>

      <button
        onClick={onLogout}
        style={{
          width: '100%', padding: '14px', borderRadius: 14,
          border: '1.5px solid #e8e8e8', background: '#fff',
          color: '#ef4444', fontWeight: 600, fontSize: 14, marginTop: 20,
          transition: 'all 0.15s',
        }}
      >
        Log Out
      </button>
      <p style={{ textAlign: 'center', fontSize: 11, color: '#ccc', marginTop: 16 }}>
        Member since {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} · CampusBites v1.0
      </p>
    </div>
  )
}
