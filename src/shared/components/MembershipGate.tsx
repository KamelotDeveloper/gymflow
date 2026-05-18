import { useEffect, useState, type ReactNode } from 'react'
import { useAuthContext } from './AuthContext'
import { supabase } from '../lib/supabase'
import { fetchActiveMembership, checkMembership } from '../hooks/useMembership'
import { usePayments } from '../hooks/usePayments'
import PaymentMethodSelector from './PaymentMethodSelector'
import { Loader2, Star, LogOut, AlertCircle } from 'lucide-react'

type Props = {
  children: ReactNode
}

type Plan = {
  id: string
  name: string
  duration_months: number
  price: number
}

export default function MembershipGate({ children }: Props) {
  const { profile, signOut } = useAuthContext()
  const { fetchPendingTransactions } = usePayments()
  const [blocked, setBlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<Plan[]>([])

  // Payment flow state
  const [showPaymentSelector, setShowPaymentSelector] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [pendingTransaction, setPendingTransaction] = useState<any | null>(null)

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

        // Check for pending transactions
        const pending = await fetchPendingTransactions(profile.id)
        if (!cancelled && pending.length > 0) {
          setPendingTransaction(pending[0])
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

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan)
    setShowPaymentSelector(true)
  }

  const handlePaymentComplete = () => {
    setShowPaymentSelector(false)
    setSelectedPlan(null)
  }

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

                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={!!pendingTransaction}
                      className="block w-full text-center rounded-lg bg-[#DC2626] text-white text-sm font-bold py-2 hover:bg-[#b71c1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Elegir método de pago
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pending transaction banner */}
          {pendingTransaction && (
            <div className="mt-4 rounded-xl border border-yellow-700 bg-yellow-900/20 p-3 flex items-start gap-2.5">
              <AlertCircle size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-yellow-300">Pago pendiente</p>
                <p className="text-xs text-yellow-400/70 mt-0.5">
                  Ya tenés un pago en proceso. Esperá a que sea confirmado.
                </p>
              </div>
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

        {/* Payment Method Selector Modal */}
        {selectedPlan && profile && (
          <PaymentMethodSelector
            open={showPaymentSelector}
            onClose={() => {
              setShowPaymentSelector(false)
              setSelectedPlan(null)
            }}
            plan={selectedPlan}
            profileId={profile.id}
            onComplete={handlePaymentComplete}
          />
        )}
      </div>
    )
  }

  return <>{children}</>
}
