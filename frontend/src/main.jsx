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

// --- REFEREE: Global Error Tracking ---
const sendErrorToReferee = async (message, error) => {
  try {
    const url = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
    let region = 'north';
    try {
      const sessionStr = localStorage.getItem('__ecotech_session');
      if (sessionStr) {
        region = JSON.parse(sessionStr).region || 'north';
      }
    } catch (e) {}

    const payloadMsg = message || 'Unknown UI Error';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // Generate HMAC SHA-256 Signature natively
    const secret = import.meta.env.VITE_REFEREE_SECRET || 'fallback-secret-for-dev';
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC', key, enc.encode(timestamp + payloadMsg)
    );
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

    fetch(`${url}/log/error`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-timestamp': timestamp,
        'x-signature': signatureHex
      },
      body: JSON.stringify({
        message: payloadMsg,
        stack_trace: error?.stack || null,
        url: window.location.href,
        user_agent: navigator.userAgent,
        region: region
      })
    }).catch(() => {});
  } catch (e) {}
};

window.addEventListener('error', (event) => {
  sendErrorToReferee(event.message, event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  sendErrorToReferee(event.reason?.message || 'Unhandled Promise Rejection', event.reason);
});

import { GoogleOAuthProvider } from '@react-oauth/google';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId="279406375654-e0cegh0bmm9he2dcalovns8ulf44s1ns.apps.googleusercontent.com">
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
)
