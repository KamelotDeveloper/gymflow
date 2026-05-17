import { useEffect, useState, type ReactNode } from 'react'
import { useAuthContext } from './AuthContext'
import { supabase } from '../lib/supabase'
import { fetchActiveMembership, checkMembership } from '../hooks/useMembership'
import { Loader2, Star, LogOut } from 'lucide-react'

type Props = {
  children: ReactNode
}

type Plan = {
  id: string
  name: string
  duration_months: number
  price: number
}

const WHATSAPP_NUMBER = '5491112345678' // TODO: reemplazar con número real del gimnasio

export default function MembershipGate({ children }: Props) {
  const { profile, signOut } = useAuthContext()
  const [blocked, setBlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<Plan[]>([])

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false)
      return
    }

    let cancelled = false

    const verify = async () => {
      setLoading(true)
      try {
        const membership = await fetchActiveMembership(profile.id)
        console.log('🧪 MembershipGate — profile.id:', profile.id)

        const result = checkMembership(membership)
        console.log('🧪 MembershipGate — check result:', result)

        if (!cancelled) {
          setBlocked(!result.valid)
        }
      } catch {
        if (!cancelled) setBlocked(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    verify()

    return () => {
      cancelled = true
    }
  }, [profile?.id])

  // Fetch active plans for renewal screen
  useEffect(() => {
    ;(supabase as any)
      .from('membership_plans')
      .select('id, name, duration_months, price')
      .eq('is_active', true)
      .order('duration_months', { ascending: true })
      .then(({ data }: any) => {
        if (data) setPlans(data as Plan[])
      })
  }, [])

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price)

  const whatsappLink = (planName: string) =>
    `https://wa.me/${WHATSAPP_NUMBER}?text=Hola, quiero renovar mi membresía plan ${planName}`

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (blocked) {
    return (
      <div className="min-h-[calc(100dvh-3.5rem)] bg-gray-950 overflow-y-auto px-4 pb-6">
        <div className="max-w-sm mx-auto pt-14">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-3xl mb-2 leading-none">🔒</div>
            <h1 className="text-lg font-bold text-white">
              Membresía vencida
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Para seguir entrenando renová tu plan
            </p>
          </div>

          {/* Plans */}
          {plans.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No hay planes disponibles por el momento.
            </p>
          ) : (
            <div className="space-y-2.5">
              {plans.map((plan) => {
                const isHighlighted = plan.duration_months === 6
                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-xl border bg-gray-800 p-4 ${
                      isHighlighted
                        ? 'border-[#DC2626] ring-1 ring-[#DC2626]'
                        : 'border-gray-700'
                    }`}
                  >
                    {isHighlighted && (
                      <span className="absolute -top-2 right-3 inline-flex items-center gap-0.5 rounded-full bg-[#DC2626] px-2.5 py-0.5 text-2xs font-bold text-white shadow-sm">
                        <Star size={10} />
                        Más popular
                      </span>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-white">
                        {plan.name}
                      </h3>
                      <span className="text-2xs text-gray-400">
                        {plan.duration_months} {plan.duration_months === 1 ? 'mes' : 'meses'}
                      </span>
                    </div>

                    <p className="text-lg font-bold text-white mb-3">
                      {formatPrice(plan.price)}
                    </p>

                    <a
                      href={whatsappLink(plan.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      // TODO: reemplazar con pasarela de pago (Mercado Pago u otra)
                      className="block w-full text-center rounded-lg bg-[#DC2626] text-white text-sm font-bold py-2 hover:bg-[#b71c1c] transition-colors"
                    >
                      Consultar
                    </a>
                  </div>
                )
              })}
            </div>
          )}

          {/* Sign out */}
          <button
            onClick={signOut}
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-gray-700 text-gray-400 text-xs font-medium py-2 hover:bg-gray-800 hover:text-white transition-colors mt-6"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
