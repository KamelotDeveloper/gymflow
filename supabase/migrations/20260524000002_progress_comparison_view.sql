-- Migration: Add set_number to progress_comparison view
-- Description: The original view grouped by exercise_id only, which broke
-- after we added per-set (sets_data) mode where one exercise has multiple
-- workout_log rows (one per set). Now we group by (exercise_id, set_number).

CREATE OR REPLACE VIEW progress_comparison AS
WITH baseline AS (
  SELECT DISTINCT ON (wl.exercise_id, COALESCE(wl.set_number, 0))
    wl.exercise_id,
    wl.set_number,
    wl.reps_done,
    wl.weight_used_kg,
    ws.profile_id,
    ws.session_date
  FROM workout_logs wl
  JOIN workout_sessions ws ON ws.id = wl.session_id
  WHERE wl.is_baseline = true
  ORDER BY wl.exercise_id, COALESCE(wl.set_number, 0), ws.created_at ASC
),
current_data AS (
  SELECT DISTINCT ON (wl.exercise_id, COALESCE(wl.set_number, 0))
    wl.exercise_id,
    wl.set_number,
    wl.reps_done,
    wl.weight_used_kg,
    ws.profile_id,
    ws.session_date
  FROM workout_logs wl
  JOIN workout_sessions ws ON ws.id = wl.session_id
  WHERE wl.is_baseline = false
  ORDER BY wl.exercise_id, COALESCE(wl.set_number, 0), ws.created_at DESC
)
SELECT
  COALESCE(b.profile_id, c.profile_id) AS profile_id,
  COALESCE(b.exercise_id, c.exercise_id) AS exercise_id,
  e.name AS exercise_name,
  e.muscle_group,
  COALESCE(b.set_number, c.set_number) AS set_number,
  b.reps_done AS baseline_reps,
  b.weight_used_kg AS baseline_weight,
  b.session_date AS baseline_date,
  c.reps_done AS current_reps,
  c.weight_used_kg AS current_weight,
  c.session_date AS current_date,
  GREATEST(
    COALESCE(b.session_date, '-infinity'::timestamptz),
    COALESCE(c.session_date, '-infinity'::timestamptz)
  ) AS last_session_date,
  (c.reps_done - b.reps_done) AS delta_reps,
  (c.weight_used_kg - b.weight_used_kg) AS delta_weight_kg
FROM baseline b
FULL OUTER JOIN current_data c
  ON c.exercise_id = b.exercise_id
  AND COALESCE(c.set_number, 0) = COALESCE(b.set_number, 0)
JOIN exercises e ON e.id = COALESCE(b.exercise_id, c.exercise_id);
