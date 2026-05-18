import { useEffect, useState } from 'react'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import { Pencil, X, Loader2 } from 'lucide-react'

type Plan = {
  id: string
  name: string
  price: number
  duration_months: number
  duration_type: 'monthly' | 'biannual' | 'annual'
  is_active: boolean
  created_at: string
}

const durationLabels: Record<string, string> = {
  monthly: 'Mensual',
  biannual: 'Semestral',
  annual: 'Anual',
}

const LABEL_CLASS =
  'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5'
const INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#DC2626] focus:border-transparent'

export default function PlanCatalog() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  // Edit modal
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formDurationMonths, setFormDurationMonths] = useState('')
  const [formDurationType, setFormDurationType] = useState<'monthly' | 'biannual' | 'annual'>('monthly')
  const [formActive, setFormActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase as any)
        .from('membership_plans')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error
      setPlans(data ?? [])
    } catch (err) {
      console.error('Error al cargar planes:', err)
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan)
    setFormName(plan.name)
    setFormPrice(String(plan.price))
    setFormDurationMonths(String(plan.duration_months))
    setFormDurationType(plan.duration_type)
    setFormActive(plan.is_active)
    setFormError(null)
  }

  const closeModal = () => {
    setEditingPlan(null)
    setFormName('')
    setFormPrice('')
    setFormDurationMonths('')
    setFormDurationType('monthly')
    setFormActive(true)
    setFormError(null)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      setFormError('El nombre es obligatorio.')
      return
    }
    const price = parseFloat(formPrice)
    if (isNaN(price) || price < 0) {
      setFormError('Ingresá un precio válido.')
      return
    }
    const months = parseInt(formDurationMonths, 10)
    if (isNaN(months) || months < 1) {
      setFormError('La duración en meses debe ser al menos 1.')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const updates = {
        name: formName.trim(),
        price,
        duration_months: months,
        duration_type: formDurationType,
        is_active: formActive,
      }

      if (editingPlan) {
        const { error } = await (supabase as any)
          .from('membership_plans')
          .update(updates)
          .eq('id', editingPlan.id)
        if (error) throw error
      }

      closeModal()
      await fetchPlans()
    } catch (err: any) {
      console.error('Error al guardar plan:', err)
      setFormError(err?.message || 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (plan: Plan) => {
    try {
      const { error } = await (supabase as any)
        .from('membership_plans')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id)
      if (error) throw error
      await fetchPlans()
    } catch (err) {
      console.error('Error al cambiar estado:', err)
    }
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(price)

  return (
    <AdminLayout pageTitle="Planes">
      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <Th>Nombre</Th>
              <Th>Precio</Th>
              <Th>Duración</Th>
              <Th>Estado</Th>
              <Th style={{ width: 80 }}>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-16">
                  <Loader2 size={24} className="animate-spin text-gray-400 mx-auto" />
                </td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-16 text-sm text-gray-400">
                  No hay planes creados aún.
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/20">
                  <Td>
                    <span className={plan.is_active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500 line-through'}>
                      {plan.name}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatPrice(plan.price)}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-gray-600 dark:text-gray-300">
                      {plan.duration_months} mes{plan.duration_months !== 1 ? 'es' : ''}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">
                      ({durationLabels[plan.duration_type]})
                    </span>
                  </Td>
                  <Td>
                    <button
                      onClick={() => toggleActive(plan)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        plan.is_active
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {plan.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditModal(plan)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        title="Editar plan"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 pb-10 overflow-y-auto" onClick={closeModal}>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white m-0">
                Editar plan
              </h2>
              <button onClick={closeModal} className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div className="flex flex-col gap-4">
              {/* Name */}
              <div>
                <label className={LABEL_CLASS}>
                  Nombre <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Mensual"
                  className={INPUT_CLASS}
                />
              </div>

              {/* Price */}
              <div>
                <label className={LABEL_CLASS}>
                  Precio <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="Ej: 15000"
                  className={INPUT_CLASS}
                />
              </div>

              {/* Duration months */}
              <div>
                <label className={LABEL_CLASS}>
                  Duración (meses) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formDurationMonths}
                  onChange={(e) => setFormDurationMonths(e.target.value)}
                  placeholder="Ej: 1"
                  className={INPUT_CLASS}
                />
              </div>

              {/* Duration type */}
              <div>
                <label className={LABEL_CLASS}>Tipo</label>
                <select
                  value={formDurationType}
                  onChange={(e) => setFormDurationType(e.target.value as 'monthly' | 'biannual' | 'annual')}
                  className={INPUT_CLASS + ' cursor-pointer'}
                >
                  <option value="monthly">Mensual</option>
                  <option value="biannual">Semestral</option>
                  <option value="annual">Anual</option>
                </select>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:bg-green-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                  Plan activo
                </span>
              </div>

              {formError && (
                <p className="text-sm text-red-600 m-0">{formError}</p>
              )}

              {/* Footer */}
              <div className="flex justify-end gap-3 mt-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-[#DC2626] text-white text-sm font-bold hover:bg-[#b71c1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

/* ── Helpers ── */

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        padding: '10px 16px',
        textAlign: 'left',
        fontSize: 12,
        fontWeight: 600,
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        ...style,
      }}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '12px 16px', fontSize: 14 }}>{children}</td>
}
