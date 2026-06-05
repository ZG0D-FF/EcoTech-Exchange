import { storage } from './storage'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

// Reads the JWT + region from namespaced localStorage and injects into every request
function getHeaders(extra = {}) {
  const session = storage.get('session')
  return {
    'Content-Type': 'application/json',
    'x-region': session?.region || 'north',
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    ...extra
  }
}

export const api = {
  register: (data) =>
    fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),

  login: (data) =>
    fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),

  googleLogin: (token) =>
    fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    }).then(r => r.json()),

  getEquipment: () =>
    fetch(`${BASE_URL}/equipment`, { headers: getHeaders() }).then(r => r.json()),

  createEquipment: (data) =>
    fetch(`${BASE_URL}/equipment`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    }).then(r => r.json()),

  syncEquipment: (lastSyncedAt) =>
    fetch(`${BASE_URL}/sync/equipment?last_synced_at=${lastSyncedAt}`, {
      headers: getHeaders()
    }).then(r => r.json())
}
