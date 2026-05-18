import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { Transaction } from './PaymentsList'

type Props = {
  open: boolean
  onClose: () => void
  transaction: Transaction | null
  onConfirm: (txn: Transaction) => void
  onReject: (txn: Transaction, reason?: string) => void
  action: 'confirm' | 'reject'
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(price)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const METHOD_LABELS: Record<string, string> = {
  mp: 'Mercado Pago',
  bank_transfer: 'Transferencia Bancaria',
  cash: 'Efectivo',
}

export default function ConfirmPaymentModal({
  open,
  onClose,
  transaction,
  onConfirm,
  onReject,
  action,
}: Props) {
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!open || !transaction) return null

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      if (action === 'confirm') {
        await onConfirm(transaction)
      } else {
        await onReject(transaction, rejectReason.trim() || undefined)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) {
      setRejectReason('')
      onClose()
    }
  }

  return (
    <div style={overlayStyle} onClick={handleClose}>
      <div
        style={modalCardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={modalHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111' }}>
            {action === 'confirm' ? 'Confirmar pago' : 'Rechazar pago'}
          </h2>
          <button onClick={handleClose} style={iconBtnCleanStyle}>
            <X size={20} />
          </button>
        </div>

        {/* Transaction details */}
        <div
          style={{
            backgroundColor: '#f9fafb',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <DetailRow label="Usuario" value={transaction.profile?.full_name ?? '—'} />
          <DetailRow label="Plan" value={transaction.plan?.name ?? '—'} />
          <DetailRow label="Monto" value={formatPrice(transaction.amount)} />
          <DetailRow
            label="Método"
            value={transaction.payment_method?.name ?? METHOD_LABELS[transaction.payment_method?.type] ?? '—'}
          />
          <DetailRow label="Fecha" value={formatDate(transaction.created_at)} />
          {transaction.receipt_ref && (
            <DetailRow label="Referencia" value={transaction.receipt_ref} />
          )}
        </div>

        {/* Rejection reason */}
        {action === 'reject' && (
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                color: '#374151',
                marginBottom: 6,
              }}
            >
              Motivo del rechazo{' '}
              <span style={{ color: '#9ca3af', fontSize: 12 }}>(opcional)</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ej: Comprobante ilegible, datos incorrectos..."
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 14,
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
                color: '#111',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#DC2626')}
              onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={handleClose}
            disabled={submitting}
            style={btnSecondaryStyle}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              ...(action === 'confirm' ? btnConfirmStyle : btnRejectStyle),
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting
              ? 'Procesando...'
              : action === 'confirm'
                ? 'Confirmar pago'
                : 'Rechazar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Styles ── */

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: 60,
  paddingBottom: 40,
  overflowY: 'auto',
  zIndex: 50,
}

const modalCardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 24,
  width: '100%',
  maxWidth: 480,
  margin: 16,
}

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
}

const iconBtnCleanStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#6b7280',
  padding: 4,
  display: 'flex',
}

const btnSecondaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 38,
  padding: '0 16px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  backgroundColor: '#fff',
  color: '#374151',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
}

const btnConfirmStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 38,
  padding: '0 16px',
  borderRadius: 8,
  border: 'none',
  backgroundColor: '#059669',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
}

const btnRejectStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 38,
  padding: '0 16px',
  borderRadius: 8,
  border: 'none',
  backgroundColor: '#DC2626',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
}

/* ── Helpers ── */

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
        {value}
      </span>
    </div>
  )
}
