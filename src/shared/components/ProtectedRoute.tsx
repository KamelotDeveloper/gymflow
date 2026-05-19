import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthContext } from './AuthContext'

type Props = {
  children: ReactNode
  allowedRole: 'admin' | 'member'
}

export default function ProtectedRoute({ children, allowedRole }: Props) {
  const { user, profile, loading } = useAuthContext()

  if (loading || (user && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profile && profile.role !== allowedRole) {
    if (profile.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />
    }
    return <Navigate to="/user/rutina" replace />
  }

  return <>{children}</>
}
