import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { storage } from '../utils/storage'
import { GoogleLogin } from '@react-oauth/google'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '', region: 'north' })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      if (mode === 'register') {
        const res = await api.register(form)
        if (res.id) {
          setMode('login')
          setError('') // switch to login with success
        } else {
          setError(res.detail || 'Registration failed')
        }
      } else {
        const res = await api.login({ email: form.email, password: form.password, region: form.region })
        if (res.access_token) {
          storage.set('session', {
            token: res.access_token,
            userId: res.user_id,
            region: res.shard_region
          })
          navigate('/')
        } else {
          setError(res.detail || 'Login failed')
        }
      }
    } catch {
      setError('Cannot reach server. Check if the backend is running.')
    }
    setLoading(false)
  }

  async function handleGoogleSuccess(credentialResponse) {
    setLoading(true); setError('')
    try {
      const res = await api.googleLogin(credentialResponse.credential)
      if (res.access_token) {
        storage.set('session', {
          token: res.access_token,
          userId: res.user_id,
          region: res.shard_region
        })
        navigate('/')
      } else {
        setError(res.detail || 'Google Login failed')
      }
    } catch {
      setError('Google Login failed. Server error.')
    }
    setLoading(false)
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card glass">
        {/* Logo */}
        <div className="auth-logo">🌍 EcoTech Exchange</div>
        <div className="auth-tagline">
          {mode === 'login' ? 'Sign in to your shard-routed account' : 'Join the hardware circular economy'}
        </div>

        {error && (
          <div className="toast toast-error" style={{ marginBottom: '1rem' }}>{error}</div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="e.g. DJ Sharma" value={form.name} onChange={set('name')} required />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••••••" value={form.password} onChange={set('password')} required />
          </div>

          <div className="form-group">
            <label className="form-label">Region (Database Shard)</label>
            <select className="form-select" value={form.region} onChange={set('region')}>
              <option value="north">🔵 North Shard</option>
              <option value="south">🟢 South Shard</option>
            </select>
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>
        </form>

        <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ margin: '0 1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google Login Failed')}
            theme="filled_black"
            shape="pill"
          />
        </div>

        <div className="auth-toggle">
          {mode === 'login' ? (
            <>No account? <button onClick={() => { setMode('register'); setError('') }}>Register</button></>
          ) : (
            <>Already have one? <button onClick={() => { setMode('login'); setError('') }}>Sign In</button></>
          )}
        </div>
      </div>
    </div>
  )
}
