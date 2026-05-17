import { useEffect, useState } from 'react'
import { useAuthContext } from '../../shared/components/AuthContext'
import { supabase } from '../../shared/lib/supabase'
import UserLayout from '../../shared/components/UserLayout'
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react'

/* ── Types ── */

type Routine = {
  id: string
  name: string
  day_number: number
}

type RoutineExercise = {
  id: string
  sets: number
  reps: number
  weight_kg: number
  order_index: number
  exercise: {
    id: string
    name: string
    muscle_group: string
  }
}

type ExerciseInput = {
  exercise_id: string
  routine_exercise_id: string
  sets: string
  reps: string
  weight_kg: string
}

/* ── Component ── */

export default function UserRutina() {
  const { profile, user } = useAuthContext()
  console.log('🧑 profile:', profile)
  console.log('🔐 user:', user)

  const [view, setView] = useState<'list' | 'exercise'>('list')
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null)
  const [exercises, setExercises] = useState<RoutineExercise[]>([])
  const [inputs, setInputs] = useState<ExerciseInput[]>([])
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState(false)

  useEffect(() => {
    if (!profile?.id) return
    fetchRoutines()
  }, [profile?.id])

  const fetchRoutines = async () => {
    console.log('🔍 fetchRoutines — profile?.id:', profile?.id)
    if (!profile?.id) return
    setLoading(true)
    try {
      const { data, error } = await (supabase as any)
        .from('routines')
        .select(`
          id,
          name,
          day_number,
          member_id,
          routine_exercises(id)
        `)
        .eq('member_id', profile.id)
        .order('day_number', { ascending: true })

      console.log('📦 rutinas fetch — data:', data, 'error:', error)
      setRoutines(data ?? [])
    } catch {
      console.error('Error al cargar rutinas')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDay = async (routine: Routine) => {
    console.log('📌 handleSelectDay — routine.id:', routine.id, 'routine.name:', routine.name)
    setSelectedRoutine(routine)
    setLoading(true)
    try {
      const { data, error } = await (supabase as any)
        .from('routine_exercises')
        .select(`
          id,
          sets,
          reps,
          weight_kg,
          rest_seconds,
          order_index,
          exercise:exercises(id, name, muscle_group, video_url, video_type)
        `)
        .eq('routine_id', routine.id)
        .order('order_index', { ascending: true })

      console.log('🏋️ ejercicios fetch — routineId:', routine.id, 'data:', data, 'error:', error)

      const exs: RoutineExercise[] = data ?? []
      setExercises(exs)
      setInputs(
        exs.map((ex) => ({
          exercise_id: ex.exercise.id,
          routine_exercise_id: ex.id,
          sets: '',
          reps: '',
          weight_kg: '',
        })),
      )
      setView('exercise')
    } catch {
      console.error('Error al cargar ejercicios')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setView('list')
    setSelectedRoutine(null)
    setExercises([])
    setInputs([])
    setSuccessMsg(false)
  }

  const updateInput = (
    routineExerciseId: string,
    field: 'sets' | 'reps' | 'weight_kg',
    value: string,
  ) => {
    setInputs((prev) =>
      prev.map((i) =>
        i.routine_exercise_id === routineExerciseId ? { ...i, [field]: value } : i,
      ),
    )
  }

  const hasAnyInput = inputs.some(
    (i) => i.sets !== '' || i.reps !== '' || i.weight_kg !== '',
  )

  const handleSave = async () => {
    if (!selectedRoutine || !profile?.id || !hasAnyInput) return
    setSaving(true)
    try {
      const pid = profile.id
      const todayISO = new Date().toISOString().split('T')[0]

      // 1. Create workout_session
      const { data: session } = await (supabase as any)
        .from('workout_sessions')
        .insert({
          profile_id: pid,
          routine_id: selectedRoutine.id,
          session_date: todayISO,
          duration_mins: null,
        })
        .select()
        .single()

      if (!session) throw new Error('No se pudo crear la sesión')

      // 2. For each exercise with data, insert workout_log
      for (const input of inputs) {
        const setsNum = parseInt(input.sets, 10)
        const repsNum = parseInt(input.reps, 10)
        const weightNum = parseFloat(input.weight_kg)

        if (isNaN(setsNum) && isNaN(repsNum) && isNaN(weightNum)) continue

        // Check if baseline exists for this exercise + profile
        const { data: existingBaseline } = await (supabase as any)
          .from('workout_logs')
          .select('id')
          .eq('exercise_id', input.exercise_id)
          .eq('is_baseline', true)
          .in('session_id', (
            await (supabase as any)
              .from('workout_sessions')
              .select('id')
              .eq('profile_id', pid)
          ).data?.map((s: any) => s.id) ?? [])
          .limit(1)

        const isBaseline = !existingBaseline || existingBaseline.length === 0

        await (supabase as any).from('workout_logs').insert({
          session_id: session.id,
          exercise_id: input.exercise_id,
          set_number: isNaN(setsNum) ? 1 : setsNum,
          reps_done: isNaN(repsNum) ? 0 : repsNum,
          weight_used_kg: isNaN(weightNum) ? 0 : weightNum,
          is_baseline: isBaseline,
        })
      }

      // 3. Success feedback
      setSuccessMsg(true)
      setTimeout(() => {
        handleBack()
        fetchRoutines()
      }, 2000)
    } catch (err) {
      console.error('Error al guardar entrenamiento:', err)
      alert('Error al guardar el entrenamiento.')
    } finally {
      setSaving(false)
    }
  }

  /* ── Render ── */

  return (
    <UserLayout>
      <div className="px-4 py-6 max-w-lg mx-auto">
        {view === 'list' ? (
          <DaySelector
            routines={routines}
            loading={loading}
            onSelect={handleSelectDay}
          />
        ) : (
          <ExerciseView
            routine={selectedRoutine!}
            exercises={exercises}
            inputs={inputs}
            saving={saving}
            successMsg={successMsg}
            onBack={handleBack}
            onUpdateInput={updateInput}
            onSave={handleSave}
          />
        )}
      </div>
    </UserLayout>
  )
}

/* ── View 1: Day Selector ── */

function DaySelector({
  routines,
  loading,
  onSelect,
}: {
  routines: Routine[]
  loading: boolean
  onSelect: (routine: Routine) => void
}) {
  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
      Mi Rutina
      </h1>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : routines.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">
            El profe todavía no cargó tu rutina.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {routines.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-left hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                Día {r.day_number}
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {r.name}
              </p>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

/* ── View 2: Exercise Input ── */

function ExerciseView({
  routine,
  exercises,
  inputs,
  saving,
  successMsg,
  onBack,
  onUpdateInput,
  onSave,
}: {
  routine: Routine
  exercises: RoutineExercise[]
  inputs: ExerciseInput[]
  saving: boolean
  successMsg: boolean
  onBack: () => void
  onUpdateInput: (id: string, field: 'sets' | 'reps' | 'weight_kg', value: string) => void
  onSave: () => void
}) {
  const hasAnyInput = inputs.some(
    (i) => i.sets !== '' || i.reps !== '' || i.weight_kg !== '',
  )

  return (
    <>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft size={18} />
        Rutinas
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {routine.name}
      </h1>

      {successMsg ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle size={48} className="text-green-500" />
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            ✓ Entrenamiento guardado
          </p>
        </div>
      ) : (
        <>
          {/* Exercise cards */}
          <div className="space-y-4 pb-24">
            {exercises.map((ex) => {
              const inp = inputs.find(
                (i) => i.routine_exercise_id === ex.id,
              ) ?? { sets: '', reps: '', weight_kg: '' }

              return (
                <div
                  key={ex.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                      {ex.exercise.name}
                    </h3>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {ex.exercise.muscle_group}
                    </span>
                  </div>

                  {/* Reference row (read-only) */}
                  <div className="mx-4 mb-2 rounded-lg bg-gray-100 dark:bg-gray-900/50 p-3">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-2">
                      Profe:
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          Series
                        </p>
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                          {ex.sets}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          Reps
                        </p>
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                          {ex.reps}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          Peso kg
                        </p>
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                          {ex.weight_kg}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Input row */}
                  <div className="px-4 pb-4">
                    <p className="text-[10px] text-[#DC2626] uppercase font-semibold mb-2">
                      Hice:
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        min={0}
                        placeholder="—"
                        value={inp.sets}
                        onChange={(e) =>
                          onUpdateInput(ex.id, 'sets', e.target.value)
                        }
                        className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-center text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] transition-colors"
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder="—"
                        value={inp.reps}
                        onChange={(e) =>
                          onUpdateInput(ex.id, 'reps', e.target.value)
                        }
                        className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-center text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] transition-colors"
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        placeholder="—"
                        value={inp.weight_kg}
                        onChange={(e) =>
                          onUpdateInput(ex.id, 'weight_kg', e.target.value)
                        }
                        className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-center text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Fixed bottom save button */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white dark:from-[#0a0a0a] via-white/95 dark:via-[#0a0a0a]/95 to-transparent">
            <div className="max-w-lg mx-auto">
              <button
                onClick={onSave}
                disabled={!hasAnyInput || saving}
                className="w-full h-12 rounded-xl bg-[#111] dark:bg-[#DC2626] text-white font-semibold text-sm hover:bg-[#DC2626] dark:hover:bg-[#b71c1c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar entrenamiento'
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
