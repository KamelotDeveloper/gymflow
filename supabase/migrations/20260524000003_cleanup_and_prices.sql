-- =============================================================================
-- Migration: Cleanup, new prices, and 3 admin users
-- Description:
--   1. Delete all app data (workouts, routines, memberships, payments)
--   2. Update membership plan prices
--   3. Create 3 admin users (Elias, Mateo, Gise)
--   4. Delete old member profiles/users
-- =============================================================================

-- =============================================================================
-- 1. CLEAN ALL APP DATA (order matters for foreign keys)
-- =============================================================================
DELETE FROM workout_logs;
DELETE FROM workout_sessions;
DELETE FROM routine_assignments;
DELETE FROM routine_exercises;
DELETE FROM routines;
DELETE FROM memberships;
DELETE FROM payment_transactions;

-- =============================================================================
-- 2. UPDATE MEMBERSHIP PLAN PRICES
-- =============================================================================
-- Mensual: $38.000
UPDATE membership_plans SET price = 38000 WHERE name = 'Mensual';
-- Semestral: $38.000 × 6 − 10% = $205.200
UPDATE membership_plans SET price = 205200 WHERE name = 'Semestral';
-- Anual: $38.000 × 12 − 15% = $387.600
UPDATE membership_plans SET price = 387600 WHERE name = 'Anual';

-- =============================================================================
-- 3. DELETE OLD PROFILES (keep new admins after they're created)
-- =============================================================================
-- Primero borramos todos los profiles con role = 'member'
DELETE FROM public.profiles WHERE role = 'member';

-- =============================================================================
-- 4. CREATE 3 ADMIN USERS
-- =============================================================================
-- Password: Gym12345 (bcrypt hash)
-- Generated with: crypt('Gym12345', gen_salt('bf'))
DO $$
DECLARE
  uid_elias uuid := gen_random_uuid();
  uid_mateo uuid := gen_random_uuid();
  uid_gise  uuid := gen_random_uuid();
BEGIN
  -- Elias
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES (
    uid_elias,
    'elias@admin.com',
    crypt('Gym12345', gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', 'Elias Admin'),
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE SET
    encrypted_password = crypt('Gym12345', gen_salt('bf')),
    email_confirmed_at = now(),
    raw_user_meta_data = jsonb_build_object('full_name', 'Elias Admin'),
    updated_at = now();

  -- Mateo
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES (
    uid_mateo,
    'mateo@admin.com',
    crypt('Gym12345', gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', 'Mateo Admin'),
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE SET
    encrypted_password = crypt('Gym12345', gen_salt('bf')),
    email_confirmed_at = now(),
    raw_user_meta_data = jsonb_build_object('full_name', 'Mateo Admin'),
    updated_at = now();

  -- Gise
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES (
    uid_gise,
    'gise@admin.com',
    crypt('Gym12345', gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', 'Gise Admin'),
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE SET
    encrypted_password = crypt('Gym12345', gen_salt('bf')),
    email_confirmed_at = now(),
    raw_user_meta_data = jsonb_build_object('full_name', 'Gise Admin'),
    updated_at = now();

  -- Ensure profiles exist and have admin role (trigger may have created them)
  INSERT INTO public.profiles (id, role, full_name)
  VALUES
    (uid_elias, 'admin', 'Elias Admin'),
    (uid_mateo, 'admin', 'Mateo Admin'),
    (uid_gise,  'admin', 'Gise Admin')
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    full_name = CASE
      WHEN excluded.id = uid_elias THEN 'Elias Admin'
      WHEN excluded.id = uid_mateo THEN 'Mateo Admin'
      WHEN excluded.id = uid_gise  THEN 'Gise Admin'
    END;
END $$;

-- Delete old admin profiles (Juan Perez and Administrador) if they still exist
DELETE FROM public.profiles WHERE role = 'admin' AND full_name IN ('Juan Perez', 'Administrador');

-- =============================================================================
-- 5. VERIFICATION
-- =============================================================================
SELECT '✅ Prices updated' AS result;
SELECT name, price FROM membership_plans ORDER BY duration_months;

SELECT '✅ Admin users created' AS result;
SELECT p.full_name, p.role, u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'admin';
