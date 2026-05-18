import { supabase } from '../lib/supabase'

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

type ManualPaymentParams = {
  planId: string
  paymentMethodId: string
  receiptUrl?: string
  receiptRef?: string
}

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  return headers
}

export function usePayments() {
  /** Fetch all active payment methods from the backend */
  const fetchPaymentMethods = async (): Promise<PaymentMethod[]> => {
    const headers = await getAuthHeaders()
    const res = await fetch(`${BACKEND_URL}/api/payments/methods`, { headers })
    if (!res.ok) {
      throw new Error('Error al obtener métodos de pago')
    }
    const data = await res.json()
    return (data.methods ?? []) as PaymentMethod[]
  }

  /**
   * Create a Mercado Pago preference and redirect to MP checkout.
   * Returns the backend response (which includes init_point).
   */
  const createMPPreference = async (planId: string) => {
    const headers = await getAuthHeaders()
    const res = await fetch(`${BACKEND_URL}/api/payments/mp/create-preference`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ plan_id: planId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Error al conectar con Mercado Pago')
    }
    const data = await res.json()
    // Redirect user to MP Checkout Pro
    window.location.href = data.init_point
    return data
  }

  /**
   * Create a manual payment (bank transfer or cash).
   * Receipt upload must be done before calling this (receiptUrl comes from storage).
   */
  const createManualPayment = async (params: ManualPaymentParams) => {
    const headers = await getAuthHeaders()
    const res = await fetch(`${BACKEND_URL}/api/payments/manual/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        plan_id: params.planId,
        payment_method_id: params.paymentMethodId,
        receipt_url: params.receiptUrl ?? null,
        receipt_ref: params.receiptRef ?? null,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Error al crear el pago')
    }
    return await res.json()
  }

  /** Fetch pending transactions for the given profile from Supabase directly */
  const fetchPendingTransactions = async (profileId: string) => {
    const { data, error } = await (supabase as any)
      .from('payment_transactions')
      .select('*')
      .eq('profile_id', profileId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  /** Look up a transaction by its MP preference ID (used after MP redirect) */
  const fetchTransactionByMPPreference = async (mpPreferenceId: string) => {
    const { data, error } = await (supabase as any)
      .from('payment_transactions')
      .select('*')
      .eq('mp_preference_id', mpPreferenceId)
      .maybeSingle()
    if (error) throw error
    return data ?? null
  }

  return {
    fetchPaymentMethods,
    createMPPreference,
    createManualPayment,
    fetchPendingTransactions,
    fetchTransactionByMPPreference,
  }
}
