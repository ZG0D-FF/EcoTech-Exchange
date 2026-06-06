import { storage } from './storage'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const pendingMutations = new Set();
export const clearBrowserCache = () => sessionStorage.removeItem('hr_dashboard_cache');

const safeFetch = async (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'DELETE'].includes(method);
  let signature = null;
  
  if (isMutation) {
    signature = `${method}:${url}:${options.body || ''}`;
    if (pendingMutations.has(signature)) {
      console.warn('Blocked duplicate rapid-fire mutation:', signature);
      return Promise.reject({ detail: 'Rate Limit: Duplicate request blocked.' });
    }
    pendingMutations.add(signature);
    clearBrowserCache(); // Auto-invalidate on mutation
  }

  try {
    return await safeFetch(url, options);
  } finally {
    if (isMutation && signature) {
      setTimeout(() => pendingMutations.delete(signature), 500);
    }
  }
};

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
    safeFetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),

  login: (data) =>
    safeFetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),

  googleLogin: (token, region) =>
    safeFetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, region })
    }).then(r => r.json()),

  getEquipment: () =>
    safeFetch(`${BASE_URL}/equipment`, { headers: getHeaders() }).then(r => r.json()),

  createEquipment: (data) =>
    safeFetch(`${BASE_URL}/equipment`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    }).then(r => r.json()),

  syncEquipment: (lastSyncedAt) =>
    safeFetch(`${BASE_URL}/sync/equipment?last_synced_at=${lastSyncedAt}`, {
      headers: getHeaders()
    }).then(r => r.json()),

  deleteEquipment: (itemId) =>
    safeFetch(`${BASE_URL}/equipment/${itemId}`, {
      method: 'DELETE',
      headers: getHeaders()
    }).then(r => r.json()),

  getCart: () => safeFetch(`${BASE_URL}/cart`, { headers: getHeaders() }).then(r => r.json()),

  addToCart: (equipmentId) =>
    safeFetch(`${BASE_URL}/cart`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ equipment_id: equipmentId })
    }).then(r => r.json()),

  removeFromCart: (cartId) =>
    safeFetch(`${BASE_URL}/cart/${cartId}`, {
      method: 'DELETE',
      headers: getHeaders()
    }).then(r => r.json()),

  clockIn: (status) =>
    safeFetch(`${BASE_URL}/attendance/clock-in`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ status })
    }).then(r => r.json()),

  clockOut: (recordId) =>
    safeFetch(`${BASE_URL}/attendance/clock-out`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ record_id: recordId })
    }).then(r => r.json()),

  getMonthlyAttendance: (month) =>
    safeFetch(`${BASE_URL}/attendance/monthly?month=${month}`, { headers: getHeaders() }).then(r => r.json()),

  getMyLeaveSummary: (month) =>
    safeFetch(`${BASE_URL}/attendance/my-summary?month=${month}`, { headers: getHeaders() }).then(r => r.json()),

  getHRDashboard: async () => {
    const cached = sessionStorage.getItem('hr_dashboard_cache');
    if (cached) return JSON.parse(cached);
    
    const r = await safeFetch(`${BASE_URL}/hr/dashboard`, { headers: getHeaders() });
    const data = await r.json();
    if (r.ok) sessionStorage.setItem('hr_dashboard_cache', JSON.stringify(data));
    return data;
  },

  sendHRMessage: (data) =>
    safeFetch(`${BASE_URL}/hr/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    }).then(r => r.json()),

  editCell: (table, id, column, value) =>
    safeFetch(`${BASE_URL}/hr/edit-cell`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ table, id, column, value })
    }).then(r => r.json()),
	
  editCellBatch: (editsArray) =>
    safeFetch(`${BASE_URL}/hr/edit-cell-batch`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ edits: editsArray })
    }).then(r => r.json()),
	
  requestLeave: (data) =>
    safeFetch(`${BASE_URL}/hr/leaves/request`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    }).then(async r => {
      const res = await r.json();
      if (!r.ok) throw res;
      return res;
    }),

  addDynamicColumn: (table, column, password) => 
    safeFetch(`${BASE_URL}/hr/dynamic/column`, { 
      method: 'POST', 
      headers: getHeaders(), 
      body: JSON.stringify({ table, column, password }) 
    }).then(r => r.json()),
    
  deleteDynamicColumn: (table, column, password) => 
    safeFetch(`${BASE_URL}/hr/dynamic/column`, { 
      method: 'DELETE', 
      headers: getHeaders(), 
      body: JSON.stringify({ table, column, password }) 
    }).then(r => r.json()),
    
  addDynamicRow: (table) => 
    safeFetch(`${BASE_URL}/hr/dynamic/row`, { 
      method: 'POST', 
      headers: getHeaders(), 
      body: JSON.stringify({ table }) 
    }).then(r => r.json()),
    
  deleteDynamicRow: (table, row_id) => 
    safeFetch(`${BASE_URL}/hr/dynamic/row/${table}/${row_id}`, { 
      method: 'DELETE', 
      headers: getHeaders() 
    }).then(r => r.json()),
    
  restoreDynamicRow: (table, row_id) => 
    safeFetch(`${BASE_URL}/hr/dynamic/row/restore/${table}/${row_id}`, { 
      method: 'PUT', 
      headers: getHeaders() 
    }).then(r => r.json()),
}

