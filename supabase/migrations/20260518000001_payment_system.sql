-- Migration: Payment System
-- Description: payment_methods, payment_transactions tables, storage, and RLS

-- ============================================================
-- 1. TABLES
-- ============================================================

-- 1.1 payment_methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('mp', 'bank_transfer', 'cash')),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  config jsonb,
  created_at timestamptz DEFAULT now()
);

-- 1.2 payment_transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  plan_id uuid NOT NULL REFERENCES membership_plans(id),
  payment_method_id uuid NOT NULL REFERENCES payment_methods(id),
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'ARS',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'refunded')),
  mp_preference_id text,
  mp_payment_id text,
  receipt_url text,
  receipt_ref text,
  confirmed_by uuid REFERENCES profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_payment_tx_profile ON payment_transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_tx_mp_pref ON payment_transactions(mp_preference_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_mp_payment ON payment_transactions(mp_payment_id);

-- ============================================================
-- 3. MEMBERSHIPS ALTER
-- ============================================================

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS payment_transaction_id uuid REFERENCES payment_transactions(id);

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- 4.1 Helper function: is_admin_or_own
CREATE OR REPLACE FUNCTION public.is_admin_or_own(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR id = p_profile_id)
  );
$$;

-- 4.2 payment_methods
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view payment methods"
  ON payment_methods
  FOR SELECT
  TO authenticated
  USING (true);

-- 4.3 payment_transactions
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own transactions"
  ON payment_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can view own transactions, admin can view all"
  ON payment_transactions
  FOR SELECT
  TO authenticated
  USING (is_admin_or_own(profile_id));

CREATE POLICY "Users can update pending own transactions"
  ON payment_transactions
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid() AND status = 'pending')
  WITH CHECK (profile_id = auth.uid() AND status = 'pending');

-- ============================================================
-- 5. STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own receipts"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own receipts, admin can view all"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- ============================================================
-- 6. SEED DATA
-- ============================================================

INSERT INTO payment_methods (type, name) VALUES
  ('mp', 'Mercado Pago'),
  ('bank_transfer', 'Transferencia Bancaria'),
  ('cash', 'Efectivo');
