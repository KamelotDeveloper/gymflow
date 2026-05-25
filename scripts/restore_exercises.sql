-- Restore exercises that were accidentally deleted
-- Using Elias Admin as created_by

DO $$
DECLARE
  admin_id uuid := '2a51baa0-71ba-410e-9f30-cb79ae72c5af';
BEGIN

INSERT INTO public.exercises (id, name, muscle_group, video_url, video_type, instructions, created_by)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Press de banca',               'chest',   'https://www.youtube.com/watch?v=rT7DgCr-3pg',  'youtube', 'Acostado en banco plano, barra a la altura del pecho, presioná hacia arriba.', admin_id),
  ('a0000001-0000-0000-0000-000000000002', 'Press inclinado con mancuernas','chest',  'https://www.youtube.com/watch?v=8iPEnn-lGjY', 'youtube', 'Banco a 45°, mancuernas desde el pecho hacia arriba.', admin_id),
  ('a0000001-0000-0000-0000-000000000003', 'Aperturas con mancuernas',      'chest',  'https://www.youtube.com/watch?v=eozdVc78Qls', 'youtube', 'Acostado en banco plano, brazos extendidos, abrí y cerrá con control.', admin_id),
  ('a0000001-0000-0000-0000-000000000004', 'Fondos en paralelas',           'triceps','https://www.youtube.com/watch?v=2z8gY1E4GbA', 'youtube', 'Cuerpo recto, bajá hasta 90° y volvé.', admin_id),
  ('a0000001-0000-0000-0000-000000000005', 'Jalón al pecho',      'back',   'https://www.youtube.com/watch?v=lueEJGjTu5Y', 'youtube', 'Agarré ancho, llevá la barra al pecho, volvé controlado.', admin_id),
  ('a0000001-0000-0000-0000-000000000006', 'Remo con barra',      'back',   'https://www.youtube.com/watch?v=G8l_8chR5xg', 'youtube', 'Inclinado, barra hacia el abdomen, apretá la espalda.', admin_id),
  ('a0000001-0000-0000-0000-000000000007', 'Curl con barra',      'biceps', 'https://www.youtube.com/watch?v=kwG2ipFRgfo', 'youtube', 'Parado, barra desde los muslos al pecho, solo antebrazos se mueven.', admin_id),
  ('a0000001-0000-0000-0000-000000000008', 'Curl martillo',       'biceps', 'https://www.youtube.com/watch?v=zC3nLlEvin4', 'youtube', 'Mancuernas con agarre neutro, curl alternado.', admin_id),
  ('a0000001-0000-0000-0000-000000000009', 'Sentadilla con barra', 'quads',      'https://www.youtube.com/watch?v=gcNh17CkjD4', 'youtube', 'Barra en trampa, espalda recta, bajá hasta paralela.', admin_id),
  ('a0000001-0000-0000-0000-000000000010', 'Prensa de piernas',    'quads',      'https://www.youtube.com/watch?v=xySgR8p5ixk', 'youtube', 'Pies en plataforma, empujá sin bloquear rodillas.', admin_id),
  ('a0000001-0000-0000-0000-000000000011', 'Curl femoral',         'hamstrings', 'https://www.youtube.com/watch?v=ELq0E1m1mX8', 'youtube', 'Acostado en máquina, llevá los talones hacia el glúteo.', admin_id),
  ('a0000001-0000-0000-0000-000000000012', 'Elevación de talones', 'calves',     'https://www.youtube.com/watch?v=JbyjNymZOt4', 'youtube', 'Parado en máquina, elevá talones al máximo.', admin_id)
ON CONFLICT (id) DO NOTHING;

END $$;

-- Verify
SELECT '✅ Ejercicios restaurados' as paso, COUNT(*) as total FROM exercises;
