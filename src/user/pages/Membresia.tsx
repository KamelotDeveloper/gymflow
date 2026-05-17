import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../shared/components/AuthContext'
import { supabase } from '../../shared/lib/supabase'
import UserLayout from '../../shared/components/UserLayout'
import { ArrowLeft, Loader2, Star } from 'lucide-react'

type Membership = {
  id: string
  start_date: string
  end_date: string
  status: string
  admin_override: boolean
  plan_name: string
}

type Plan = {
  id: string
  name: string
  duration_months: number
  price: number
}

const WHATSAPP_NUMBER = '5491112345678' // TODO: reemplazar con número real

export default function Membresia() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()

  const [membership, setMembership] = useState<Membership | null>(null)
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<Plan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    fetchMembership()
    fetchPlans()
  }, [profile?.id])

  const fetchMembership = async () => {
    setLoading(true)
    try {
      const { data: memb } = await (supabase as any)
        .from('memberships')
        .select('id, start_date, end_date, status, admin_override, plan:membership_plans(name)')
        .eq('profile_id', profile!.id)
        .order('end_date', { ascending: false })
        .limit(1)
        .single()

      if (memb) {
        setMembership({
          id: memb.id,
          start_date: memb.start_date,
          end_date: memb.end_date,
          status: memb.status,
          admin_override: memb.admin_override,
          plan_name: memb.plan?.name ?? 'Sin plan',
        })
      }
    } catch {
      // no membership
    } finally {
      setLoading(false)
    }
  }

  const fetchPlans = async () => {
    setPlansLoading(true)
    try {
      const { data } = await (supabase as any)
        .from('membership_plans')
        .select('id, name, duration_months, price')
        .eq('is_active', true)
        .order('duration_months', { ascending: true })

      if (data) setPlans(data as Plan[])
    } catch {
      // no plans
    } finally {
      setPlansLoading(false)
    }
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price)

  const whatsappLink = (planName: string) =>
    `https://wa.me/${WHATSAPP_NUMBER}?text=Hola, quiero renovar mi membresía plan ${planName}`

  const today = new Date()
  const getStatusInfo = () => {
    if (!membership) return { type: 'none', label: '', daysLeft: 0 }
    const endDate = new Date(membership.end_date)
    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / 86400000)

    if (membership.status === 'expired' && !membership.admin_override) {
      return { type: 'expired', label: 'Vencida', daysLeft }
    }
    if (daysLeft <= 7) {
      return { type: 'soon', label: `Por vencer · ${daysLeft} día${daysLeft === 1 ? '' : 's'}`, daysLeft }
    }
    return { type: 'active', label: 'Activa', daysLeft }
  }

  const statusInfo = getStatusInfo()

  return (
    <UserLayout>
      <div className="px-4 py-6 max-w-lg mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate('/user')}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={18} />
          Volver al inicio
        </button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Mi Membresía
        </h1>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : !membership ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No tenés membresía registrada.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Contactá al gimnasio para obtener una.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            {/* Status banner */}
            <div
              className={`px-6 py-4 ${
                statusInfo.type === 'active'
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : statusInfo.type === 'soon'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-block w-3 h-3 rounded-full ${
                    statusInfo.type === 'active'
                      ? 'bg-green-500'
                      : statusInfo.type === 'soon'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                />
                <span
                  className={`text-sm font-bold ${
                    statusInfo.type === 'active'
                      ? 'text-green-700 dark:text-green-300'
                      : statusInfo.type === 'soon'
                      ? 'text-yellow-700 dark:text-yellow-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {statusInfo.label}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                  Plan
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                  {membership.plan_name}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                    Inicio
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {new Date(membership.start_date).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                    Vencimiento
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {new Date(membership.end_date).toLocaleDateString('es-AR')}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">
                  Días restantes
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                  {statusInfo.daysLeft > 0 ? `${statusInfo.daysLeft} día${statusInfo.daysLeft === 1 ? '' : 's'}` : '—'}
                </p>
              </div>
            </div>

            {/* Expired message */}
            {statusInfo.type === 'expired' && (
              <div className="px-6 pb-6">
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    Contactá al gimnasio para renovar.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Planes disponibles ── */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
            {!membership || statusInfo.type === 'expired'
              ? 'Renovar membresía'
              : 'Cambiar plan'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {!membership || statusInfo.type === 'expired'
              ? 'Elegí un plan para volver a entrenar'
              : 'Consultá con el gimnasio para cambiar tu plan actual'}
          </p>

          {plansLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : plans.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
              No hay planes disponibles por el momento.
            </p>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => {
                const isHighlighted = plan.duration_months === 6
                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-xl border bg-white dark:bg-gray-800 p-5 ${
                      isHighlighted
                        ? 'border-[#DC2626] ring-1 ring-[#DC2626]'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {isHighlighted && (
                      <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-[#DC2626] px-3 py-0.5 text-xs font-bold text-white shadow-sm">
                        <Star size={12} />
                        Más popular
                      </span>
                    )}

                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        {plan.name}
                      </h3>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {plan.duration_months} {plan.duration_months === 1 ? 'mes' : 'meses'}
                      </span>
                    </div>

                    <p className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                      {formatPrice(plan.price)}
                    </p>

                    <a
                      href={whatsappLink(plan.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      // TODO: reemplazar con pasarela de pago (Mercado Pago u otra)
                      className="block w-full text-center rounded-lg bg-[#DC2626] text-white text-sm font-bold py-2.5 hover:bg-[#b71c1c] transition-colors"
                    >
                      Consultar
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </UserLayout>
  )
}
