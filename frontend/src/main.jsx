import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import { registerSW } from 'virtual:pwa-register'

// Register Service Worker for PWA / Offline-First support via Vite PWA
const updateSW = registerSW({
  onNeedRefresh() { console.log('[SW] App updated, refresh needed.') },
  onOfflineReady() { console.log('[SW] Registered — Offline-first mode active.') },
})

import { GoogleOAuthProvider } from '@react-oauth/google';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId="279406375654-e0cegh0bmm9he2dcalovns8ulf44s1ns.apps.googleusercontent.com">
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
)
