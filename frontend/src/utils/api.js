import { storage } from './storage'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

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

  googleLogin: (token, region) =>
    fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, region })
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
    }).then(r => r.json()),

  deleteEquipment: (itemId) =>
    fetch(`${BASE_URL}/equipment/${itemId}`, {
      method: 'DELETE',
      headers: getHeaders()
    }).then(r => r.json()),

  getCart: () => fetch(`${BASE_URL}/cart`, { headers: getHeaders() }).then(r => r.json()),

  addToCart: (equipmentId) =>
    fetch(`${BASE_URL}/cart`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ equipment_id: equipmentId })
    }).then(r => r.json()),

  removeFromCart: (cartId) =>
    fetch(`${BASE_URL}/cart/${cartId}`, {
      method: 'DELETE',
      headers: getHeaders()
    }).then(r => r.json()),

  clockIn: (status) =>
    fetch(`${BASE_URL}/attendance/clock-in`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ status })
    }).then(r => r.json()),

  clockOut: (recordId) =>
    fetch(`${BASE_URL}/attendance/clock-out`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ record_id: recordId })
    }).then(r => r.json()),

  getMonthlyAttendance: (month) =>
    fetch(`${BASE_URL}/attendance/monthly?month=${month}`, { headers: getHeaders() }).then(r => r.json()),

  getMyLeaveSummary: (month) =>
    fetch(`${BASE_URL}/attendance/my-summary?month=${month}`, { headers: getHeaders() }).then(r => r.json()),

  getHRDashboard: () =>
    fetch(`${BASE_URL}/hr/dashboard?t=${Date.now()}`, { headers: getHeaders(), cache: 'no-store' }).then(r => r.json()),

  sendHRMessage: (data) =>
    fetch(`${BASE_URL}/hr/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    }).then(r => r.json()),

  editCell: (table, id, column, value) =>
    fetch(`${BASE_URL}/hr/edit-cell`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ table, id, column, value })
    }).then(r => r.json()),
	
  requestLeave: (data) =>
    fetch(`${BASE_URL}/hr/leaves/request`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    }).then(async r => {
      const res = await r.json();
      if (!r.ok) throw res;
      return res;
    }),

  addDynamicColumn: (table, column, password) => 
    fetch(`${BASE_URL}/hr/dynamic/column`, { 
      method: 'POST', 
      headers: getHeaders(), 
      body: JSON.stringify({ table, column, password }) 
    }).then(r => r.json()),
    
  deleteDynamicColumn: (table, column, password) => 
    fetch(`${BASE_URL}/hr/dynamic/column`, { 
      method: 'DELETE', 
      headers: getHeaders(), 
      body: JSON.stringify({ table, column, password }) 
    }).then(r => r.json()),
    
  addDynamicRow: (table) => 
    fetch(`${BASE_URL}/hr/dynamic/row`, { 
      method: 'POST', 
      headers: getHeaders(), 
      body: JSON.stringify({ table }) 
    }).then(r => r.json()),
    
  deleteDynamicRow: (table, row_id) => 
    fetch(`${BASE_URL}/hr/dynamic/row/${table}/${row_id}`, { 
      method: 'DELETE', 
      headers: getHeaders() 
    }).then(r => r.json()),
    
  restoreDynamicRow: (table, row_id) => 
    fetch(`${BASE_URL}/hr/dynamic/row/restore/${table}/${row_id}`, { 
      method: 'PUT', 
      headers: getHeaders() 
    }).then(r => r.json()),
}

