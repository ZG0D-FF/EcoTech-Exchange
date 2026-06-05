import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../utils/api'
import { storage } from '../utils/storage'

function SkeletonCard() {
  return <div className="skeleton skeleton-card" />
}

function EquipmentCard({ item }) {
  const cond = item.condition?.toLowerCase()
  return (
    <div className="equipment-card glass">
      <div className="card-header">
        <span className="card-title">{item.title}</span>
        <span className="card-category">{item.category}</span>
      </div>
      {item.description && <p className="card-desc">{item.description}</p>}
      <div className="card-badges">
        {item.is_for_sale && <span className="badge badge-sale">For Sale</span>}
        {item.rental_price_per_day && <span className="badge badge-rent">For Rent</span>}
        {cond === 'new' && <span className="badge badge-new">New</span>}
        {cond === 'refurbished' && <span className="badge badge-refurb">Refurbished</span>}
        {cond === 'parts' && <span className="badge badge-parts">Parts Only</span>}
      </div>
      <div className="card-prices">
        {item.price != null && (
          <div className="price-item">
            <span className="price-label">Buy Price</span>
            <span className="price-value">₹{item.price.toLocaleString()}</span>
          </div>
        )}
        {item.rental_price_per_day != null && (
          <div className="price-item">
            <span className="price-label">Per Day</span>
            <span className="price-value accent">₹{item.rental_price_per_day}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('') // 'cache' | 'database'
  const [filter, setFilter] = useState('')
  const [chip, setChip] = useState('all')
  const navigate = useNavigate()
  const session = storage.get('session')

  useEffect(() => {
    loadEquipment()
  }, [])

  async function loadEquipment() {
    setLoading(true)
    try {
      const res = await api.getEquipment()
      setEquipment(res.equipment || [])
      setSource(res.source || 'database')
    } catch {
      setSource('offline')
    }
    setLoading(false)
  }

  function logout() {
    storage.clear()
    navigate('/auth')
  }

  const filtered = equipment.filter(e => {
    const matchSearch = e.title?.toLowerCase().includes(filter.toLowerCase()) ||
                        e.category?.toLowerCase().includes(filter.toLowerCase())
    if (chip === 'sale') return matchSearch && e.is_for_sale
    if (chip === 'rent') return matchSearch && e.rental_price_per_day != null
    return matchSearch
  })

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <a className="navbar-brand" href="/">🌍 EcoTech Exchange</a>
        <div className="navbar-actions">
          <span className="sync-pill" style={{ color: 'var(--text-muted)' }}>
            {session?.region === 'south' ? '🟢' : '🔵'} {session?.region} shard
          </span>
          <Link to="/add" className="btn btn-primary btn-sm">+ List Hardware</Link>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </nav>

      <main className="container page">
        {/* Hero */}
        <section className="hero">
          <div className="hero-eyebrow">♻️ Hardware Circular Economy</div>
          <h1 className="hero-title">
            Trade. Rent. Recover.<br />
            <span className="highlight">Tech that lives on.</span>
          </h1>
          <p className="hero-sub">
            Rent oscilloscopes, sell your old dev boards, or find refurbished sensors.
            All synced with a distributed enterprise backend.
          </p>
          <div className="hero-actions">
            <Link to="/add" className="btn btn-primary">List Your Hardware →</Link>
            <button className="btn btn-ghost" onClick={loadEquipment}>↻ Refresh</button>
          </div>
        </section>

        {/* Stats */}
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-value">{equipment.length}</div>
            <div className="stat-label">Listed Items</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{equipment.filter(e => e.rental_price_per_day).length}</div>
            <div className="stat-label">Available to Rent</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{equipment.filter(e => e.is_for_sale).length}</div>
            <div className="stat-label">For Sale</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">2</div>
            <div className="stat-label">DB Shards Live</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="filter-bar">
          <input
            placeholder="🔍  Search by title or category…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          {['all', 'sale', 'rent'].map(c => (
            <button key={c} className={`filter-chip ${chip === c ? 'active' : ''}`} onClick={() => setChip(c)}>
              {c === 'all' ? 'All' : c === 'sale' ? '💰 Buy' : '🔄 Rent'}
            </button>
          ))}
        </div>

        {/* Section Header */}
        <div className="section-header">
          <span className="section-title">Available Hardware</span>
          {source && (
            <span className={`sync-pill ${source}`}>
              {source === 'cache' ? '⚡ Cached' : source === 'offline' ? '📴 Offline' : '🗄 Database'}
            </span>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="equipment-grid">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-title">No hardware listed yet</div>
            <p>Be the first to list an oscilloscope, dev board, or sensor!</p>
            <Link to="/add" className="btn btn-primary" style={{ marginTop: '1.25rem' }}>List Hardware →</Link>
          </div>
        ) : (
          <div className="equipment-grid">
            {filtered.map(item => <EquipmentCard key={item.id} item={item} />)}
          </div>
        )}
      </main>
    </>
  )
}
