import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../utils/api'
import { storage } from '../utils/storage'

export default function AddEquipment() {
  const [form, setForm] = useState({
    title: '', description: '', category: 'Microcontroller',
    price: '', rental_price_per_day: '',
    is_for_sale: true, condition: 'New'
  })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const navigate = useNavigate()
  const session = storage.get('session')

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(f => ({ ...f, [k]: val }))
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!session?.userId) { showToast('No session found. Please login again.', 'error'); return }
    setLoading(true)

    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      price: form.price ? parseFloat(form.price) : null,
      rental_price_per_day: form.rental_price_per_day ? parseFloat(form.rental_price_per_day) : null,
      is_for_sale: form.is_for_sale,
      condition: form.condition,
      seller_id: session.userId
    }

    try {
      const res = await api.createEquipment(payload)
      if (res.id) {
        showToast(`Listed successfully! Task Queue is processing images in the background.`)
        setTimeout(() => navigate('/'), 1800)
      } else {
        showToast(res.detail || 'Failed to list equipment', 'error')
      }
    } catch {
      showToast('Cannot reach server. Check if the backend is running.', 'error')
    }
    setLoading(false)
  }

  return (
    <>
      <nav className="navbar">
        <a className="navbar-brand" href="/">🌍 EcoTech Exchange</a>
        <div className="navbar-actions">
          <Link to="/" className="btn btn-ghost btn-sm">← Back to Dashboard</Link>
        </div>
      </nav>

      <main className="container page">
        <div className="add-form-wrapper">
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 className="section-title" style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>List Hardware</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Your listing will be routed to the <strong style={{ color: 'var(--accent)' }}>{session?.region}</strong> shard and image processing will run asynchronously via the Task Queue.
            </p>
          </div>

          <form className="add-form-card glass" onSubmit={handleSubmit}>
            <div className="add-form-grid">

              <div className="form-group add-form-full">
                <label className="form-label">Title *</label>
                <input className="form-input" placeholder="e.g. Raspberry Pi Zero 2W" value={form.title} onChange={set('title')} required />
              </div>

              <div className="form-group add-form-full">
                <label className="form-label">Description</label>
                <input className="form-input" placeholder="Short description of the hardware" value={form.description} onChange={set('description')} />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={set('category')}>
                  {['Microcontroller', 'SBC', 'Sensor', 'PCB', 'Power Supply', 'RF Module', 'Oscilloscope', 'Other'].map(c =>
                    <option key={c}>{c}</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Condition</label>
                <select className="form-select" value={form.condition} onChange={set('condition')}>
                  <option>New</option>
                  <option>Refurbished</option>
                  <option>Parts</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Buy Price (₹) — leave blank if rent only</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 1500" value={form.price} onChange={set('price')} />
              </div>

              <div className="form-group">
                <label className="form-label">Rental Price / Day (₹) — leave blank if sale only</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 150" value={form.rental_price_per_day} onChange={set('rental_price_per_day')} />
              </div>

              <div className="form-group add-form-full" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                <input type="checkbox" id="is_for_sale" checked={form.is_for_sale} onChange={set('is_for_sale')} style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} />
                <label htmlFor="is_for_sale" style={{ color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem' }}>
                  Mark as available for purchase
                </label>
              </div>

              <div className="add-form-full" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <Link to="/" className="btn btn-ghost">Cancel</Link>
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading ? 'Listing…' : '⚡ List Hardware'}
                </button>
              </div>

            </div>
          </form>
        </div>
      </main>

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
    </>
  )
}
