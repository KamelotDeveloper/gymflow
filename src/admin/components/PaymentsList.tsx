import { useState, useEffect } from 'react'
import { ExternalLink, CheckCircle2, XCircle } from 'lucide-react'

export type Transaction = {
  id: string
  profile_id: string
  plan_id: string
  payment_method_id: string
  amount: number
  currency: string
  status: 'pending' | 'confirmed' | 'rejected' | 'refunded'
  mp_preference_id: string | null
  mp_payment_id: string | null
  receipt_url: string | null
  receipt_ref: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
  profile: { full_name: string }
  plan: { name: string }
  payment_method: { type: 'mp' | 'bank_transfer' | 'cash'; name: string }
}

type Props = {
  transactions: Transaction[]
  onConfirm: (txn: Transaction) => void
  onReject: (txn: Transaction) => void
  loading: boolean
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Pendiente', bg: '#FEF3C7', color: '#92400E' },
  confirmed: { label: 'Confirmado', bg: '#D1FAE5', color: '#065F46' },
  rejected: { label: 'Rechazado', bg: '#FEE2E2', color: '#991B1B' },
  refunded: { label: 'Reembolsado', bg: '#DBEAFE', color: '#1E40AF' },
}

const METHOD_LABELS: Record<string, string> = {
  mp: 'Mercado Pago',
  bank_transfer: 'Transferencia',
  cash: 'Efectivo',
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
  })
}

export default function PaymentsList({
  transactions,
  onConfirm,
  onReject,
  loading,
}: Props) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  if (loading) {
    return isMobile ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3, 4, 5].map((i) => <MobilePaymentCardSkeleton key={i} />)}
      </div>
    ) : (
      <div style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <Th>Usuario</Th>
              <Th>Plan</Th>
              <Th>Monto</Th>
              <Th>Método</Th>
              <Th>Comprobante</Th>
              <Th>Fecha</Th>
              <Th>Estado</Th>
              <Th style={{ width: 160 }}>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
          </tbody>
        </table>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', padding: '48px 16px', color: '#6b7280', fontSize: 14 }}>
          No hay transacciones para mostrar.
        </div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {transactions.map((txn) => {
          const statusCfg = STATUS_CONFIG[txn.status] ?? STATUS_CONFIG.pending
          return (
            <div key={txn.id} style={{
              backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
              padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{txn.profile?.full_name ?? '—'}</div>
                  <div style={{ fontSize: 13, color: '#374151' }}>{txn.plan?.name ?? '—'}</div>
                </div>
                <span style={{
                  display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                  fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                  backgroundColor: statusCfg.bg, color: statusCfg.color,
                }}>
                  {statusCfg.label}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#374151', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: '#111' }}>{formatPrice(txn.amount)}</span>
                <span>• {txn.payment_method?.name ?? METHOD_LABELS[txn.payment_method?.type] ?? '—'}</span>
                <span>• {formatDate(txn.created_at)}</span>
              </div>

              {txn.receipt_url && (
                <a href={txn.receipt_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#DC2626', textDecoration: 'none', fontWeight: 500 }}>
                  <ExternalLink size={14} /> Ver comprobante
                </a>
              )}

              {txn.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={() => onConfirm(txn)} style={confirmBtnStyle}>
                    <CheckCircle2 size={16} /> Confirmar
                  </button>
                  <button onClick={() => onReject(txn)} style={rejectBtnStyle}>
                    <XCircle size={16} /> Rechazar
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <Th>Usuario</Th>
              <Th>Plan</Th>
              <Th>Monto</Th>
              <Th>Método</Th>
              <Th>Comprobante</Th>
              <Th>Fecha</Th>
              <Th>Estado</Th>
              <Th style={{ width: 160 }}>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn) => {
              const statusCfg = STATUS_CONFIG[txn.status] ?? STATUS_CONFIG.pending
              return (
                <tr key={txn.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <Td>{txn.profile?.full_name ?? '—'}</Td>
                  <Td>{txn.plan?.name ?? '—'}</Td>
                  <Td><span style={{ fontWeight: 600 }}>{formatPrice(txn.amount)}</span></Td>
                  <Td>
                    <span style={{ fontSize: 13, color: '#374151' }}>
                      {txn.payment_method?.name ?? METHOD_LABELS[txn.payment_method?.type] ?? '—'}
                    </span>
                  </Td>
                  <Td>
                    {txn.receipt_url ? (
                      <a href={txn.receipt_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#DC2626', textDecoration: 'none', fontWeight: 500 }}>
                        <ExternalLink size={14} /> Ver
                      </a>
                    ) : <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>}
                  </Td>
                  <Td><span style={{ fontSize: 13, color: '#374151' }}>{formatDate(txn.created_at)}</span></Td>
                  <Td>
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, backgroundColor: statusCfg.bg, color: statusCfg.color }}>
                      {statusCfg.label}
                    </span>
                  </Td>
                  <Td>
                    {txn.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => onConfirm(txn)} style={confirmBtnStyle}>
                          <CheckCircle2 size={16} /> Confirmar
                        </button>
                        <button onClick={() => onReject(txn)} style={rejectBtnStyle}>
                          <XCircle size={16} /> Rechazar
                        </button>
                      </div>
                    ) : <span style={{ color: '#9ca3af', fontSize: 13, fontStyle: 'italic' }}>—</span>}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Styles ── */

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
}

const confirmBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 32,
  padding: '0 12px',
  backgroundColor: '#059669',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

const rejectBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 32,
  padding: '0 12px',
  backgroundColor: '#DC2626',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

/* ── Helpers ── */

function Th({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
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
  return (
    <td style={{ padding: '12px 16px', fontSize: 14, color: '#111' }}>
      {children}
    </td>
  )
}

function MobilePaymentCardSkeleton() {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="animate-pulse" style={{ height: 14, width: '50%', backgroundColor: '#e5e7eb', borderRadius: 4 }} />
      <div className="animate-pulse" style={{ height: 14, width: '35%', backgroundColor: '#e5e7eb', borderRadius: 4 }} />
      <div className="animate-pulse" style={{ height: 12, width: '70%', backgroundColor: '#e5e7eb', borderRadius: 4 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <div className="animate-pulse" style={{ height: 32, width: 100, backgroundColor: '#e5e7eb', borderRadius: 6 }} />
        <div className="animate-pulse" style={{ height: 32, width: 90, backgroundColor: '#e5e7eb', borderRadius: 6 }} />
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr>
      <td style={{ padding: '12px 16px' }}>
        <div className="animate-pulse" style={{ height: 14, width: 120, backgroundColor: '#e5e7eb', borderRadius: 4 }} />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div className="animate-pulse" style={{ height: 14, width: 100, backgroundColor: '#e5e7eb', borderRadius: 4 }} />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div className="animate-pulse" style={{ height: 14, width: 80, backgroundColor: '#e5e7eb', borderRadius: 4 }} />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div className="animate-pulse" style={{ height: 14, width: 110, backgroundColor: '#e5e7eb', borderRadius: 4 }} />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div className="animate-pulse" style={{ height: 14, width: 50, backgroundColor: '#e5e7eb', borderRadius: 4 }} />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div className="animate-pulse" style={{ height: 14, width: 80, backgroundColor: '#e5e7eb', borderRadius: 4 }} />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div className="animate-pulse" style={{ height: 14, width: 70, backgroundColor: '#e5e7eb', borderRadius: 4 }} />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div className="animate-pulse" style={{ height: 14, width: 130, backgroundColor: '#e5e7eb', borderRadius: 4 }} />
      </td>
    </tr>
  )
}
