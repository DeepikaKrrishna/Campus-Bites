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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

