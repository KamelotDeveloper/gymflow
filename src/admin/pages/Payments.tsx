import { useEffect, useState, useCallback } from 'react'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import PaymentsList from '../components/PaymentsList'
import ConfirmPaymentModal from '../components/ConfirmPaymentModal'
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
