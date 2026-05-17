import { useEffect, useState, useRef } from 'react'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import { Loader2, Upload } from 'lucide-react'

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

  useEffect(() => {
    fetchConfig()
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
      </div>
    </AdminLayout>
  )
}
