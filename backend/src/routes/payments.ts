import { Router } from 'express'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { supabase } from '../supabase.js'

// Extend Express Request to include adminId after requireAdmin middleware
declare global {
  namespace Express {
    interface Request {
      adminId?: string
    }
  }
}

const router = Router()

// ──────────────────────────────────────────────
//  Auth helpers
// ──────────────────────────────────────────────

function extractToken(req: { headers: { authorization?: string } }): string | null {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return null
  return header.replace('Bearer ', '')
}

async function getUserFromToken(token: string) {
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

/** Middleware that requires a valid JWT and admin role. Sets req.adminId. */
async function requireAdmin(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  const token = extractToken(req)
  if (!token) return res.status(401).json({ error: 'No token provided' })

  const user = await getUserFromToken(token)
  if (!user) return res.status(401).json({ error: 'Invalid or expired token' })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

  req.adminId = user.id
  next()
}

/** Helper for user-authenticated routes: extracts + validates JWT, returns user or sends error. */
async function authenticateUser(req: import('express').Request, res: import('express').Response) {
  const token = extractToken(req)
  if (!token) {
    res.status(401).json({ error: 'No token provided' })
    return null
  }

  const user = await getUserFromToken(token)
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return null
  }

  return user
}

// ──────────────────────────────────────────────
//  Mercado Pago preference client
// ──────────────────────────────────────────────

interface MPPreferenceInput {
  items: Array<{ title: string; quantity: number; unit_price: number; currency_id: string }>
  back_urls?: { success: string; failure: string; pending: string }
  auto_return?: string
  notification_url?: string
}

interface MPPreferenceOutput {
  id: string
  init_point: string
  sandbox_init_point: string
}

async function createMPPreference(input: MPPreferenceInput): Promise<MPPreferenceOutput> {
  const accessToken = process.env.MP_ACCESS_TOKEN

  if (!accessToken) {
    // Fallback mock si no hay token configurado
    const mockId = `mock_pref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    return {
      id: mockId,
      init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${mockId}`,
      sandbox_init_point: `https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=${mockId}`,
    }
  }

  const client = new MercadoPagoConfig({ accessToken })
  const preference = new Preference(client)
  const result = await preference.create({ body: input as any })

  return {
    id: result.id!,
    init_point: result.init_point!,
    sandbox_init_point: result.sandbox_init_point ?? result.init_point!,
  }
}

// ──────────────────────────────────────────────
//  POST /mp/create-preference
//  User-facing: creates a Mercado Pago preference
// ──────────────────────────────────────────────

router.post('/mp/create-preference', async (req, res) => {
  try {
    const user = await authenticateUser(req, res)
    if (!user) return

    const { plan_id } = req.body
    if (!plan_id) {
      return res.status(400).json({ error: 'plan_id es requerido' })
    }

    // 1. Verify plan exists and is active
    const { data: plan, error: planErr } = await supabase
      .from('membership_plans')
      .select('id, name, price, duration_months, is_active')
      .eq('id', plan_id)
      .single()

    if (planErr || !plan) {
      return res.status(404).json({ error: 'Plan no encontrado' })
    }
    if (!plan.is_active) {
      return res.status(400).json({ error: 'El plan no está activo' })
    }

    // 2. Check no pending transaction for this user
    const { data: pendingTxn } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('profile_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (pendingTxn) {
      return res.status(409).json({ error: 'Ya tenés un pago pendiente. Esperá a que sea procesado.' })
    }

    // 3. Get MP method ID
    const { data: mpMethod } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('type', 'mp')
      .eq('is_active', true)
      .single()

    if (!mpMethod) {
      return res.status(500).json({ error: 'Mercado Pago no está configurado como método de pago' })
    }

    // 4. Create payment_transaction with temp mp_preference_id
    const { data: txn, error: txnErr } = await supabase
      .from('payment_transactions')
      .insert({
        profile_id: user.id,
        plan_id: plan.id,
        payment_method_id: mpMethod.id,
        amount: plan.price,
        currency: 'ARS',
        status: 'pending',
        mp_preference_id: 'pending',
      })
      .select()
      .single()

    if (txnErr || !txn) {
      console.error('Error creating transaction:', txnErr)
      return res.status(500).json({ error: 'Error al crear la transacción' })
    }

    // 5. Create MP preference (mock for now)
    let mpPreference: MPPreferenceOutput
    try {
      mpPreference = await createMPPreference({
        items: [
          {
            title: plan.name,
            quantity: 1,
            unit_price: plan.price,
            currency_id: 'ARS',
          },
        ],
        back_urls: {
          success: `${process.env.FRONTEND_URL || 'https://bb0e6a19.gymflow-21q.pages.dev'}/membresia?txn=${txn.id}`,
          failure: `${process.env.FRONTEND_URL || 'https://bb0e6a19.gymflow-21q.pages.dev'}/membresia?error=mp_failure`,
          pending: `${process.env.FRONTEND_URL || 'https://bb0e6a19.gymflow-21q.pages.dev'}/membresia?txn=${txn.id}`,
        },
        auto_return: 'all',
        notification_url: `${process.env.SUPABASE_URL}/functions/v1/mercadopago-webhook`,
      })
    } catch (mpErr) {
      // If MP call fails, delete pending transaction so user can retry
      console.error('MP preference creation failed:', mpErr)
      await supabase
        .from('payment_transactions')
        .delete()
        .eq('id', txn.id)
      return res.status(502).json({ error: 'Error al conectar con Mercado Pago. Intentá de nuevo.' })
    }

    // 6. Update transaction with real mp_preference_id
    await supabase
      .from('payment_transactions')
      .update({ mp_preference_id: mpPreference.id })
      .eq('id', txn.id)

    return res.status(201).json({
      init_point: mpPreference.init_point,
      transaction_id: txn.id,
    })
  } catch (err) {
    console.error('Unexpected error in mp/create-preference:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ──────────────────────────────────────────────
//  POST /manual/create
//  User-facing: creates a pending manual payment
// ──────────────────────────────────────────────

router.post('/manual/create', async (req, res) => {
  try {
    const user = await authenticateUser(req, res)
    if (!user) return

    const { plan_id, payment_method_id, receipt_url, receipt_ref } = req.body

    if (!plan_id || !payment_method_id) {
      return res.status(400).json({ error: 'plan_id y payment_method_id son requeridos' })
    }

    // 1. Verify plan exists and is active
    const { data: plan, error: planErr } = await supabase
      .from('membership_plans')
      .select('id, name, price, is_active')
      .eq('id', plan_id)
      .single()

    if (planErr || !plan) {
      return res.status(404).json({ error: 'Plan no encontrado' })
    }
    if (!plan.is_active) {
      return res.status(400).json({ error: 'El plan no está activo' })
    }

    // 2. Verify payment method exists and is active
    const { data: method, error: methodErr } = await supabase
      .from('payment_methods')
      .select('id, type, name, is_active')
      .eq('id', payment_method_id)
      .single()

    if (methodErr || !method) {
      return res.status(404).json({ error: 'Método de pago no encontrado' })
    }
    if (!method.is_active) {
      return res.status(400).json({ error: 'El método de pago no está activo' })
    }

    // 3. Validate receipt rules per method type
    if (method.type === 'bank_transfer' && !receipt_url) {
      return res.status(400).json({ error: 'Transferencia bancaria requiere comprobante (receipt_url)' })
    }
    if (method.type === 'cash' && receipt_url) {
      return res.status(400).json({ error: 'Efectivo no requiere comprobante' })
    }

    // 4. Check no pending transaction for this user
    const { data: pendingTxn } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('profile_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (pendingTxn) {
      return res.status(409).json({ error: 'Ya tenés un pago pendiente. Esperá a que sea procesado.' })
    }

    // 5. Create transaction
    const { data: txn, error: txnErr } = await supabase
      .from('payment_transactions')
      .insert({
        profile_id: user.id,
        plan_id: plan.id,
        payment_method_id: method.id,
        amount: plan.price,
        currency: 'ARS',
        status: 'pending',
        receipt_url: receipt_url || null,
        receipt_ref: receipt_ref || null,
      })
      .select()
      .single()

    if (txnErr || !txn) {
      console.error('Error creating manual transaction:', txnErr)
      return res.status(500).json({ error: 'Error al crear la transacción' })
    }

    return res.status(201).json({
      transaction_id: txn.id,
      status: 'pending',
    })
  } catch (err) {
    console.error('Unexpected error in manual/create:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ──────────────────────────────────────────────
//  POST /confirm    [ADMIN]
//  Admin confirms a payment → creates membership
// ──────────────────────────────────────────────

router.post('/confirm', requireAdmin, async (req, res) => {
  try {
    const { transaction_id } = req.body
    if (!transaction_id) {
      return res.status(400).json({ error: 'transaction_id es requerido' })
    }

    // 1. Find transaction with plan details, verify pending
    const { data: txn, error: txnErr } = await supabase
      .from('payment_transactions')
      .select('id, profile_id, plan_id, amount, status')
      .eq('id', transaction_id)
      .single()

    if (txnErr || !txn) {
      return res.status(404).json({ error: 'Transacción no encontrada' })
    }
    if (txn.status !== 'pending') {
      return res.status(400).json({ error: `La transacción ya fue ${txn.status}` })
    }

    // 2. Get plan details for duration
    const { data: plan, error: planErr } = await supabase
      .from('membership_plans')
      .select('id, duration_months')
      .eq('id', txn.plan_id)
      .single()

    if (planErr || !plan) {
      return res.status(500).json({ error: 'Plan no encontrado para esta transacción' })
    }

    // 3. Calculate dates
    const now = new Date()
    const startDate = now.toISOString()
    const endDate = new Date(now.getFullYear(), now.getMonth() + plan.duration_months, now.getDate()).toISOString()

    // 4. Create membership
    const { data: membership, error: memErr } = await supabase
      .from('memberships')
      .insert({
        profile_id: txn.profile_id,
        plan_id: txn.plan_id,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        payment_transaction_id: txn.id,
      })
      .select()
      .single()

    if (memErr || !membership) {
      console.error('Error creating membership:', memErr)
      return res.status(500).json({ error: 'Error al crear la membresía' })
    }

    // 5. Update transaction status
    const { error: updateErr } = await supabase
      .from('payment_transactions')
      .update({
        status: 'confirmed',
        confirmed_by: req.adminId,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', txn.id)

    if (updateErr) {
      console.error('Error updating transaction:', updateErr)
      // Membership was created but transaction update failed — still return success
      // since the critical operation (membership creation) succeeded
    }

    return res.status(200).json({
      membership_id: membership.id,
      status: 'confirmed',
    })
  } catch (err) {
    console.error('Unexpected error in confirm:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ──────────────────────────────────────────────
//  POST /reject    [ADMIN]
//  Admin rejects a pending payment
// ──────────────────────────────────────────────

router.post('/reject', requireAdmin, async (req, res) => {
  try {
    const { transaction_id, reason } = req.body
    if (!transaction_id) {
      return res.status(400).json({ error: 'transaction_id es requerido' })
    }

    // Find and verify pending
    const { data: txn, error: txnErr } = await supabase
      .from('payment_transactions')
      .select('id, status')
      .eq('id', transaction_id)
      .single()

    if (txnErr || !txn) {
      return res.status(404).json({ error: 'Transacción no encontrada' })
    }
    if (txn.status !== 'pending') {
      return res.status(400).json({ error: `La transacción ya fue ${txn.status}` })
    }

    const { error: updateErr } = await supabase
      .from('payment_transactions')
      .update({
        status: 'rejected',
        confirmed_by: req.adminId,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', transaction_id)

    if (updateErr) {
      console.error('Error rejecting transaction:', updateErr)
      return res.status(500).json({ error: 'Error al rechazar la transacción' })
    }

    return res.status(200).json({ status: 'rejected' })
  } catch (err) {
    console.error('Unexpected error in reject:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ──────────────────────────────────────────────
//  GET /    [ADMIN]
//  List transactions with filters
// ──────────────────────────────────────────────

router.get('/', requireAdmin, async (req, res) => {
  try {
    let query = supabase
      .from('payment_transactions')
      .select(`
        *,
        profile:profile_id ( full_name ),
        plan:plan_id ( name ),
        payment_method:payment_method_id ( type, name )
      `)
      .order('created_at', { ascending: false })

    // Apply optional filters
    const { status, method } = req.query as { status?: string; method?: string }

    if (status) {
      query = query.eq('status', status)
    }
    if (method) {
      query = query.eq('payment_method_id', method)
    }

    const { data: transactions, error } = await query

    if (error) {
      console.error('Error fetching transactions:', error)
      return res.status(500).json({ error: 'Error al obtener transacciones' })
    }

    return res.status(200).json({ transactions: transactions || [] })
  } catch (err) {
    console.error('Unexpected error in GET /:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ──────────────────────────────────────────────
//  GET /methods
//  Public: returns active payment methods
// ──────────────────────────────────────────────

router.get('/methods', async (_req, res) => {
  try {
    const { data: methods, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching payment methods:', error)
      return res.status(500).json({ error: 'Error al obtener métodos de pago' })
    }

    return res.status(200).json({ methods: methods || [] })
  } catch (err) {
    console.error('Unexpected error in GET /methods:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// ──────────────────────────────────────────────
//  PUT /methods/:id    [ADMIN]
//  Update a payment method (toggle active, config)
// ──────────────────────────────────────────────

router.put('/methods/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { is_active, config } = req.body

    if (is_active === undefined && config === undefined) {
      return res.status(400).json({ error: 'Proveé al menos is_active o config para actualizar' })
    }

    const updateData: { is_active?: boolean; config?: object } = {}
    if (is_active !== undefined) updateData.is_active = is_active
    if (config !== undefined) updateData.config = config

    const { data: method, error } = await supabase
      .from('payment_methods')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Método de pago no encontrado' })
      }
      console.error('Error updating payment method:', error)
      return res.status(500).json({ error: 'Error al actualizar método de pago' })
    }

    return res.status(200).json({ method })
  } catch (err) {
    console.error('Unexpected error in PUT /methods/:id:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
