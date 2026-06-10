import { useEffect, useState, useRef } from 'react'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import {
  Loader2,
  Upload,
  Banknote,
  CreditCard,
  Building2,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Check,
  X,
} from 'lucide-react'

type GymConfig = {
  id: string
  gym_name: string
  logo_url: string | null
  primary_color: string | null
  whatsapp: string | null
  address: string | null
  updated_at: string
}

export default function Config() {
  const [config, setConfig] = useState<GymConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form fields
  const [gymName, setGymName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [address, setAddress] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [methodsLoading, setMethodsLoading] = useState(true)
  const [editingMethod, setEditingMethod] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    cbu: '',
    alias: '',
    titular: '',
    cuit: '',
    banco: '',
  })
  const [savingMethod, setSavingMethod] = useState(false)

  useEffect(() => {
    fetchConfig()
    fetchPaymentMethods()
  }, [])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase as any)
        .from('gym_config')
        .select('*')
        .maybeSingle()

      if (error) {
        console.error('❌ Config fetch error:', error)
        setLoading(false)
        return
      }

      if (data) {
        const c = data as GymConfig
        setConfig(c)
        setGymName(c.gym_name)
        setWhatsapp(c.whatsapp ?? '')
        setAddress(c.address ?? '')
        setLogoUrl(c.logo_url)
      }
    } catch (err) {
      console.error('❌ Config fetch exception:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    try {
      const filePath = `gym-logo/logo.png`
      const { error: uploadError } = await (supabase as any)
        .storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = (supabase as any)
        .storage
        .from('avatars')
        .getPublicUrl(filePath)

      const publicUrl = urlData?.publicUrl
      if (publicUrl) {
        setLogoUrl(publicUrl)
      }
    } catch (err) {
      console.error('Error subiendo logo:', err)
    } finally {
      setUploadingLogo(false)
    }
  }

  // ── Payment methods ──

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL ||
    'https://gymflow-8ect.onrender.com'

  const fetchPaymentMethods = async () => {
    setMethodsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      // Fetch all methods (active + inactive) for admin config
      const res = await fetch(`${BACKEND_URL}/api/payments/methods`, { headers })
      if (!res.ok) {
        console.error('Error fetching payment methods')
        return
      }
      const data = await res.json()
      setPaymentMethods(data.methods ?? [])
    } catch (err) {
      console.error('Error fetching payment methods:', err)
    } finally {
      setMethodsLoading(false)
    }
  }

  const handleToggleMethod = async (method: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      }
      const res = await fetch(`${BACKEND_URL}/api/payments/methods/${method.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ is_active: !method.is_active }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Error toggling method:', err)
        return
      }
      // Optimistic update
      setPaymentMethods((prev) =>
        prev.map((m) =>
          m.id === method.id ? { ...m, is_active: !method.is_active } : m,
        ),
      )
    } catch (err) {
      console.error('Error toggling payment method:', err)
    }
  }

  const handleEditMethod = (method: any) => {
    const config = method.config ?? {}
    setEditForm({
      cbu: config.cbu ?? '',
      alias: config.alias ?? '',
      titular: config.titular ?? '',
      cuit: config.cuit ?? '',
      banco: config.banco ?? '',
    })
    setEditingMethod(method.id)
  }

  const handleCancelEdit = () => {
    setEditingMethod(null)
    setEditForm({ cbu: '', alias: '', titular: '', cuit: '', banco: '' })
  }

  const handleSaveMethodConfig = async (methodId: string) => {
    setSavingMethod(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      }
      const res = await fetch(`${BACKEND_URL}/api/payments/methods/${methodId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          config: {
            cbu: editForm.cbu.trim(),
            alias: editForm.alias.trim(),
            titular: editForm.titular.trim(),
            cuit: editForm.cuit.trim(),
            banco: editForm.banco.trim(),
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Error saving method config:', err)
        return
      }
      const data = await res.json()
      // Update local state
      setPaymentMethods((prev) =>
        prev.map((m) => (m.id === methodId ? data.method : m)),
      )
      setEditingMethod(null)
    } catch (err) {
      console.error('Error saving method config:', err)
    } finally {
      setSavingMethod(false)
    }
  }

  const handleSave = async () => {
    if (!gymName.trim() || !config?.id) return

    setSaving(true)
    try {
      await (supabase as any)
        .from('gym_config')
        .update({
          gym_name: gymName.trim(),
          whatsapp: whatsapp.trim() || null,
          address: address.trim() || null,
          logo_url: logoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id)

      setSuccessMsg(true)
      setTimeout(() => setSuccessMsg(false), 2000)
    } catch (err) {
      console.error('Error guardando config:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout pageTitle="Configuración">
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout pageTitle="Configuración">
      <div className="max-w-xl mx-auto">
        {/* Success toast */}
        {successMsg && (
          <div className="mb-4 rounded-lg bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300 font-medium">
            ✓ Configuración guardada
          </div>
        )}

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-6">
          {/* Gym name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Nombre del gimnasio
            </label>
            <input
              type="text"
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              placeholder="Ej: GymFlow Center"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
            />
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              WhatsApp
            </label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="5493511234567"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Sin + ni espacios. Ej: 5493511234567
            </p>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Dirección
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: Av. Siempreviva 742"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
            />
          </div>

          {/* Logo */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Logo del gimnasio
            </label>
            {logoUrl && (
              <div className="mb-3">
                <img
                  src={logoUrl}
                  alt="Logo del gimnasio"
                  className="w-20 h-20 rounded-xl object-cover border border-gray-200 dark:border-gray-600"
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                <Upload size={16} />
                {uploadingLogo ? 'Subiendo…' : logoUrl ? 'Cambiar logo' : 'Seleccionar logo'}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </div>

          {/* Save button */}
          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={!gymName.trim() || saving}
              className="w-full rounded-lg bg-[#DC2626] text-white text-sm font-bold py-2.5 hover:bg-[#b71c1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </div>
        </div>

        {/* ── Payment methods section ── */}
        <div className="mt-8">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">
            Métodos de pago
          </h2>

          {methodsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => {
                const METHOD_ICONS: Record<string, typeof CreditCard> = {
                  mp: CreditCard,
                  bank_transfer: Building2,
                  cash: Banknote,
                }
                const METHOD_COLORS: Record<string, string> = {
                  mp: 'bg-sky-100 text-sky-700 border-sky-200',
                  bank_transfer: 'bg-violet-100 text-violet-700 border-violet-200',
                  cash: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                }
                const methodColors = METHOD_COLORS[method.type] ?? 'bg-gray-100 text-gray-700 border-gray-200'
                const Icon = METHOD_ICONS[method.type] ?? CreditCard

                return (
                  <div
                    key={method.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                  >
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-lg border ${methodColors}`}
                      >
                        <Icon size={20} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {method.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {method.type === 'mp' && 'Mercado Pago — pago online'}
                          {method.type === 'bank_transfer' && 'Transferencia bancaria'}
                          {method.type === 'cash' && 'Efectivo — pago en el gimnasio'}
                        </p>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => handleToggleMethod(method)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          method.is_active
                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {method.is_active ? (
                          <>
                            <ToggleRight size={16} />
                            Activo
                          </>
                        ) : (
                          <>
                            <ToggleLeft size={16} />
                            Inactivo
                          </>
                        )}
                      </button>

                      {/* Edit bank details */}
                      {method.type === 'bank_transfer' && (
                        <button
                          onClick={() => handleEditMethod(method)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Pencil size={14} />
                          Editar datos
                        </button>
                      )}
                    </div>

                    {/* Bank details edit form */}
                    {editingMethod === method.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {([
                            { key: 'cbu', label: 'CBU', placeholder: '0000000000000000000000' },
                            { key: 'alias', label: 'Alias', placeholder: 'alias.mp' },
                            { key: 'titular', label: 'Titular', placeholder: 'Gym SA' },
                            { key: 'cuit', label: 'CUIT', placeholder: '30-00000000-0' },
                            { key: 'banco', label: 'Banco', placeholder: 'BPC' },
                          ] as const).map((field) => (
                            <div key={field.key}>
                              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                {field.label}
                              </label>
                              <input
                                type="text"
                                value={(editForm as any)[field.key]}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, [field.key]: e.target.value })
                                }
                                placeholder={field.placeholder}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={handleCancelEdit}
                            disabled={savingMethod}
                            className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                          >
                            <X size={16} />
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSaveMethodConfig(method.id)}
                            disabled={savingMethod}
                            className="flex items-center gap-1.5 rounded-lg bg-[#DC2626] text-white text-sm font-bold px-4 py-2 hover:bg-[#b71c1c] transition-colors disabled:opacity-50"
                          >
                            {savingMethod ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Check size={16} />
                            )}
                            {savingMethod ? 'Guardando...' : 'Guardar datos'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
