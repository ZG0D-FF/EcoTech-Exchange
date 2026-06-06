import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../utils/api'

export default function Cart() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadCart()
  }, [])

  async function loadCart() {
    setLoading(true)
    try {
      const res = await api.getCart()
      setItems(res.cart || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function handleRemove(cartId) {
    try {
      await api.removeFromCart(cartId)
      setItems(prev => prev.filter(i => i.cart_id !== cartId))
    } catch (e) {
      alert("Failed to remove item")
    }
  }

  const totalBuy = items.reduce((sum, i) => sum + (i.price || 0), 0)
  const totalRent = items.reduce((sum, i) => sum + (i.rental_price_per_day || 0), 0)

  return (
    <>
      <nav className="navbar">
        <a className="navbar-brand" href="/">🌍 EcoTech Exchange</a>
        <div className="navbar-actions">
          <Link to="/" className="btn btn-ghost btn-sm">← Back to Dashboard</Link>
        </div>
      </nav>
      <main className="container page">
        <div className="section-header">
          <span className="section-title">Requisition Queue</span>
        </div>
        
        {loading ? <p>Loading queue...</p> : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛒</div>
            <div className="empty-title">Queue is empty</div>
            <p>Go back to the dashboard to add equipment to your queue.</p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>Browse Hardware</Link>
          </div>
        ) : (
          <div>
            {items.map(item => (
              <div key={item.cart_id} className="equipment-card glass" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
                <div>
                  <div className="card-title">{item.title}</div>
                  <div className="card-category">{item.category}</div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    {item.price > 0 && <div style={{ fontSize: '0.9rem' }}>Buy: ₹{item.price}</div>}
                    {item.rental_price_per_day > 0 && <div style={{ fontSize: '0.9rem', color: '#38bdf8' }}>Rent: ₹{item.rental_price_per_day}/day</div>}
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ color: '#ff4444' }} onClick={() => handleRemove(item.cart_id)}>Remove</button>
                </div>
              </div>
            ))}
            
            <div className="glass" style={{ padding: '1.5rem', marginTop: '2rem', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>Queue Summary</h3>
              <p><strong>Total Procurement:</strong> ₹{totalBuy.toLocaleString()}</p>
              <p><strong>Total Daily Lease:</strong> ₹{totalRent.toLocaleString()}/day</p>
              <button className="btn btn-primary" style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }} onClick={() => alert('Checkout flow not implemented yet.')}>Submit Requisition</button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
