import { useEffect, useState } from 'react'
import { useAuthContext } from '../../shared/components/AuthContext'
import { supabase } from '../../shared/lib/supabase'
import UserLayout from '../../shared/components/UserLayout'
import { Loader2 } from 'lucide-react'

type SetDatum = {
  set: number
  reps: number
  weight_kg: number | null
}

type ProgressItem = {
  exercise_name: string
  muscle_group: string
  baseline_reps: number
  baseline_weight: number
  current_reps: number
  current_weight: number
  delta_reps: number
  delta_weight_kg: number
}

/* ── Types for "Por día" tab ── */

type DayProgress = {
  day_number: number
  routine_name: string
  routine_id: string
  exercises: ExerciseProgress[]
}

type ExerciseProgress = {
  exercise_id: string
  exercise_name: string
  muscle_group: string
  sets: SetProgress[]
}

type SetProgress = {
  set_number: number
  baseline: { reps: number | null; weight: number | null } | null
  current: { reps: number | null; weight: number | null } | null
  delta_reps: number | null
  delta_weight_kg: number | null
}

/** Calculate relative week number from session dates */
function calcWeekNumber(sessions: { session_date: string }[]): number {
  if (sessions.length === 0) return 1
  const dates = sessions.map((s) => new Date(s.session_date)).sort((a, b) => a.getTime() - b.getTime())
  const first = dates[0]
  const latest = dates[dates.length - 1]
  const diffMs = latest.getTime() - first.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}

export default function Progreso() {
  const { profile } = useAuthContext()

  const [tab, setTab] = useState<'ejercicio' | 'dia'>('ejercicio')
  const [progressData, setProgressData] = useState<ProgressItem[]>([])
  const [dayData, setDayData] = useState<DayProgress[]>([])
  const [currentWeek, setCurrentWeek] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    fetchData()
  }, [profile?.id])

  const fetchData = async () => {
    setLoading(true)
    try {
      const pid = profile!.id

      // Progress comparison
      const { data: prog } = await (supabase as any)
        .from('progress_comparison')
        .select('*')
        .eq('profile_id', pid)
        .order('exercise_name', { ascending: true })
      setProgressData(prog ?? [])

      // Day-organized data + week number
      await fetchDayData(pid)
    } catch {
      // data not available yet
    } finally {
      setLoading(false)
    }
  }

  const fetchDayData = async (pid: string) => {
    try {
      // 1. Fetch routines for this member (same as Rutina.tsx)
      const { data: routines } = await (supabase as any)
        .from('routines')
        .select(`
          id, name, day_number, member_id,
          routine_exercises(
            id, sets, sets_data, order_index,
            exercise:exercises(id, name, muscle_group)
          )
        `)
        .eq('member_id', pid)
        .order('day_number', { ascending: true })

      if (!routines || routines.length === 0) {
        setDayData([])
        return
      }

      // 2. Fetch sessions for week calculation + progress data
      const { data: sessions } = await (supabase as any)
        .from('workout_sessions')
        .select('id, session_date, routine_id')
        .eq('profile_id', pid)
        .order('session_date', { ascending: true })

      const weekNum = calcWeekNumber(sessions ?? [])
      setCurrentWeek(weekNum)

      // 3. Fetch all progress comparison data for this user
      const { data: progressRows } = await (supabase as any)
        .from('progress_comparison')
        .select('*')
        .eq('profile_id', pid)

      // 4. Build lookup: exercise_id + set_number → progress row
      const progressMap: Record<string, any> = {}
      for (const row of progressRows ?? []) {
        progressMap[`${row.exercise_id}-${row.set_number}`] = row
      }

      // 5. Build DayProgress array from routines (not assignments)
      const days: DayProgress[] = []
      for (const r of routines) {
        const exercises: ExerciseProgress[] = []

        for (const re of (r.routine_exercises ?? []).sort(
          (a: any, b: any) => a.order_index - b.order_index,
        )) {
          // Determine set numbers to show
          const setsData: SetDatum[] = re.sets_data as SetDatum[] | null ?? []
          let setNumbers: number[]

          if (setsData.length > 0) {
            setNumbers = setsData.map((sd) => sd.set)
          } else {
            // Legacy: find distinct set_numbers from progress data
            const distinctSets = new Set<number>()
            for (const row of progressRows ?? []) {
              if (row.exercise_id === re.exercise.id && row.set_number != null) {
                distinctSets.add(row.set_number)
              }
            }
            setNumbers = distinctSets.size > 0 ? [...distinctSets].sort() : [1]
          }

          const setProgress: SetProgress[] = setNumbers.map((sn) => {
            const pRow = progressMap[`${re.exercise.id}-${sn}`]
            return {
              set_number: sn,
              baseline: pRow
                ? { reps: pRow.baseline_reps ?? null, weight: pRow.baseline_weight ?? null }
                : null,
              current: pRow
                ? { reps: pRow.current_reps ?? null, weight: pRow.current_weight ?? null }
                : null,
              delta_reps: pRow?.delta_reps ?? null,
              delta_weight_kg: pRow?.delta_weight_kg ?? null,
            }
          })

          exercises.push({
            exercise_id: re.exercise.id,
            exercise_name: re.exercise.name,
            muscle_group: re.exercise.muscle_group,
            sets: setProgress,
          })
        }

        days.push({
          day_number: r.day_number ?? 0,
          routine_name: r.name,
          routine_id: r.id,
          exercises,
        })
      }

      days.sort((a, b) => a.day_number - b.day_number)
      setDayData(days)
    } catch {
      setDayData([])
    }
  }

  return (
    <UserLayout>
      <div className="px-4 py-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Mi Progreso
        </h1>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setTab('ejercicio')}
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${
              tab === 'ejercicio'
                ? 'border-b-2 border-[#DC2626] text-[#DC2626]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Por ejercicio
          </button>
          <button
            onClick={() => setTab('dia')}
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${
              tab === 'dia'
                ? 'border-b-2 border-[#DC2626] text-[#DC2626]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Por día
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : tab === 'ejercicio' ? (
          <TabEjercicio data={progressData} />
        ) : (
          <TabPorDia data={dayData} week={currentWeek} />
        )}
      </div>
    </UserLayout>
  )
}

function TabEjercicio({ data }: { data: ProgressItem[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 dark:text-gray-400">
          Todavía no hay datos de progreso.
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
          Registrá tu primer entrenamiento para empezar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map((item, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                {item.exercise_name}
              </h3>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {item.muscle_group}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold mb-1">
                  Baseline
                </p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {item.baseline_weight != null || item.baseline_reps != null
                    ? `${item.baseline_weight != null ? `${item.baseline_weight}kg` : '—'} × ${item.baseline_reps != null ? item.baseline_reps : '—'}`
                    : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold mb-1">
                  Actual
                </p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {item.current_weight != null || item.current_reps != null
                    ? `${item.current_weight != null ? `${item.current_weight}kg` : '—'} × ${item.current_reps != null ? item.current_reps : '—'}`
                    : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold mb-1">
                  Progreso
                </p>
                <p
                  className={`text-sm font-bold ${
                    item.delta_weight_kg > 0
                      ? 'text-green-600 dark:text-green-400'
                      : item.delta_weight_kg < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {item.delta_weight_kg > 0
                    ? `+${item.delta_weight_kg}kg ↑`
                    : item.delta_weight_kg < 0
                    ? `${item.delta_weight_kg}kg ↓`
                    : item.delta_weight_kg === 0
                    ? '= igual'
                    : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold mb-1">
                  Último peso
                </p>
                <p className="text-lg font-bold text-[#DC2626]">
                  {item.current_weight != null ? `${item.current_weight} kg` : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Tab: Por día ── */

function TabPorDia({ data, week }: { data: DayProgress[]; week: number }) {
  const [selectedDay, setSelectedDay] = useState<DayProgress | null>(null)

  // Reset selection when data changes
  useEffect(() => {
    setSelectedDay(null)
  }, [data])

  if (data.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 dark:text-gray-400">
          No tenés rutinas cargadas.
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
          El profe todavía no cargó tu rutina.
        </p>
      </div>
    )
  }

  // Selected day view
  if (selectedDay) {
    return (
      <div>
        {/* Back button */}
        <button
          onClick={() => setSelectedDay(null)}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Días
        </button>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {selectedDay.routine_name}
          </h2>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            Semana {week}
          </span>
        </div>

        <div className="space-y-4">
          {selectedDay.exercises.map((ex) => (
            <div
              key={ex.exercise_id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                    {ex.exercise_name}
                  </h3>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {ex.muscle_group}
                  </span>
                </div>

                {/* Per-set comparison rows */}
                <div className="space-y-2">
                  {ex.sets.map((s) => (
                    <div
                      key={s.set_number}
                      className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3"
                    >
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1.5">
                        Serie {s.set_number}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div>
                          <p className="text-gray-400 dark:text-gray-500 mb-0.5">Baseline</p>
                          <p className="font-bold text-gray-700 dark:text-gray-300">
                            {s.baseline?.weight != null || s.baseline?.reps != null
                              ? `${s.baseline.weight != null ? `${s.baseline.weight}kg` : '—'} × ${s.baseline.reps != null ? s.baseline.reps : '—'}`
                              : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 dark:text-gray-500 mb-0.5">Actual</p>
                          <p className="font-bold text-gray-700 dark:text-gray-300">
                            {s.current?.weight != null || s.current?.reps != null
                              ? `${s.current.weight != null ? `${s.current.weight}kg` : '—'} × ${s.current.reps != null ? s.current.reps : '—'}`
                              : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 dark:text-gray-500 mb-0.5">Δ</p>
                          <p
                            className={`font-bold ${
                              s.delta_weight_kg != null && s.delta_weight_kg > 0
                                ? 'text-green-600 dark:text-green-400'
                                : s.delta_weight_kg != null && s.delta_weight_kg < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {s.delta_weight_kg != null
                              ? s.delta_weight_kg > 0
                                ? `+${s.delta_weight_kg}kg`
                                : s.delta_weight_kg === 0
                                ? '='
                                : `${s.delta_weight_kg}kg`
                              : s.delta_reps != null
                              ? s.delta_reps > 0
                                ? `+${s.delta_reps} reps`
                                : `${s.delta_reps} reps`
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Day selector grid
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Seleccioná un día para ver tu progreso.
        </p>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          Semana {week}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {data.map((day) => (
          <button
            key={day.routine_id}
            onClick={() => setSelectedDay(day)}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-left hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
              Día {day.day_number}
            </p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {day.routine_name}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {day.exercises.length} ejercicio{day.exercises.length !== 1 ? 's' : ''}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
