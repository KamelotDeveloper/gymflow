import { useEffect, useState, useCallback } from 'react'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import PaymentsList from '../components/PaymentsList'
import ConfirmPaymentModal from '../components/ConfirmPaymentModal'
import BankTransferDetails from '../../shared/components/BankTransferDetails'
import { Pencil, ChevronDown } from 'lucide-react'
import type { Transaction } from '../components/PaymentsList'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000'

type StatusFilter = '' | 'pending' | 'confirmed' | 'rejected'

const FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'rejected', label: 'Rechazados' },
]

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  return headers
}

export default function Payments() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalAction, setModalAction] = useState<'confirm' | 'reject'>('confirm')
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const [_actionLoading, setActionLoading] = useState(false)

  // Bank transfer data config
  const [bankMethod, setBankMethod] = useState<any | null>(null)
  const [editingBank, setEditingBank] = useState(false)
  const [bankForm, setBankForm] = useState({ cbu: '', alias: '', titular: '', cuit: '', banco: '' })
  const [savingBank, setSavingBank] = useState(false)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const url = statusFilter
        ? `${BACKEND_URL}/api/payments?status=${statusFilter}`
        : `${BACKEND_URL}/api/payments`
      const res = await fetch(url, { headers })
      if (!res.ok) {
        console.error('Error fetching payments:', res.status)
        setTransactions([])
        return
      }
      const data = await res.json()
      setTransactions(data.transactions ?? [])
    } catch (err) {
      console.error('Error fetching payments:', err)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchTransactions()
    fetchPaymentMethods()
  }, [fetchTransactions])

  const openConfirmModal = (txn: Transaction) => {
    setSelectedTxn(txn)
    setModalAction('confirm')
    setModalOpen(true)
  }

  const openRejectModal = (txn: Transaction) => {
    setSelectedTxn(txn)
    setModalAction('reject')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedTxn(null)
  }

  const handleConfirm = async (txn: Transaction) => {
    setActionLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${BACKEND_URL}/api/payments/confirm`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transaction_id: txn.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Error al confirmar el pago')
        return
      }
      closeModal()
      await fetchTransactions()
    } catch (err) {
      console.error('Error confirming payment:', err)
      alert('Error al confirmar el pago. Intentá de nuevo.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (txn: Transaction, reason?: string) => {
    setActionLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${BACKEND_URL}/api/payments/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transaction_id: txn.id, reason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Error al rechazar el pago')
        return
      }
      closeModal()
      await fetchTransactions()
    } catch (err) {
      console.error('Error rejecting payment:', err)
      alert('Error al rechazar el pago. Intentá de nuevo.')
    } finally {
      setActionLoading(false)
    }
  }

  const fetchPaymentMethods = async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${BACKEND_URL}/api/payments/methods`, { headers })
      if (res.ok) {
        const data = await res.json()
        const bank = (data.methods ?? []).find((m: any) => m.type === 'bank_transfer')
        setBankMethod(bank ?? null)
      }
    } catch { /* ignore */ }
  }

  const handleStartBankEdit = () => {
    if (!bankMethod) return
    const config = bankMethod.config ?? {}
    setBankForm({
      cbu: config.cbu ?? '',
      alias: config.alias ?? '',
      titular: config.titular ?? '',
      cuit: config.cuit ?? '',
      banco: config.banco ?? '',
    })
    setEditingBank(true)
  }

  const handleCancelBankEdit = () => setEditingBank(false)

  const handleSaveBankData = async () => {
    if (!bankMethod) return
    setSavingBank(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${BACKEND_URL}/api/payments/methods/${bankMethod.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          config: {
            cbu: bankForm.cbu.trim(),
            alias: bankForm.alias.trim(),
            titular: bankForm.titular.trim(),
            cuit: bankForm.cuit.trim(),
            banco: bankForm.banco.trim(),
          },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setBankMethod(data.method)
        setEditingBank(false)
      }
    } catch { /* ignore */ }
    finally { setSavingBank(false) }
  }

  return (
    <AdminLayout pageTitle="Pagos">
      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            style={{
              ...filterTabStyle,
              backgroundColor:
                statusFilter === tab.value ? '#DC2626' : '#fff',
              color: statusFilter === tab.value ? '#fff' : '#374151',
              borderColor:
                statusFilter === tab.value ? '#DC2626' : '#e5e7eb',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <PaymentsList
        transactions={transactions}
        onConfirm={openConfirmModal}
        onReject={openRejectModal}
        loading={loading}
      />

      {/* Modal */}
      <ConfirmPaymentModal
        open={modalOpen}
        onClose={closeModal}
        transaction={selectedTxn}
        onConfirm={handleConfirm}
        onReject={handleReject}
        action={modalAction}
      />

      {/* ── Bank transfer data config ── */}
      {bankMethod && (
        <details
          style={{ marginTop: 32 }}
          onToggle={() => {
            // used for ChevronDown rotation styling if needed
          }}
        >
          <summary
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#111827',
              cursor: 'pointer',
              listStyle: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span>Datos de transferencia bancaria</span>
            <ChevronDown size={16} />
          </summary>
          <div
            style={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
              padding: 16,
            }}
          >
            {editingBank ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(['cbu','alias','titular','cuit','banco'] as const).map(field => (
                  <div key={field}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: 0.025,
                        marginBottom: 4,
                      }}
                    >
                      {field === 'cbu' ? 'CBU' : field === 'cuit' ? 'CUIT' : field.charAt(0).toUpperCase() + field.slice(1)}
                    </label>
                    <input
                      type="text"
                      value={bankForm[field]}
                      onChange={e => setBankForm(prev => ({ ...prev, [field]: e.target.value }))}
                      style={{
                        width: '100%',
                        borderRadius: 8,
                        border: '1px solid #d1d5db',
                        backgroundColor: '#fff',
                        padding: '8px 12px',
                        fontSize: 14,
                        color: '#111827',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#DC2626'
                        e.target.style.boxShadow = '0 0 0 2px rgba(220,38,38,0.25)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#d1d5db'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
                  <button
                    onClick={handleCancelBankEdit}
                    style={{
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      padding: '8px 16px',
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#374151',
                      cursor: 'pointer',
                      backgroundColor: '#fff',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveBankData}
                    disabled={savingBank}
                    style={{
                      borderRadius: 8,
                      backgroundColor: '#DC2626',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 700,
                      padding: '8px 16px',
                      border: 'none',
                      cursor: savingBank ? 'not-allowed' : 'pointer',
                      opacity: savingBank ? 0.5 : 1,
                    }}
                  >
                    {savingBank ? 'Guardando...' : 'Guardar datos'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <BankTransferDetails
                  cbu={bankMethod.config?.cbu}
                  alias={bankMethod.config?.alias}
                  titular={bankMethod.config?.titular}
                  cuit={bankMethod.config?.cuit}
                  banco={bankMethod.config?.banco}
                />
                <button
                  onClick={handleStartBankEdit}
                  style={{
                    marginTop: 16,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6b7280',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                  }}
                >
                  <Pencil size={14} /> Editar datos
                </button>
              </div>
            )}
          </div>
        </details>
      )}
    </AdminLayout>
  )
}

const filterTabStyle: React.CSSProperties = {
  height: 36,
  padding: '0 18px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  transition: 'all 0.15s',
}
