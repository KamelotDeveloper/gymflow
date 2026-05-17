import { createContext, useContext, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '../hooks/useAuth'

type AuthContextType = {
  user: User | null
  profile: { id: string; role: 'admin' | 'member'; full_name: string } | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return ctx
}
