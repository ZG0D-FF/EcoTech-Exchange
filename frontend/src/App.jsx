import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { storage } from './utils/storage'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import AddEquipment from './pages/AddEquipment'
import Cart from './pages/Cart'
import Attendance from './pages/Attendance'

function PrivateRoute({ children }) {
  const session = storage.get('session')
  return session?.token ? children : <Navigate to="/auth" replace />
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/cart" element={<PrivateRoute><Cart /></PrivateRoute>} />
        <Route path="/attendance" element={<PrivateRoute><Attendance /></PrivateRoute>} />
        <Route path="/add" element={<PrivateRoute><AddEquipment /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
