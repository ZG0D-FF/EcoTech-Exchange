// Environment Namespacing — prevents local dev data from colliding with production
// This is the SLIC FAST Storage design principle applied to the frontend.
const ENV = import.meta.env.MODE === 'production' ? 'prod' : 'local'
const PREFIX = `ecotech_${ENV}_`

export const storage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(PREFIX + key)
      return item ? JSON.parse(item) : null
    } catch { return null }
  },
  set: (key, value) => {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)) }
    catch { /* storage full */ }
  },
  remove: (key) => localStorage.removeItem(PREFIX + key),
  clear: () => {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k))
  }
}
