-- =============================================================================
-- GymFlow — Seed de datos de demo para presentación comercial
-- =============================================================================
-- CORRER EN SUPABASE SQL EDITOR.
-- Los usuarios se crean en auth.users, el trigger crea profiles automático.
-- Los ejercicios usan UUIDs fijos; si el ID ya existe se ignora (ON CONFLICT).
-- Contraseña de todos los usuarios demo: Demo1234!
-- =============================================================================

-- =============================================================================
-- 1. USUARIOS DEMO (auth.users + trigger → public.profiles)
-- =============================================================================

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES
  ('d0000001-0000-0000-0000-000000000001', 'lucas@demo.com',     crypt('Demo1234!', gen_salt('bf')), now(), '{"full_name": "Lucas Herrera"}'::jsonb),
  ('d0000002-0000-0000-0000-000000000002', 'valentina@demo.com', crypt('Demo1234!', gen_salt('bf')), now(), '{"full_name": "Valentina Gómez"}'::jsonb),
  ('d0000003-0000-0000-0000-000000000003', 'matias@demo.com',   crypt('Demo1234!', gen_salt('bf')), now(), '{"full_name": "Matías Rodríguez"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Asegurar role = 'member' (por si el trigger no lo setea)
UPDATE public.profiles SET role = 'member'
WHERE id IN (
  'd0000001-0000-0000-0000-000000000001',
  'd0000002-0000-0000-0000-000000000002',
  'd0000003-0000-0000-0000-000000000003'
) AND (role IS NULL OR role != 'member');

-- =============================================================================
-- 2. MEMBRESÍAS
-- =============================================================================

INSERT INTO public.memberships (profile_id, plan_id, start_date, end_date, status)
SELECT
  'd0000001-0000-0000-0000-000000000001',
  id,
  now() - interval '10 days',
  now() + interval '20 days',
  'active'
FROM membership_plans WHERE name = 'Mensual'
ON CONFLICT DO NOTHING;

INSERT INTO public.memberships (profile_id, plan_id, start_date, end_date, status)
SELECT
  'd0000002-0000-0000-0000-000000000002',
  id,
  now() - interval '4 months',
  now() + interval '8 months',
  'active'
FROM membership_plans WHERE name = 'Anual'
ON CONFLICT DO NOTHING;

INSERT INTO public.memberships (profile_id, plan_id, start_date, end_date, status)
SELECT
  'd0000003-0000-0000-0000-000000000003',
  id,
  now() - interval '5 months 25 days',
  now() + interval '5 days',
  'active'
FROM membership_plans WHERE name = 'Semestral'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. EJERCICIOS
--    IDs fijos para referenciarlos en rutinas y sesiones.
--    Si el ID ya existe (porque el ejercicio ya fue insertado), ON CONFLICT
--    lo ignora y el ID se reusa automáticamente.
-- =============================================================================

-- Día 1: Pecho/Tríceps
INSERT INTO public.exercises (id, name, muscle_group, video_url, video_type, instructions)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Press de banca',               'chest',   'https://www.youtube.com/watch?v=rT7DgCr-3pg',  'youtube', 'Acostado en banco plano, barra a la altura del pecho, presioná hacia arriba.'),
  ('a0000001-0000-0000-0000-000000000002', 'Press inclinado con mancuernas','chest',  'https://www.youtube.com/watch?v=8iPEnn-lGjY', 'youtube', 'Banco a 45°, mancuernas desde el pecho hacia arriba.'),
  ('a0000001-0000-0000-0000-000000000003', 'Aperturas con mancuernas',      'chest',  'https://www.youtube.com/watch?v=eozdVc78Qls', 'youtube', 'Acostado en banco plano, brazos extendidos, abrí y cerrá con control.'),
  ('a0000001-0000-0000-0000-000000000004', 'Fondos en paralelas',           'triceps','https://www.youtube.com/watch?v=2z8gY1E4GbA', 'youtube', 'Cuerpo recto, bajá hasta 90° y volvé.')
ON CONFLICT (id) DO NOTHING;

-- Día 2: Espalda/Bíceps
INSERT INTO public.exercises (id, name, muscle_group, video_url, video_type, instructions)
VALUES
  ('a0000001-0000-0000-0000-000000000005', 'Jalón al pecho',      'back',   'https://www.youtube.com/watch?v=lueEJGjTu5Y', 'youtube', 'Agarré ancho, llevá la barra al pecho, volvé controlado.'),
  ('a0000001-0000-0000-0000-000000000006', 'Remo con barra',      'back',   'https://www.youtube.com/watch?v=G8l_8chR5xg', 'youtube', 'Inclinado, barra hacia el abdomen, apretá la espalda.'),
  ('a0000001-0000-0000-0000-000000000007', 'Curl con barra',      'biceps', 'https://www.youtube.com/watch?v=kwG2ipFRgfo', 'youtube', 'Parado, barra desde los muslos al pecho, solo antebrazos se mueven.'),
  ('a0000001-0000-0000-0000-000000000008', 'Curl martillo',       'biceps', 'https://www.youtube.com/watch?v=zC3nLlEvin4', 'youtube', 'Mancuernas con agarre neutro, curl alternado.')
ON CONFLICT (id) DO NOTHING;

-- Día 3: Piernas
INSERT INTO public.exercises (id, name, muscle_group, video_url, video_type, instructions)
VALUES
  ('a0000001-0000-0000-0000-000000000009', 'Sentadilla con barra', 'quads',      'https://www.youtube.com/watch?v=gcNh17CkjD4', 'youtube', 'Barra en trampa, espalda recta, bajá hasta paralela.'),
  ('a0000001-0000-0000-0000-000000000010', 'Prensa de piernas',    'quads',      'https://www.youtube.com/watch?v=xySgR8p5ixk', 'youtube', 'Pies en plataforma, empujá sin bloquear rodillas.'),
  ('a0000001-0000-0000-0000-000000000011', 'Curl femoral',         'hamstrings', 'https://www.youtube.com/watch?v=ELq0E1m1mX8', 'youtube', 'Acostado en máquina, llevá los talones hacia el glúteo.'),
  ('a0000001-0000-0000-0000-000000000012', 'Elevación de talones', 'calves',     'https://www.youtube.com/watch?v=JbyjNymZOt4', 'youtube', 'Parado en máquina, elevá talones al máximo.')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 4. RUTINAS PARA LUCAS (Día 1, 2, 3)
--    Nota: member_id existe en la tabla routines aunque no esté en los types
-- =============================================================================

DO $$
DECLARE
  admin_id uuid;
  uid1 uuid := 'd0000001-0000-0000-0000-000000000001';
  r1 uuid := 'b0000001-0000-0000-0000-000000000001';
  r2 uuid := 'b0000001-0000-0000-0000-000000000002';
  r3 uuid := 'b0000001-0000-0000-0000-000000000003';
BEGIN
  SELECT id INTO admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;

  -- Día 1: Pecho/Tríceps
  INSERT INTO public.routines (id, name, description, is_template, created_by, member_id)
  VALUES (r1, 'Pecho y Tríceps', 'Rutina de empuje: pecho + tríceps', false, admin_id, uid1)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.routine_exercises (routine_id, exercise_id, order_index, sets, reps, weight_kg, rest_seconds)
  VALUES
    (r1, 'a0000001-0000-0000-0000-000000000001', 1, 4, 10, 40, 90),
    (r1, 'a0000001-0000-0000-0000-000000000002', 2, 3, 12, 16, 60),
    (r1, 'a0000001-0000-0000-0000-000000000003', 3, 3, 12, 12, 60),
    (r1, 'a0000001-0000-0000-0000-000000000004', 4, 3, 10,  0, 60)
  ON CONFLICT DO NOTHING;

  -- Día 2: Espalda/Bíceps
  INSERT INTO public.routines (id, name, description, is_template, created_by, member_id)
  VALUES (r2, 'Espalda y Bíceps', 'Rutina de tracción: espalda + bíceps', false, admin_id, uid1)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.routine_exercises (routine_id, exercise_id, order_index, sets, reps, weight_kg, rest_seconds)
  VALUES
    (r2, 'a0000001-0000-0000-0000-000000000005', 1, 4, 10, 45, 90),
    (r2, 'a0000001-0000-0000-0000-000000000006', 2, 4, 10, 50, 90),
    (r2, 'a0000001-0000-0000-0000-000000000007', 3, 3, 12, 20, 60),
    (r2, 'a0000001-0000-0000-0000-000000000008', 4, 3, 12, 10, 60)
  ON CONFLICT DO NOTHING;

  -- Día 3: Piernas
  INSERT INTO public.routines (id, name, description, is_template, created_by, member_id)
  VALUES (r3, 'Piernas', 'Rutina de piernas completa', false, admin_id, uid1)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.routine_exercises (routine_id, exercise_id, order_index, sets, reps, weight_kg, rest_seconds)
  VALUES
    (r3, 'a0000001-0000-0000-0000-000000000009', 1, 4,  8, 60, 120),
    (r3, 'a0000001-0000-0000-0000-000000000010', 2, 4, 10, 80,  90),
    (r3, 'a0000001-0000-0000-0000-000000000011', 3, 3, 12, 30,  60),
    (r3, 'a0000001-0000-0000-0000-000000000012', 4, 4, 15, 40,  60)
  ON CONFLICT DO NOTHING;
END $$;

-- =============================================================================
-- 5. SESIONES Y LOGS PARA LUCAS (3 sesiones del Día 1 con progreso real)
-- =============================================================================

DO $$
DECLARE
  uid1 uuid := 'd0000001-0000-0000-0000-000000000001';
  r1   uuid := 'b0000001-0000-0000-0000-000000000001';
  s1   uuid := 'c0000001-0000-0000-0000-000000000001';
  s2   uuid := 'c0000001-0000-0000-0000-000000000002';
  s3   uuid := 'c0000001-0000-0000-0000-000000000003';
BEGIN
  -- Sesión 1 (baseline) — hace 30 días, pesos más bajos
  INSERT INTO public.workout_sessions (id, profile_id, routine_id, session_date, duration_mins, notes)
  VALUES (s1, uid1, r1, now() - interval '30 days', 45, 'Primera sesión de pecho')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workout_logs (session_id, exercise_id, set_number, reps_done, weight_used_kg, is_baseline)
  VALUES
    (s1, 'a0000001-0000-0000-0000-000000000001', 1,  8, 30, true),
    (s1, 'a0000001-0000-0000-0000-000000000001', 2,  8, 30, true),
    (s1, 'a0000001-0000-0000-0000-000000000001', 3,  7, 30, true),
    (s1, 'a0000001-0000-0000-0000-000000000001', 4,  6, 30, true),
    (s1, 'a0000001-0000-0000-0000-000000000002', 1, 10, 12, true),
    (s1, 'a0000001-0000-0000-0000-000000000002', 2, 10, 12, true),
    (s1, 'a0000001-0000-0000-0000-000000000002', 3,  8, 12, true),
    (s1, 'a0000001-0000-0000-0000-000000000003', 1, 10,  8, true),
    (s1, 'a0000001-0000-0000-0000-000000000003', 2, 10,  8, true),
    (s1, 'a0000001-0000-0000-0000-000000000003', 3,  9,  8, true),
    (s1, 'a0000001-0000-0000-0000-000000000004', 1,  8,  0, true),
    (s1, 'a0000001-0000-0000-0000-000000000004', 2,  7,  0, true),
    (s1, 'a0000001-0000-0000-0000-000000000004', 3,  6,  0, true)
  ON CONFLICT DO NOTHING;

  -- Sesión 2 — hace 15 días, algo más de peso
  INSERT INTO public.workout_sessions (id, profile_id, routine_id, session_date, duration_mins, notes)
  VALUES (s2, uid1, r1, now() - interval '15 days', 48, 'Seguimos subiendo')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workout_logs (session_id, exercise_id, set_number, reps_done, weight_used_kg, is_baseline)
  VALUES
    (s2, 'a0000001-0000-0000-0000-000000000001', 1, 10, 35, false),
    (s2, 'a0000001-0000-0000-0000-000000000001', 2, 10, 35, false),
    (s2, 'a0000001-0000-0000-0000-000000000001', 3,  9, 35, false),
    (s2, 'a0000001-0000-0000-0000-000000000001', 4,  8, 35, false),
    (s2, 'a0000001-0000-0000-0000-000000000002', 1, 12, 14, false),
    (s2, 'a0000001-0000-0000-0000-000000000002', 2, 12, 14, false),
    (s2, 'a0000001-0000-0000-0000-000000000002', 3, 10, 14, false),
    (s2, 'a0000001-0000-0000-0000-000000000003', 1, 12, 10, false),
    (s2, 'a0000001-0000-0000-0000-000000000003', 2, 11, 10, false),
    (s2, 'a0000001-0000-0000-0000-000000000003', 3, 10, 10, false),
    (s2, 'a0000001-0000-0000-0000-000000000004', 1, 10,  0, false),
    (s2, 'a0000001-0000-0000-0000-000000000004', 2,  9,  0, false),
    (s2, 'a0000001-0000-0000-0000-000000000004', 3,  8,  0, false)
  ON CONFLICT DO NOTHING;

  -- Sesión 3 (current) — hace 5 días, mejor rendimiento
  INSERT INTO public.workout_sessions (id, profile_id, routine_id, session_date, duration_mins, notes)
  VALUES (s3, uid1, r1, now() - interval '5 days', 50, 'Mejor sesión hasta ahora')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workout_logs (session_id, exercise_id, set_number, reps_done, weight_used_kg, is_baseline)
  VALUES
    (s3, 'a0000001-0000-0000-0000-000000000001', 1, 12, 40, false),
    (s3, 'a0000001-0000-0000-0000-000000000001', 2, 11, 40, false),
    (s3, 'a0000001-0000-0000-0000-000000000001', 3, 10, 40, false),
    (s3, 'a0000001-0000-0000-0000-000000000001', 4, 10, 35, false),
    (s3, 'a0000001-0000-0000-0000-000000000002', 1, 12, 16, false),
    (s3, 'a0000001-0000-0000-0000-000000000002', 2, 12, 16, false),
    (s3, 'a0000001-0000-0000-0000-000000000002', 3, 12, 14, false),
    (s3, 'a0000001-0000-0000-0000-000000000003', 1, 12, 10, false),
    (s3, 'a0000001-0000-0000-0000-000000000003', 2, 12, 10, false),
    (s3, 'a0000001-0000-0000-0000-000000000003', 3, 12, 10, false),
    (s3, 'a0000001-0000-0000-0000-000000000004', 1, 12,  0, false),
    (s3, 'a0000001-0000-0000-0000-000000000004', 2, 11,  0, false),
    (s3, 'a0000001-0000-0000-0000-000000000004', 3, 10,  0, false)
  ON CONFLICT DO NOTHING;
END $$;

-- =============================================================================
-- 6. VERIFICACIÓN
-- =============================================================================

SELECT '✅ Usuarios demo creados (pass: Demo1234!)' AS resultado;
SELECT id, email FROM auth.users WHERE email LIKE '%@demo.com';

SELECT '✅ Membresías asignadas' AS resultado;
SELECT p.full_name, mp.name AS plan, m.status, m.end_date::date
FROM memberships m
JOIN profiles p ON p.id = m.profile_id
JOIN membership_plans mp ON mp.id = m.plan_id
WHERE m.profile_id IN (
  'd0000001-0000-0000-0000-000000000001',
  'd0000002-0000-0000-0000-000000000002',
  'd0000003-0000-0000-0000-000000000003'
);

SELECT '✅ Rutinas de Lucas creadas' AS resultado;
SELECT id, name FROM routines WHERE member_id = 'd0000001-0000-0000-0000-000000000001';

SELECT '✅ Sesiones de Lucas creadas' AS resultado;
SELECT id, session_date::date, notes FROM workout_sessions
WHERE profile_id = 'd0000001-0000-0000-0000-000000000001'
ORDER BY session_date;

SELECT '✅ Logs de Lucas — total de registros' AS resultado;
SELECT COUNT(*) AS total_logs FROM workout_logs
WHERE session_id IN (
  'c0000001-0000-0000-0000-000000000001',
  'c0000001-0000-0000-0000-000000000002',
  'c0000001-0000-0000-0000-000000000003'
);
