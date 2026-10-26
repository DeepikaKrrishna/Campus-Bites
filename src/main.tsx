import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { APP_ICON } from './assets/appLogo'

// Ensure favicon and title are always set to CampusBites mascot icon
try {
  let favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (!favicon) {
    favicon = document.createElement('link')
    favicon.rel = 'icon'
    document.head.appendChild(favicon)
  }
  favicon.type = 'image/jpeg'
  favicon.href = APP_ICON
  document.title = 'CampusBites - Campus Food Ordering'
} catch (_) {}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('CampusBites UI error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🍔</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ maxWidth: 440, margin: '0 auto 20px', color: '#ef4444', background: '#fef2f2', padding: 14, borderRadius: 12, fontSize: 13 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              background: '#16a34a',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => {
              localStorage.removeItem('cb_cart')
              window.location.reload()
            }}
          >
            Reload CampusBites
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

