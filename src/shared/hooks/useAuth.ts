import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<{ id: string; role: 'admin' | 'member'; full_name: string } | null>(null)
  const [loading, setLoading] = useState(true)

  // useEffect 1: Suscripción a cambios de auth state (SIN llamar a supabase.from)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setUser(session?.user ?? null)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // useEffect 2: Obtener sesión inicial al montar
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
  }, [])

  // useEffect 3: Cuando user cambia, obtener perfil (separado del auth flow)
  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile({
            id: data.id,
            role: data.role as 'admin' | 'member',
            full_name: data.full_name,
          })
        }
      })
      .catch((err) => {
        console.error('Error fetching profile:', err)
      })
  }, [user])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    // SIGNED_OUT event ya limpia user y profile via onAuthStateChange
  }

  return { user, profile, loading, signIn, signUp, signOut }
}
