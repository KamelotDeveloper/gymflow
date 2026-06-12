import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './shared/components/AuthContext'
import ProtectedRoute from './shared/components/ProtectedRoute'
import Login from './pages/Login'

import AdminDashboard from './admin/pages/Dashboard'
import Members from './admin/pages/Members'
import Plans from './admin/pages/Plans'
import PlanCatalog from './admin/pages/PlanCatalog'
import Exercises from './admin/pages/Exercises'
import Routines from './admin/pages/Routines'
import News from './admin/pages/News'
import Config from './admin/pages/Config'
import Payments from './admin/pages/Payments'
import UserHome from './user/pages/Home'
import UserRutina from './user/pages/Rutina'
import UserExercises from './user/pages/Exercises'
import UserMembresia from './user/pages/Membresia'
import UserProgreso from './user/pages/Progreso'
import UserPerfil from './user/pages/Perfil'

const RENDER_URL = import.meta.env.VITE_BACKEND_URL || 'https://gymflow-8ect.onrender.com'

function App() {
  // Mantiene Render despierto mientras alguien tenga la app abierta
  useEffect(() => {
    const ping = () => {
      fetch(`${RENDER_URL}/api/health`).catch(() => {})
    }
    ping()
    const interval = setInterval(ping, 5 * 60 * 1000) // cada 5 min
    return () => clearInterval(interval)
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRole="admin">
                <Routes>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="members" element={<Members />} />
                  <Route path="routines" element={<Routines />} />
                  <Route path="exercises" element={<Exercises />} />
                  <Route path="plans" element={<Plans />} />
                  <Route path="plan-catalog" element={<PlanCatalog />} />
                  <Route path="news" element={<News />} />
                  <Route path="payments" element={<Payments />} />
                  <Route path="config" element={<Config />} />
                  <Route path="*" element={<Navigate to="dashboard" replace />} />
                </Routes>
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/*"
            element={
              <ProtectedRoute allowedRole="member">
                <Routes>
                  <Route index element={<UserHome />} />
                  <Route path="rutina" element={<UserRutina />} />
                  <Route path="ejercicios" element={<UserExercises />} />
                  <Route path="membresia" element={<UserMembresia />} />
                  <Route path="progreso" element={<UserProgreso />} />
                  <Route path="perfil" element={<UserPerfil />} />
                  <Route path="*" element={<Navigate to="" replace />} />
                </Routes>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
