import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../../shared/components/AuthContext'
import { supabase } from '../../shared/lib/supabase'
import UserLayout, { formatDateSpanish } from '../../shared/components/UserLayout'
import { Loader2 } from 'lucide-react'
import GymConsistencyChart from '../components/GymConsistencyChart'
import GymStrengthEvolution, { type ExerciseStrength } from '../components/GymStrengthEvolution'
import GymMuscleBalance, { aggregateByGroup } from '../components/GymMuscleBalance'

type Membership = {
  id: string
  start_date: string
  end_date: string
  status: string
  admin_override: boolean
  plan_name: string
}

type WeeklyDataPoint = {
  week: string
  sessions: number
  volume: number
}

export default function Home() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()

  const [membership, setMembership] = useState<Membership | null>(null)
  const [membershipLoading, setMembershipLoading] = useState(true)

  const [news, setNews] = useState<any[]>([])
  const [sessionsThisMonth, setSessionsThisMonth] = useState(0)
  const [bestProgress, setBestProgress] = useState<string | null>(null)
  const [nextRoutineDay, setNextRoutineDay] = useState<string | null>(null)
  const [streakWeeks, setStreakWeeks] = useState(0)
  const [weeklyData, setWeeklyData] = useState<WeeklyDataPoint[]>([])
  const [strengthData, setStrengthData] = useState<ExerciseStrength[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('')
  const [muscleData, setMuscleData] = useState<{ muscle_group: string; volume: number }[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  const today = new Date()

  useEffect(() => {
    if (!profile?.id) return
    fetchMembership()
    fetchNews()
    fetchStats()
  }, [profile?.id])

  const fetchMembership = async () => {
    setMembershipLoading(true)
    try {
      const { data: memb } = await (supabase as any)
        .from('memberships')
        .select('id, start_date, end_date, status, admin_override, plan:membership_plans(name)')
        .eq('profile_id', profile!.id)
        .order('end_date', { ascending: false })
        .limit(1)
        .single()

      if (memb) {
        setMembership({
          id: memb.id,
          start_date: memb.start_date,
          end_date: memb.end_date,
          status: memb.status,
          admin_override: memb.admin_override,
          plan_name: memb.plan?.name ?? 'Sin plan',
        })
      }
    } catch {
      // no membership yet
    } finally {
      setMembershipLoading(false)
    }
  }

  const fetchNews = async () => {
    try {
      const { data } = await (supabase as any)
        .from('gym_news')
        .select('id, title, tag, tag_color, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5)
      if (data) setNews(data)
    } catch {
      // not available
    }
  }

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const pid = profile!.id

      // Entrenamientos este mes (días distintos)
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
      const { data: monthSessions } = await (supabase as any)
        .from('workout_sessions')
        .select('session_date')
        .eq('profile_id', pid)
        .gte('session_date', firstOfMonth)
      const distinctMonthDays = new Set((monthSessions ?? []).map((s: any) => s.session_date))
      setSessionsThisMonth(distinctMonthDays.size)

      // Mejor progreso desde view progress_comparison
      const { data: progressData } = await (supabase as any)
        .from('progress_comparison')
        .select('exercise_name, delta_weight_kg')
        .eq('profile_id', pid)
        .order('delta_weight_kg', { ascending: false })
        .limit(1)
      if (progressData && progressData.length > 0 && progressData[0].delta_weight_kg > 0) {
        setBestProgress(progressData[0].exercise_name)
      }

      const getMonday = (d: Date) => {
        const m = new Date(d)
        const day = m.getDay()
        m.setDate(m.getDate() - day + (day === 0 ? -6 : 1))
        m.setHours(0, 0, 0, 0)
        return m
      }

      // Próxima rutina: siguiente día después de la última sesión
      const { data: routines } = await (supabase as any)
        .from('routines')
        .select('id, name, day_number')
        .eq('member_id', pid)
        .order('day_number', { ascending: true })

      if (routines && routines.length > 0) {
        const { data: lastSession } = await (supabase as any)
          .from('workout_sessions')
          .select('routine_id')
          .eq('profile_id', pid)
          .order('session_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastSession) {
          const lastIdx = routines.findIndex((r: any) => r.id === lastSession.routine_id)
          if (lastIdx >= 0 && lastIdx < routines.length - 1) {
            setNextRoutineDay(routines[lastIdx + 1].name)
          } else {
            setNextRoutineDay(routines[0].name)
          }
        } else {
          setNextRoutineDay(routines[0].name)
        }
      }

      // Racha: semanas consecutivas con al menos 1 sesión
      const { data: sessions } = await (supabase as any)
        .from('workout_sessions')
        .select('session_date')
        .eq('profile_id', pid)
        .order('session_date', { ascending: false })

      if (sessions && sessions.length > 0) {
        const weeks = new Set<number>()
        for (const s of sessions) {
          const d = new Date(s.session_date)
          // Get ISO week number
          const startOfYear = new Date(d.getFullYear(), 0, 1)
          const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
          weeks.add(weekNum)
        }
        // Count consecutive weeks from current week backwards
        const currentWeekNum = Math.ceil(((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(today.getFullYear(), 0, 1).getDay() + 1) / 7)
        let streak = 0
        for (let w = currentWeekNum; w >= currentWeekNum - 52; w--) {
          if (weeks.has(w)) streak++
          else break
        }
        setStreakWeeks(streak)
      }

      // ── Weekly chart data (4 semanas) ──
      const fourWeeksAgo = new Date(today)
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
      const startISO = fourWeeksAgo.toISOString().split('T')[0]

      // Generate last 4 Monday-start weeks
      const thisMonday = getMonday(today)
      const weekStarts: Date[] = []
      for (let i = 3; i >= 0; i--) {
        const w = new Date(thisMonday)
        w.setDate(thisMonday.getDate() - i * 7)
        weekStarts.push(w)
      }

      const weekData: { week: string; sessions: number; volume: number }[] = weekStarts.map((_, i) => ({
        week: `${4 - i}`,
        sessions: 0,
        volume: 0,
      }))

      // Count distinct training DAYS per week
      if (sessions) {
        const seenDays = new Set<string>()
        for (const s of sessions) {
          const sd = new Date(s.session_date + 'T00:00:00')
          for (let i = 0; i < weekStarts.length; i++) {
            const start = weekStarts[i].getTime()
            const end = start + 7 * 86400000
            if (sd.getTime() >= start && sd.getTime() < end) {
              const dayKey = s.session_date
              if (!seenDays.has(dayKey)) {
                seenDays.add(dayKey)
                weekData[i].sessions++
              }
              break
            }
          }
        }
      }

      // Fetch volume (weight_kg × reps per session)
      const { data: volumeSessions } = await (supabase as any)
        .from('workout_sessions')
        .select('id, session_date, workout_logs(weight_kg, reps)')
        .eq('profile_id', pid)
        .gte('session_date', startISO)

      if (volumeSessions) {
        for (const s of volumeSessions) {
          const sd = new Date(s.session_date + 'T00:00:00')
          for (let i = 0; i < weekStarts.length; i++) {
            const start = weekStarts[i].getTime()
            const end = start + 7 * 86400000
            if (sd.getTime() >= start && sd.getTime() < end) {
              const vol = (s.workout_logs || []).reduce(
                (sum: number, log: any) => sum + (Number(log.weight_kg) || 0) * (Number(log.reps) || 0),
                0
              )
              weekData[i].volume += vol
              break
            }
          }
        }
      }

      // Reverse so week 1 (current) appears LEFT
      setWeeklyData([...weekData].reverse())

      // ── Strength evolution (max weight per exercise per week) ──
      const { data: strengthRows } = await (supabase as any)
        .from('workout_logs')
        .select(`
          weight_kg,
          session:workout_sessions!inner(session_date, profile_id),
          exercise:exercises!inner(id, name)
        `)
        .eq('session.profile_id', pid)
        .gte('session.session_date', startISO)

      if (strengthRows && strengthRows.length > 0) {
        const exMap = new Map<string, { name: string; weeks: Map<number, number> }>()
        for (const row of strengthRows) {
          const exId = row.exercise.id
          const exName = row.exercise.name
          const w = Number(row.weight_kg) || 0
          const sd = new Date(row.session.session_date + 'T00:00:00')

          // Find which week bucket
          for (let i = 0; i < weekStarts.length; i++) {
            const start = weekStarts[i].getTime()
            const end = start + 7 * 86400000
            if (sd.getTime() >= start && sd.getTime() < end) {
              if (!exMap.has(exId)) {
                exMap.set(exId, { name: exName, weeks: new Map() })
              }
              const entry = exMap.get(exId)!
              const prev = entry.weeks.get(i) ?? 0
              if (w > prev) entry.weeks.set(i, w)
              break
            }
          }
        }

        const exercises: ExerciseStrength[] = []
        for (const [exId, { name, weeks }] of exMap) {
          // Create data points for all 4 weeks
          const data = weekData.map((_, i) => ({
            week: `${4 - i}`,
            max_weight: weeks.get(3 - i) ?? 0,
          })).reverse()
          exercises.push({ exercise_id: exId, exercise_name: name, data })
        }

        setStrengthData(exercises)
        if (exercises.length > 0 && !selectedExerciseId) {
          setSelectedExerciseId(exercises[0].exercise_id)
        }
      }

      // ── Muscle balance (volume per muscle group) ──
      const { data: muscleRows } = await (supabase as any)
        .from('workout_logs')
        .select(`
          weight_kg,
          reps,
          exercise:exercises!inner(muscle_group),
          session:workout_sessions!inner(profile_id, session_date)
        `)
        .eq('session.profile_id', pid)
        .gte('session.session_date', startISO)

      if (muscleRows && muscleRows.length > 0) {
        const groupMap = new Map<string, number>()
        for (const row of muscleRows) {
          const mg = row.exercise.muscle_group
          const vol = (Number(row.weight_kg) || 0) * (Number(row.reps) || 0)
          groupMap.set(mg, (groupMap.get(mg) ?? 0) + vol)
        }
        setMuscleData(
          Array.from(groupMap.entries()).map(([muscle_group, volume]) => ({ muscle_group, volume }))
        )
      }
    } catch {
      // stats not available
    } finally {
      setStatsLoading(false)
    }
  }

  const getMembershipStatus = () => {
    if (!membership) return null
    const endDate = new Date(membership.end_date)
    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / 86400000)

    if (membership.status === 'expired' && !membership.admin_override) {
      return { type: 'expired', label: 'Vencida', daysLeft }
    }
    if (daysLeft <= 7) {
      return { type: 'soon', label: `Por vencer · ${daysLeft} día${daysLeft === 1 ? '' : 's'}`, daysLeft }
    }
    return { type: 'active', label: 'Activa', daysLeft }
  }

  const memStatus = getMembershipStatus()

  return (
    <UserLayout>
      <div className="px-4 py-6 max-w-lg mx-auto">
        {/* ── Greeting ── */}
        <section className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Hola, {profile?.full_name?.split(' ')[0] ?? 'miembro'} 👋
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {formatDateSpanish(today)}
          </p>
        </section>

        {/* ── Membership Card ── */}
        <section className="mb-6">
          {membershipLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : !membership ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">No tenés membresía activa.</p>
            </div>
          ) : (
            <div
              className={`rounded-xl border p-5 cursor-pointer transition-colors ${
                memStatus?.type === 'active'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : memStatus?.type === 'soon'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}
              onClick={() => navigate('/user/membresia')}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${
                      memStatus?.type === 'active'
                        ? 'bg-green-500'
                        : memStatus?.type === 'soon'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Membresía
                  </span>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    memStatus?.type === 'active'
                      ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                      : memStatus?.type === 'soon'
                      ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                      : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                  }`}
                >
                  {memStatus?.label}
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {membership.plan_name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Vence el {new Date(membership.end_date).toLocaleDateString('es-AR')}
              </p>
              {memStatus?.type === 'expired' && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2 font-medium">
                  Contactá al gimnasio para renovar.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Novedades del gym ── */}
        <NewsFeed news={news} />

        {/* ── Mini Progreso Dashboard ── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Tu progreso
          </h2>
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Entrenamientos este mes"
                value={sessionsThisMonth > 0 ? `${sessionsThisMonth}` : '—'}
                onClick={() => navigate('/user/progreso')}
              />
              <StatCard
                label="Mejor progreso"
                value={bestProgress ?? '—'}
                onClick={() => navigate('/user/progreso')}
              />
              <StatCard
                label="Próxima rutina"
                value={nextRoutineDay ?? '—'}
                onClick={() => navigate('/user/rutina')}
              />
              <StatCard
                label="Racha (semanas)"
                value={streakWeeks > 0 ? `${streakWeeks}` : '—'}
                onClick={() => navigate('/user/progreso')}
              />
            </div>
          )}
        </section>

        {/* ── Charts ── */}
        {!statsLoading && weeklyData.length > 0 && (
          <section className="mt-6 space-y-4">
            <GymConsistencyChart
              data={weeklyData.map((d) => ({ week: d.week, sessions: d.sessions }))}
              monthlyCompliance={weeklyData.reduce((s, d) => s + d.sessions, 0)}
              goalDays={7}
            />
            {strengthData.length > 0 && (
              <GymStrengthEvolution
                exercises={strengthData}
                selectedExerciseId={selectedExerciseId}
                onSelectExercise={setSelectedExerciseId}
              />
            )}
            <GymMuscleBalance data={aggregateByGroup(muscleData)} />
          </section>
        )}
      </div>
    </UserLayout>
  )
}

const TAG_BG: Record<string, string> = {
  red: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  green: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
}

function NewsFeed({ news }: { news: any[] }) {
  if (news.length === 0) return null

  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Novedades
      </h2>
      <div className="space-y-3">
        {news.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
          >
            <span
              className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded mb-2 ${
                TAG_BG[item.tag_color] ?? TAG_BG.red
              }`}
            >
              {item.tag}
            </span>
            <p className="text-sm text-gray-900 dark:text-white font-medium">
              {item.title}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {new Date(item.created_at).toLocaleDateString('es-AR')}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
    >
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 leading-tight">
        {label}
      </p>
      <p className="text-xl font-bold text-gray-900 dark:text-white truncate">
        {value}
      </p>
    </button>
  )
}
