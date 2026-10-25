import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

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
    console.error('Staff Dashboard UI error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="center-state" style={{ padding: 30, textAlign: 'center' }}>
          <div className="brand-mark">CB</div>
          <h2>Dashboard Display Error</h2>
          <p style={{ maxWidth: 500, color: '#dc2626', background: '#fef2f2', padding: 15, borderRadius: 10 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            className="primary"
            style={{ padding: '10px 20px', marginTop: 15 }}
            onClick={() => window.location.reload()}
          >
            Reload Dashboard
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
  </React.StrictMode>
)
