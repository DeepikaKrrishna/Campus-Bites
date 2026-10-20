const steps = [
  { label: 'Order Placed',       sub: 'Order received at the counter',      done: true  },
  { label: 'Payment Confirmed',  sub: 'Payment successfully processed',      done: true  },
  { label: 'Being Prepared',     sub: 'The canteen is preparing your food',  done: true  },
  { label: 'Ready for Pickup',   sub: 'Collect from the pickup window',      done: false },
]

export default function TrackPage() {
  return (
    <div style={{ background: '#f8f8f8', minHeight: '100%', padding: '24px 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: '#1a1a1a' }}>Track your order</h1>
      <p style={{ fontSize: 13, color: '#aaa', margin: '0 0 20px' }}>Your food is ready at the pickup window!</p>

      {/* Status banner */}
      <div style={{
        background: '#22c55e', borderRadius: 14,
        padding: '16px 18px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: '#fff',
        }}>✓</div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>Ready for pickup!</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: 0 }}>Show order #CB37839 at the counter</p>
        </div>
      </div>

      {/* Order info */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 11, color: '#aaa', margin: '0 0 4px' }}>Order number</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', margin: '0 0 4px' }}>#CB37839</p>
            <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>3 items · ₹350 · Cash</p>
          </div>
          <span style={{
            padding: '4px 12px', borderRadius: 20,
            background: '#f0fdf4', color: '#22c55e',
            fontSize: 12, fontWeight: 700,
          }}>Ready!</span>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const isActive = !step.done && steps[i - 1]?.done
          return (
            <div key={step.label} style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 20, position: 'relative' }}>
              {/* Line */}
              {!isLast && (
                <div style={{
                  position: 'absolute', left: 15, top: 32, bottom: 0, width: 2,
                  background: step.done ? '#22c55e' : '#e8e8e8',
                }} />
              )}
              {/* Dot */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                background: step.done ? '#22c55e' : isActive ? '#FFA500' : '#e8e8e8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>
                {step.done ? <span style={{ color: '#fff' }}>✓</span> : isActive ? <span style={{ color: '#fff' }}>●</span> : null}
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: '0 0 3px' }}>{step.label}</p>
                  <span style={{ fontSize: 11, color: '#bbb' }}>22:50</span>
                </div>
                <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>{step.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Rating */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>⭐</span>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Don't forget to rate!</p>
        </div>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 14px' }}>Help your fellow foodies — how was Filter Coffee?</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[1, 2, 3, 4, 5].map(s => (
            <span key={s} style={{ fontSize: 28, color: '#ddd', cursor: 'pointer' }}>☆</span>
          ))}
        </div>
        <button style={{
          width: '100%', padding: '12px',
          borderRadius: 12, background: '#e8e8e8',
          color: '#888', fontWeight: 600, fontSize: 14,
        }}>
          Submit rating
        </button>
      </div>

      {/* Items */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Items</p>
        {[['1× Filter Coffee', '₹25'], ['1× Chicken Biryani', '₹160'], ['1× Cheese Burger', '₹130']].map(([name, price]) => (
          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#555' }}>{name}</span>
            <span style={{ fontSize: 13, color: '#555' }}>{price}</span>
          </div>
        ))}
        <div style={{ height: 1, background: '#f0f0f0', margin: '10px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>Paid via Cash</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>₹350</span>
        </div>
      </div>

      {/* Earlier orders */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px' }}>
        <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Earlier orders</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: '#1a1a1a' }}>#CB56559</p>
            <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>15 Sept</p>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>₹275</span>
        </div>
      </div>
    </div>
  )
}
