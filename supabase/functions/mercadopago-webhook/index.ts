import { createClient } from 'npm:@supabase/supabase-js'

// ──────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────

interface MPWebhookPayload {
  action: string
  data: { id: string }
  type: 'payment' | string
}

interface MPPaymentResponse {
  id: number
  status: 'approved' | 'rejected' | 'pending' | 'cancelled' | 'refunded' | 'in_process'
  status_detail: string
  transaction_amount: number
  currency_id: string
  external_reference?: string
  preference_id?: string
}

// ──────────────────────────────────────────────
//  Signature verification
// ──────────────────────────────────────────────

/**
 * Validates the Mercado Pago webhook X-Signature header.
 *
 * MP sends a signature in the format: `ts=<timestamp>,v1=<hmac-sha256-hex>`
 * The signing manifest is: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 *
 * When MP_ACCESS_TOKEN is not set (dev mode), returns true to allow testing.
 */
async function verifySignature(
  req: Request,
  rawBody: string,
): Promise<boolean> {
  const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET')

  // Dev mode: skip verification if no secret configured
  if (!webhookSecret) {
    console.warn('[mercadopago-webhook] MP_WEBHOOK_SECRET not set — skipping signature verification')
    return true
  }

  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')

  if (!xSignature) {
    console.warn('[mercadopago-webhook] Missing x-signature header')
    return false
  }

  // Parse "ts=123,v1=abc123" into parts
  const parts = xSignature.split(',').map((p) => p.split('='))
  const ts = parts.find(([k]) => k === 'ts')?.[1]
  const hash = parts.find(([k]) => k === 'v1')?.[1]

  if (!ts || !hash) {
    console.warn('[mercadopago-webhook] Invalid x-signature format')
    return false
  }

  // Build the manifest string that was signed
  const dataId = (() => {
    try {
      const body = JSON.parse(rawBody)
      return body.data?.id ?? ''
    } catch {
      return ''
    }
  })()

  const manifest = `id:${dataId};request-id:${xRequestId ?? ''};ts:${ts};`

  // Compute HMAC-SHA256
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest))
  const computedHash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return computedHash === hash
}

// ──────────────────────────────────────────────
//  MP API client
// ──────────────────────────────────────────────

async function fetchMPPayment(paymentId: string | number): Promise<MPPaymentResponse | null> {
  const accessToken = Deno.env.get('MP_ACCESS_TOKEN')
  if (!accessToken) {
    console.warn('[mercadopago-webhook] MP_ACCESS_TOKEN not set — cannot fetch payment details')
    return null
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    console.error(`[mercadopago-webhook] MP API error: ${response.status} ${await response.text()}`)
    return null
  }

  return response.json()
}

// ──────────────────────────────────────────────
//  Webhook handler
// ──────────────────────────────────────────────

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Read raw body once for signature verification + JSON parsing
  const rawBody = await req.text()

  // Verify signature
  const valid = await verifySignature(req, rawBody)
  if (!valid) {
    console.warn('[mercadopago-webhook] Invalid signature — returning 200 to prevent MP retries')
    return new Response('OK', { status: 200 })
  }

  // Parse payload
  let payload: MPWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    console.error('[mercadopago-webhook] Invalid JSON body')
    return new Response('OK', { status: 200 })
  }

  // Only process payment.updated events
  if (payload.action !== 'payment.updated') {
    return new Response('OK', { status: 200 })
  }

  const mpPaymentId = payload.data?.id
  if (!mpPaymentId) {
    console.warn('[mercadopago-webhook] payment.updated event missing data.id')
    return new Response('OK', { status: 200 })
  }

  console.log(`[mercadopago-webhook] Processing payment.updated for MP payment ${mpPaymentId}`)

  // Fetch payment details from MP API
  const payment = await fetchMPPayment(mpPaymentId)
  if (!payment) {
    // If we can't fetch, still return 200 — MP will retry later
    return new Response('OK', { status: 200 })
  }

  // Only process approved payments
  if (payment.status !== 'approved') {
    console.log(`[mercadopago-webhook] Payment ${mpPaymentId} status is "${payment.status}" — skipping`)
    return new Response('OK', { status: 200 })
  }

  // ── Connect to Supabase ──
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseKey) {
    console.error('[mercadopago-webhook] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
    return new Response('OK', { status: 200 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Find the transaction by mp_preference_id (from external_reference or preference_id)
  // MP payment.external_reference could store our transaction ID
  // Or we match by mp_preference_id
  let transactionId: string | null = null

  // Try preference_id first
  if (payment.preference_id) {
    const { data: txn } = await supabase
      .from('payment_transactions')
      .select('id, status')
      .eq('mp_preference_id', payment.preference_id)
      .maybeSingle()

    if (txn) transactionId = txn.id
  }

  // Try external_reference as fallback
  if (!transactionId && payment.external_reference) {
    const { data: txn } = await supabase
      .from('payment_transactions')
      .select('id')
      .eq('id', payment.external_reference)
      .maybeSingle()

    if (txn) transactionId = txn.id
  }

  if (!transactionId) {
    console.warn(`[mercadopago-webhook] No transaction found for MP payment ${mpPaymentId}`)
    return new Response('OK', { status: 200 })
  }

  // ── Idempotency check: skip if already confirmed ──
  const { data: existing } = await supabase
    .from('payment_transactions')
    .select('id, status')
    .eq('id', transactionId)
    .single()

  if (!existing) {
    console.warn(`[mercadopago-webhook] Transaction ${transactionId} not found in DB`)
    return new Response('OK', { status: 200 })
  }

  if (existing.status === 'confirmed') {
    console.log(`[mercadopago-webhook] Transaction ${transactionId} already confirmed — skipping`)
    return new Response('OK', { status: 200 })
  }

  if (existing.status !== 'pending') {
    console.log(`[mercadopago-webhook] Transaction ${transactionId} status is "${existing.status}" — skipping`)
    return new Response('OK', { status: 200 })
  }

  // ── Get transaction details with plan ──
  const { data: txn, error: txnErr } = await supabase
    .from('payment_transactions')
    .select('*, plan:plan_id ( duration_months )')
    .eq('id', transactionId)
    .single()

  if (txnErr || !txn) {
    console.error(`[mercadopago-webhook] Error fetching transaction ${transactionId}:`, txnErr)
    return new Response('OK', { status: 200 })
  }

  const plan = txn.plan as unknown as { duration_months: number } | null
  if (!plan) {
    console.error(`[mercadopago-webhook] Transaction ${transactionId} has no associated plan`)
    return new Response('OK', { status: 200 })
  }

  // ── Create membership ──
  const now = new Date()
  const startDate = now.toISOString()
  const endDate = new Date(
    now.getFullYear(),
    now.getMonth() + plan.duration_months,
    now.getDate(),
  ).toISOString()

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
    console.error(`[mercadopago-webhook] Error creating membership for txn ${transactionId}:`, memErr)
    return new Response('OK', { status: 200 })
  }

  // ── Update transaction ──
  const { error: updateErr } = await supabase
    .from('payment_transactions')
    .update({
      status: 'confirmed',
      mp_payment_id: String(mpPaymentId),
      confirmed_at: now.toISOString(),
    })
    .eq('id', transactionId)

  if (updateErr) {
    console.error(`[mercadopago-webhook] Error updating transaction ${transactionId}:`, updateErr)
  }

  console.log(
    `[mercadopago-webhook] ✅ Payment ${mpPaymentId} confirmed — membership ${membership.id} created`,
  )

  return new Response('OK', { status: 200 })
})
