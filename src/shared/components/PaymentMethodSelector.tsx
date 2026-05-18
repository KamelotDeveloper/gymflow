import { useEffect, useState } from 'react'
import { usePayments } from '../hooks/usePayments'
import { supabase } from '../lib/supabase'
import {
  Loader2,
  CheckCircle2,
  CreditCard,
  Building2,
  Banknote,
  Upload,
  X,
  AlertCircle,
} from 'lucide-react'

type PaymentMethod = {
  id: string
  type: 'mp' | 'bank_transfer' | 'cash'
  name: string
  is_active: boolean
  config: {
    cbu?: string
    alias?: string
    titular?: string
    cuit?: string
    banco?: string
  } | null
  created_at: string
}

type Props = {
  open: boolean
  onClose: () => void
  plan: { id: string; name: string; price: number; duration_months: number }
  profileId: string
  onComplete: () => void
}

type Step = 'select' | 'form' | 'success'

const PAYMENT_METHOD_ICONS: Record<string, typeof CreditCard> = {
  mp: CreditCard,
  bank_transfer: Building2,
  cash: Banknote,
}

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  mp: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  bank_transfer: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  cash: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

export default function PaymentMethodSelector({
  open,
  onClose,
  plan,
  profileId,
  onComplete,
}: Props) {
  const { fetchPaymentMethods, createMPPreference, createManualPayment } =
    usePayments()

  const [step, setStep] = useState<Step>('select')
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [loadingMethods, setLoadingMethods] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // BPC upload state
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptRef, setReceiptRef] = useState('')
  const [uploadProgress, setUploadProgress] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('select')
      setSelectedMethod(null)
      setError(null)
      setReceiptFile(null)
      setReceiptRef('')
      setUploadProgress(false)
      setSubmitting(false)
      loadMethods()
    }
  }, [open])

  const loadMethods = async () => {
    setLoadingMethods(true)
    try {
      const activeMethods = await fetchPaymentMethods()
      setMethods(activeMethods)
    } catch (err: any) {
      setError(err.message || 'Error al cargar métodos de pago')
    } finally {
      setLoadingMethods(false)
    }
  }

  const handleSelectMethod = (method: PaymentMethod) => {
    setSelectedMethod(method)
    setStep('form')
    setError(null)
  }

  const handleBack = () => {
    setStep('select')
    setSelectedMethod(null)
    setError(null)
    setReceiptFile(null)
    setReceiptRef('')
  }

  // ── File validation ──
  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return 'Solo se aceptan imágenes (JPG, PNG, WEBP) o PDF'
    }
    if (file.size > 5 * 1024 * 1024) {
      return 'El archivo no puede superar los 5MB'
    }
    return null
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      setReceiptFile(null)
      return
    }

    setError(null)
    setReceiptFile(file)
  }

  // ── Upload receipt to Supabase Storage ──
  const uploadReceipt = async (): Promise<string | undefined> => {
    if (!receiptFile) return undefined

    setUploadProgress(true)
    const timestamp = Date.now()
    const safeName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${profileId}/${timestamp}_${safeName}`

    const { error: uploadErr } = await supabase.storage
      .from('payment-receipts')
      .upload(filePath, receiptFile, { upsert: false })

    setUploadProgress(false)

    if (uploadErr) {
      throw new Error('Error al subir el comprobante. Verificá el archivo e intentá de nuevo.')
    }

    const { data: { publicUrl } } = supabase.storage
      .from('payment-receipts')
      .getPublicUrl(filePath)

    return publicUrl
  }

  // ── Handle MP payment ──
  const handleMPPayment = async () => {
    if (!selectedMethod) return
    setSubmitting(true)
    setError(null)
    try {
      await createMPPreference(plan.id)
      // window.location.href is set inside the hook, so we don't need
      // to call onComplete here — the page will redirect
    } catch (err: any) {
      setError(err.message || 'Error al procesar el pago')
      setSubmitting(false)
    }
  }

  // ── Handle manual payment (BPC or Cash) ──
  const handleManualPayment = async () => {
    if (!selectedMethod) return
    setSubmitting(true)
    setError(null)

    try {
      let receiptUrl: string | undefined

      // For bank transfer, upload receipt first
      if (selectedMethod.type === 'bank_transfer') {
        if (!receiptFile) {
          setError('Debés subir el comprobante de transferencia')
          setSubmitting(false)
          return
        }
        receiptUrl = await uploadReceipt()
      }

      await createManualPayment({
        planId: plan.id,
        paymentMethodId: selectedMethod.id,
        receiptUrl,
        receiptRef: receiptRef.trim() || undefined,
      })

      setStep('success')
    } catch (err: any) {
      setError(err.message || 'Error al procesar el pago')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSuccessClose = () => {
    onComplete()
    onClose()
  }

  if (!open) return null

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111] border border-gray-800 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#111]">
          <div>
            <h2 className="text-lg font-bold text-white">Elegir método de pago</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {plan.name} &middot; {formatPrice(plan.price)}
            </p>
          </div>
          {step === 'select' ? (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X size={20} />
            </button>
          ) : (
            <button
              onClick={handleBack}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Volver
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {step === 'select' && renderMethodSelection()}
          {step === 'form' && selectedMethod && renderMethodForm()}
          {step === 'success' && renderSuccess()}
        </div>
      </div>
    </div>
  )

  // ── Step 1: Method selection ──
  function renderMethodSelection() {
    if (loadingMethods) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center py-8 text-center">
          <AlertCircle size={32} className="text-red-400 mb-3" />
          <p className="text-sm text-gray-300">{error}</p>
          <button
            onClick={loadMethods}
            className="mt-4 text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {methods.map((method) => {
          const Icon = PAYMENT_METHOD_ICONS[method.type] ?? CreditCard
          const colorClasses = PAYMENT_METHOD_COLORS[method.type] ?? 'bg-gray-800 text-gray-400 border-gray-700'
          return (
            <button
              key={method.id}
              onClick={() => handleSelectMethod(method)}
              className="w-full flex items-center gap-4 rounded-xl border border-gray-700 bg-[#1a1a1a] p-4 text-left hover:border-red-500/40 hover:bg-[#222] transition-all"
            >
              <div className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl border ${colorClasses}`}>
                <Icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{method.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {method.type === 'mp' && 'Pago online con Mercado Pago'}
                  {method.type === 'bank_transfer' && 'Transferencia bancaria con comprobante'}
                  {method.type === 'cash' && 'Pagá en el gimnasio'}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  // ── Step 2: Method-specific form ──
  function renderMethodForm() {
    if (!selectedMethod) return null

    return (
      <div className="space-y-5">
        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-900/20 border border-red-800/40 p-3">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {/* MP form */}
        {selectedMethod.type === 'mp' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-700 bg-[#1a1a1a] p-5 text-center">
              <CreditCard size={36} className="mx-auto text-sky-400 mb-3" />
              <p className="text-sm text-gray-300">
                Vas a ser redirigido a <strong className="text-white">Mercado Pago</strong> para
                completar el pago de <strong className="text-white">{formatPrice(plan.price)}</strong>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Una vez que pagues, volverás automáticamente a la app.
              </p>
            </div>
            <button
              onClick={handleMPPayment}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 text-white text-sm font-bold py-3 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? 'Redirigiendo...' : 'Pagar ahora'}
            </button>
          </div>
        )}

        {/* BPC Bank Transfer form */}
        {selectedMethod.type === 'bank_transfer' && (
          <div className="space-y-4">
            {/* Bank details card */}
            <div className="rounded-xl border border-gray-700 bg-[#1a1a1a] p-4 space-y-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                Datos bancarios
              </h3>
              <DetailRow label="Banco" value={selectedMethod.config?.banco ?? '—'} />
              <DetailRow label="Titular" value={selectedMethod.config?.titular ?? '—'} />
              <DetailRow label="CBU" value={selectedMethod.config?.cbu ?? '—'} />
              <DetailRow label="Alias" value={selectedMethod.config?.alias ?? '—'} />
              <DetailRow label="CUIT" value={selectedMethod.config?.cuit ?? '—'} />
            </div>

            {/* Receipt upload */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Comprobante de transferencia *
              </label>
              <label
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 cursor-pointer transition-colors ${
                  receiptFile
                    ? 'border-green-500/40 bg-green-500/5'
                    : 'border-gray-600 hover:border-gray-500 bg-[#1a1a1a]'
                }`}
              >
                {receiptFile ? (
                  <div className="text-center">
                    <CheckCircle2 size={24} className="mx-auto text-green-400 mb-1" />
                    <p className="text-xs text-green-400 font-medium">{receiptFile.name}</p>
                    <p className="text-2xs text-gray-500 mt-0.5">
                      {(receiptFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload size={24} className="mx-auto text-gray-500 mb-1" />
                    <p className="text-xs text-gray-400">
                      Tocá para subir el comprobante
                    </p>
                    <p className="text-2xs text-gray-600 mt-1">
                      JPG, PNG, WEBP o PDF &middot; Máx 5MB
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {/* Optional reference */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Referencia (opcional)
              </label>
              <input
                type="text"
                value={receiptRef}
                onChange={(e) => setReceiptRef(e.target.value)}
                placeholder="Ej: N° de operación"
                className="w-full rounded-xl border border-gray-700 bg-[#1a1a1a] px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 transition-colors"
              />
            </div>

            <button
              onClick={handleManualPayment}
              disabled={submitting || uploadProgress || !receiptFile}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#DC2626] text-white text-sm font-bold py-3 hover:bg-[#b71c1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadProgress && (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Subiendo comprobante...
                </>
              )}
              {submitting && !uploadProgress && (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Procesando...
                </>
              )}
              {!submitting && !uploadProgress && 'Confirmar pago'}
            </button>
          </div>
        )}

        {/* Cash form */}
        {selectedMethod.type === 'cash' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-700 bg-[#1a1a1a] p-5 text-center">
              <Banknote size={36} className="mx-auto text-emerald-400 mb-3" />
              <p className="text-sm text-gray-300">
                Vas a pagar en el gimnasio. Una vez que pagues, el administrador confirmará tu membresía.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Recordá llevar el monto exacto de <strong className="text-white">{formatPrice(plan.price)}</strong>
              </p>
            </div>
            <button
              onClick={handleManualPayment}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#DC2626] text-white text-sm font-bold py-3 hover:bg-[#b71c1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? 'Procesando...' : 'Confirmar pago'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Step 3: Success ──
  function renderSuccess() {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <CheckCircle2 size={48} className="text-green-400 mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">Solicitud enviada</h3>
        <p className="text-sm text-gray-400 mb-6 max-w-xs">
          El administrador procesará tu pago. Te notificaremos cuando tu membresía esté activa.
        </p>
        <button
          onClick={handleSuccessClose}
          className="rounded-xl bg-[#DC2626] text-white text-sm font-bold px-8 py-2.5 hover:bg-[#b71c1c] transition-colors"
        >
          Entendido
        </button>
      </div>
    )
  }
}

/** Small helper to render a label + value row for bank details */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-white font-mono">{value}</span>
    </div>
  )
}
