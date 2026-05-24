-- Migration: workout_logs INSERT policy
-- Description: Add INSERT policy so members can log workout data
-- Members can only insert logs tied to their own workout sessions

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workout_logs'
    AND cmd = 'INSERT'
  ) THEN
    CREATE POLICY "Members can insert own workout logs"
      ON workout_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (
        session_id IN (
          SELECT id FROM workout_sessions WHERE profile_id = auth.uid()
        )
      );
  END IF;
END $$;
