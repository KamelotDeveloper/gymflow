import { useEffect, useState, useRef } from 'react'
import { useAuthContext } from '../../shared/components/AuthContext'
import { supabase } from '../../shared/lib/supabase'
import UserLayout from '../../shared/components/UserLayout'
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react'

function calcCurrentWeek(sessions: { session_date: string }[]): number {
  if (sessions.length === 0) return 1
  const dates = sessions.map((s) => new Date(s.session_date)).sort((a, b) => a.getTime() - b.getTime())
  const diffMs = dates[dates.length - 1].getTime() - dates[0].getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}

/* ── Types ── */

type SetDatum = {
  set: number
  reps: number
  weight_kg: number | null
}

type PerSetField = {
  set_number: number
  reps_done: string
  weight_used_kg: string
}

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
  sets_data: SetDatum[] | null
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
  const [perSetInputs, setPerSetInputs] = useState<Record<string, PerSetField[]>>({})
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(1)

  // Refs to always have latest state in handleSave (avoid stale closure)
  const perSetInputsRef = useRef(perSetInputs)
  perSetInputsRef.current = perSetInputs
  const inputsRef = useRef(inputs)
  inputsRef.current = inputs
  const exercisesRef = useRef(exercises)
  exercisesRef.current = exercises

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
          sets_data,
          rest_seconds,
          order_index,
          exercise:exercises(id, name, muscle_group, video_url, video_type)
        `)
        .eq('routine_id', routine.id)
        .order('order_index', { ascending: true })

      console.log('🏋️ ejercicios fetch — routineId:', routine.id, 'data:', data, 'error:', error)

      const exs: RoutineExercise[] = (data ?? []).map((ex: any) => ({
        ...ex,
        sets_data: ex.sets_data as SetDatum[] | null,
      }))
      setExercises(exs)

      // Split into single-field vs per-set inputs
      const singleInputs: ExerciseInput[] = []
      const psInputs: Record<string, PerSetField[]> = {}
      for (const ex of exs) {
        if (ex.sets_data && ex.sets_data.length > 0) {
          psInputs[ex.id] = ex.sets_data.map((sd) => ({
            set_number: sd.set,
            reps_done: '',
            weight_used_kg: '',
          }))
        } else {
          singleInputs.push({
            exercise_id: ex.exercise.id,
            routine_exercise_id: ex.id,
            sets: '',
            reps: '',
            weight_kg: '',
          })
        }
      }
      setInputs(singleInputs)
      setPerSetInputs(psInputs)

      // Calculate current week
      const { data: sessions } = await (supabase as any)
        .from('workout_sessions')
        .select('session_date')
        .eq('profile_id', profile!.id)
        .order('session_date', { ascending: true })
      setCurrentWeek(calcCurrentWeek(sessions ?? []))

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
    setPerSetInputs({})
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

  const updatePerSetField = (
    routineExerciseId: string,
    setIndex: number,
    field: 'reps_done' | 'weight_used_kg',
    value: string,
  ) => {
    setPerSetInputs((prev) => {
      const sets = [...(prev[routineExerciseId] ?? [])]
      if (sets[setIndex]) {
        sets[setIndex] = { ...sets[setIndex], [field]: value }
      }
      return { ...prev, [routineExerciseId]: sets }
    })
  }

  const hasAnyInput = inputs.some(
    (i) => i.sets !== '' || i.reps !== '' || i.weight_kg !== '',
  )
  const hasAnyPerSetInput = Object.values(perSetInputs).some((sets) =>
    sets.some((s) => s.reps_done !== '' || s.weight_used_kg !== ''),
  )

  const handleSave = async () => {
    if (!selectedRoutine || !profile?.id || (!hasAnyInput && !hasAnyPerSetInput)) return
    setSaving(true)
    try {
      const pid = profile.id
      const todayISO = new Date().toISOString().split('T')[0]

      // 1. Create workout_session
      console.log('📝 Creando sesión...', { pid, routine_id: selectedRoutine.id })
      const { data: session, error: sessionErr } = await (supabase as any)
        .from('workout_sessions')
        .insert({
          profile_id: pid,
          routine_id: selectedRoutine.id,
          session_date: todayISO,
          duration_mins: null,
        })
        .select()
        .single()

      if (sessionErr) {
        console.error('❌ Error al crear sesión:', sessionErr)
        throw new Error(`Error al crear sesión: ${sessionErr.message}`)
      }
      if (!session) throw new Error('No se pudo crear la sesión')
      console.log('✅ Sesión creada:', session.id)

      // Get all session IDs for this profile (for baseline check)
      const { data: allSessions } = await (supabase as any)
        .from('workout_sessions')
        .select('id')
        .eq('profile_id', pid)
      const allSessionIds: string[] = allSessions?.map((s: any) => s.id) ?? []

      // 2. DEBUG: check what perSetInputs looks like (using refs for latest state)
      const currentPerSetInputs = perSetInputsRef.current
      const currentExercises = exercisesRef.current
      const currentInputs = inputsRef.current
      console.log('🔍 perSetInputs (ref) antes del loop:', JSON.stringify(currentPerSetInputs))
      console.log('🔍 exercises (ref):', currentExercises.map(e => ({ id: e.id, name: e.exercise.name })))
      
      // 2. For each exercise, insert workout_log rows
      for (const ex of currentExercises) {
        const perSet = currentPerSetInputs[ex.id]
        console.log('🔍 ex.id:', ex.id, 'perSet:', perSet, 'perSet?.length:', perSet?.length)

        if (perSet && perSet.length > 0) {
          // ── Per-set mode: insert N rows ──
          for (const ps of perSet) {
            const repsNum = parseInt(ps.reps_done, 10)
            const weightNum = parseFloat(ps.weight_used_kg)

            if (isNaN(repsNum) && isNaN(weightNum)) {
              console.log('⏭️ set skipped (no data):', { ex: ex.exercise.id, set: ps.set_number, reps_done: ps.reps_done, weight_used_kg: ps.weight_used_kg })
              continue
            }
            console.log('📝 insertando log:', { exercise_id: ex.exercise.id, set_number: ps.set_number, reps_done: repsNum, weight_used_kg: weightNum })

            // Per-set baseline detection: check (exercise_id, set_number) pair
            const { data: existingBaseline } = await (supabase as any)
              .from('workout_logs')
              .select('id')
              .eq('exercise_id', ex.exercise.id)
              .eq('set_number', ps.set_number)
              .eq('is_baseline', true)
              .limit(1)

            const isBaseline = !existingBaseline || existingBaseline.length === 0

            const { error: logErr } = await (supabase as any).from('workout_logs').insert({
              session_id: session.id,
              exercise_id: ex.exercise.id,
              set_number: ps.set_number,
              reps_done: isNaN(repsNum) ? 0 : repsNum,
              weight_used_kg: isNaN(weightNum) ? 0 : weightNum,
              is_baseline: isBaseline,
            })
            if (logErr) console.error('❌ Error insert log:', logErr, { ex: ex.exercise.id, set: ps.set_number })
          }
        } else {
          // ── Single-field mode: insert 1 row (legacy) ──
          const input = currentInputs.find((i) => i.routine_exercise_id === ex.id)
          if (!input) continue

          const setsNum = parseInt(input.sets, 10)
          const repsNum = parseInt(input.reps, 10)
          const weightNum = parseFloat(input.weight_kg)

          if (isNaN(setsNum) && isNaN(repsNum) && isNaN(weightNum)) continue

          // Per-exercise baseline detection (original behavior)
          const { data: existingBaseline } = await (supabase as any)
            .from('workout_logs')
            .select('id')
            .eq('exercise_id', input.exercise_id)
            .eq('is_baseline', true)
            .in('session_id', allSessionIds)
            .limit(1)

          const isBaseline = !existingBaseline || existingBaseline.length === 0

          const { error: logErr } = await (supabase as any).from('workout_logs').insert({
            session_id: session.id,
            exercise_id: input.exercise_id,
            set_number: isNaN(setsNum) ? 1 : setsNum,
            reps_done: isNaN(repsNum) ? 0 : repsNum,
            weight_used_kg: isNaN(weightNum) ? 0 : weightNum,
            is_baseline: isBaseline,
          })
          if (logErr) console.error('❌ Error insert log legacy:', logErr, { ex: input.exercise_id })
        }
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
            perSetInputs={perSetInputs}
            saving={saving}
            successMsg={successMsg}
            currentWeek={currentWeek}
            onBack={handleBack}
            onUpdateInput={updateInput}
            onUpdatePerSetField={updatePerSetField}
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
  perSetInputs,
  saving,
  successMsg,
  currentWeek,
  onBack,
  onUpdateInput,
  onUpdatePerSetField,
  onSave,
}: {
  routine: Routine
  exercises: RoutineExercise[]
  inputs: ExerciseInput[]
  perSetInputs: Record<string, PerSetField[]>
  saving: boolean
  successMsg: boolean
  currentWeek: number
  onBack: () => void
  onUpdateInput: (id: string, field: 'sets' | 'reps' | 'weight_kg', value: string) => void
  onUpdatePerSetField: (id: string, setIndex: number, field: 'reps_done' | 'weight_used_kg', value: string) => void
  onSave: () => void
}) {
  const hasAnyInput = inputs.some(
    (i) => i.sets !== '' || i.reps !== '' || i.weight_kg !== '',
  )
  const hasAnyPerSetInput = Object.values(perSetInputs).some((sets) =>
    sets.some((s) => s.reps_done !== '' || s.weight_used_kg !== ''),
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

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {routine.name}
        </h1>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          Semana {currentWeek}
        </span>
      </div>

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
                    {ex.sets_data && ex.sets_data.length > 0 ? (
                      <div className="space-y-1">
                        {ex.sets_data.map((sd) => (
                          <div key={sd.set} className="flex justify-between text-sm">
                            <span className="text-gray-500">Serie {sd.set}</span>
                            <span className="font-bold text-gray-700 dark:text-gray-300">
                              {sd.reps} reps{sd.weight_kg != null ? ` × ${sd.weight_kg} kg` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
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
                    )}
                  </div>

                  {/* Input rows — per-set or single-field */}
                  <div className="px-4 pb-4">
                    <p className="text-[10px] text-[#DC2626] uppercase font-semibold mb-2">
                      Hice:
                    </p>
                    {ex.sets_data && ex.sets_data.length > 0 ? (
                      <div className="space-y-2">
                        {ex.sets_data.map((sd, idx) => {
                          const psFields = (perSetInputs[ex.id] ?? [])[idx] ?? {
                            set_number: sd.set,
                            reps_done: '',
                            weight_used_kg: '',
                          }
                          return (
                            <div key={sd.set} className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-500 w-14 shrink-0">
                                Serie {sd.set}
                              </span>
                              <input
                                type="number"
                                min={0}
                                placeholder="—"
                                value={psFields.reps_done}
                                onChange={(e) =>
                                  onUpdatePerSetField(ex.id, idx, 'reps_done', e.target.value)
                                }
                                className="flex-1 h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-center text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] transition-colors"
                              />
                              <span className="text-gray-400 text-sm">×</span>
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                placeholder="—"
                                value={psFields.weight_used_kg}
                                onChange={(e) =>
                                  onUpdatePerSetField(ex.id, idx, 'weight_used_kg', e.target.value)
                                }
                                className="w-20 h-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-center text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] transition-colors"
                              />
                              <span className="text-xs text-gray-400">kg</span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
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
                    )}
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
                disabled={(!hasAnyInput && !hasAnyPerSetInput) || saving}
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
