import { useEffect, useState } from 'react'
import { useAuthContext } from '../../shared/components/AuthContext'
import { supabase } from '../../shared/lib/supabase'
import UserLayout from '../../shared/components/UserLayout'
import { Loader2 } from 'lucide-react'

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

type WorkoutSession = {
  id: string
  session_date: string
  routine_name: string
  exercise_count: number
}

export default function Progreso() {
  const { profile } = useAuthContext()

  const [tab, setTab] = useState<'ejercicio' | 'historial'>('ejercicio')
  const [progressData, setProgressData] = useState<ProgressItem[]>([])
  const [history, setHistory] = useState<WorkoutSession[]>([])
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

      // History
      const { data: sess } = await (supabase as any)
        .from('workout_sessions')
        .select(`
          id,
          session_date,
          routine:routines(name),
          logs:workout_logs(count)
        `)
        .eq('profile_id', pid)
        .order('session_date', { ascending: false })
        .limit(50)

      if (sess) {
        setHistory(
          sess.map((s: any) => ({
            id: s.id,
            session_date: s.session_date,
            routine_name: s.routine?.name ?? 'Rutina',
            exercise_count: s.logs?.[0]?.count ?? 0,
          })),
        )
      }
    } catch {
      // data not available yet
    } finally {
      setLoading(false)
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
            onClick={() => setTab('historial')}
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${
              tab === 'historial'
                ? 'border-b-2 border-[#DC2626] text-[#DC2626]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Historial
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : tab === 'ejercicio' ? (
          <TabEjercicio data={progressData} />
        ) : (
          <TabHistorial data={history} />
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

function TabHistorial({ data }: { data: WorkoutSession[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 dark:text-gray-400">
          No hay entrenamientos registrados todavía.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((s) => (
        <div
          key={s.id}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {s.routine_name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {new Date(s.session_date).toLocaleDateString('es-AR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {s.exercise_count} ejercicio{s.exercise_count !== 1 ? 's' : ''}
          </span>
        </div>
      ))}
    </div>
  )
}
