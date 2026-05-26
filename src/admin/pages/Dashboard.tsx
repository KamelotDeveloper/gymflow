import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import {
  Users,
  DollarSign,
  AlertTriangle,
  CalendarCheck,
  ChevronRight,
  MessageCircle,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

/* ── Types ── */

type KpiData = {
  activeMembers: number | null
  monthlyRevenue: number | null
  overdueAmount: number | null
  overdueCount: number | null
  attendanceToday: number | null
  attendancePct: number | null
}

type ExpiringMember = {
  profile_id: string
  full_name: string
  plan_name: string
  end_date: string
  days_left: number
}

type InactiveMember = {
  id: string
  full_name: string
  last_session: string | null
  phone: string | null
}

type ChartDayEntry = {
  dia: number
  dateStr: string
  Altas: number
  Bajas: number
}

/* ── Helpers ── */

const todayISO = (): string => new Date().toISOString().split('T')[0]

const formatCurrency = (amount: number): string =>
  '$' + amount.toLocaleString('es-AR')

const daysFromNow = (dateStr: string): number => {
  const now = new Date()
  const date = new Date(dateStr)
  return Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  )
}

const daysAgo = (n: number): Date => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

const daysSince = (dateStr: string): number =>
  Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
  )

const generateLast30Days = (): { dateStr: string; day: number }[] => {
  const days: { dateStr: string; day: number }[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().split('T')[0]
    days.push({ dateStr: iso, day: d.getDate() })
  }
  return days
}

const formatWhatsAppUrl = (phone: string, name: string): string => {
  const cleaned = phone.replace(/\D/g, '')
  const msg = encodeURIComponent(
    `¡Hola ${name}! Somos de GymFlow. Vimos que hace unos días no venís al gimnasio. Queremos saber si necesitás ayuda con algo o si querés retomar tu rutina. ¡Te esperamos!`,
  )
  return `https://wa.me/${cleaned}?text=${msg}`
}

const linkBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#DC2626',
  fontSize: 13,
  fontWeight: 600,
  padding: 0,
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
}

/* ═══════════════════════════ COMPONENT ═══════════════════════════ */

export default function Dashboard() {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  /* ── Section states ── */

  const [kpiData, setKpiData] = useState<KpiData>({
    activeMembers: null,
    monthlyRevenue: null,
    overdueAmount: null,
    overdueCount: null,
    attendanceToday: null,
    attendancePct: null,
  })
  const [kpiLoading, setKpiLoading] = useState(true)

  const [chartData, setChartData] = useState<ChartDayEntry[]>([])
  const [chartLoading, setChartLoading] = useState(true)
  const [chartSummary, setChartSummary] = useState({ altas: 0, bajas: 0, neto: 0 })

  const [expiring, setExpiring] = useState<ExpiringMember[]>([])
  const [expiringLoading, setExpiringLoading] = useState(true)

  const [inactive, setInactive] = useState<InactiveMember[]>([])
  const [inactiveLoading, setInactiveLoading] = useState(true)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  /* ── Data fetching ── */

  const fetchDashboardData = async () => {
    const todayStr = todayISO()
    const startOfMonth = daysAgo(0)
    startOfMonth.setDate(1)
    const sevenDays = daysAgo(-7)
    const thirtyDaysAgo = daysAgo(30)
    const sixtyDaysAgo = daysAgo(60)

    const results = await Promise.allSettled([
      /* 0 — Active members */
      (supabase
        .from('memberships') as any)
        .select('profile_id')
        .or('status.eq.active,admin_override.eq.true')
        .gte('end_date', todayStr),

      /* 1 — Monthly revenue (confirmed this month) */
      supabase
        .from('payment_transactions')
        .select('amount')
        .eq('status', 'confirmed')
        .gte('confirmed_at', startOfMonth.toISOString()),

      /* 2 — Overdue payments this month (morosidad activa) */
      supabase
        .from('payment_transactions')
        .select('id, amount')
        .eq('status', 'pending')
        .gte('created_at', startOfMonth.toISOString()),

      /* 3 — Sessions last 30 days (attendance today + avg) */
      supabase
        .from('workout_sessions')
        .select('profile_id, session_date')
        .gte('session_date', thirtyDaysAgo.toISOString()),

      /* 4 — New members last 30 days (Altas) */
      supabase
        .from('profiles')
        .select('created_at')
        .eq('role', 'member')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at'),

      /* 5 — Expired memberships last 30 days (Bajas) */
      supabase
        .from('memberships')
        .select('end_date')
        .eq('status', 'expired')
        .gte('end_date', thirtyDaysAgo.toISOString())
        .lte('end_date', todayStr),

      /* 6 — Expiring members next 7 days */
      (supabase
        .from('memberships') as any)
        .select(
          `profile_id,
           end_date,
           profile:profile_id(full_name),
           plan:plan_id(name)`,
        )
        .eq('status', 'active')
        .gte('end_date', todayStr)
        .lte('end_date', sevenDays.toISOString())
        .order('end_date')
        .limit(4),

      /* 7 — All member profiles (for inactivity) */
      supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'member'),

      /* 8 — Recent sessions (for inactivity) */
      supabase
        .from('workout_sessions')
        .select('profile_id, session_date')
        .gte('session_date', sixtyDaysAgo.toISOString())
        .order('session_date', { ascending: false }),
    ])

    const [
      activeResult,
      revenueResult,
      overdueResult,
      sessions30Result,
      newMembersResult,
      bajasResult,
      expiringResult,
      membersResult,
      sessions60Result,
    ] = results

    /* ── KPI ── */
    const kpi: KpiData = {
      activeMembers: null,
      monthlyRevenue: null,
      overdueAmount: null,
      overdueCount: null,
      attendanceToday: null,
      attendancePct: null,
    }

    if (activeResult.status === 'fulfilled') {
      const rows = (activeResult.value as any).data ?? []
      kpi.activeMembers = new Set(
        rows.map((r: any) => r.profile_id),
      ).size
    }

    if (revenueResult.status === 'fulfilled') {
      const rows = (revenueResult.value as any).data ?? []
      kpi.monthlyRevenue = rows.reduce(
        (s: number, r: any) => s + (r.amount ?? 0),
        0,
      )
    }

    if (overdueResult.status === 'fulfilled') {
      const rows = (overdueResult.value as any).data ?? []
      kpi.overdueCount = rows.length
      kpi.overdueAmount = rows.reduce(
        (s: number, r: any) => s + (r.amount ?? 0),
        0,
      )
    }

    /* ── Attendance (from 30-day sessions) ── */
    if (sessions30Result.status === 'fulfilled') {
      const rows = ((sessions30Result.value as any).data ??
        []) as { profile_id: string; session_date: string }[]

      const dailyAttendance: Record<string, Set<string>> = {}
      for (const s of rows) {
        if (!dailyAttendance[s.session_date]) {
          dailyAttendance[s.session_date] = new Set()
        }
        dailyAttendance[s.session_date].add(s.profile_id)
      }

      const todayMembers = dailyAttendance[todayStr]
      kpi.attendanceToday = todayMembers ? todayMembers.size : 0

      const daysWithData = Object.keys(dailyAttendance).length
      if (daysWithData > 0) {
        const totalCheckins = Object.values(dailyAttendance).reduce(
          (sum, set) => sum + set.size,
          0,
        )
        const avgDaily = totalCheckins / daysWithData
        kpi.attendancePct =
          avgDaily > 0
            ? Math.round((kpi.attendanceToday / avgDaily) * 100)
            : 0
      } else {
        kpi.attendancePct = 0
      }
    }
    setKpiData(kpi)
    setKpiLoading(false)

    /* ── Chart: Altas & Bajas ── */
    const allDays = generateLast30Days()

    const altaCounts: Record<string, number> = {}
    allDays.forEach((d) => (altaCounts[d.dateStr] = 0))
    if (newMembersResult.status === 'fulfilled') {
      const raw = ((newMembersResult.value as any).data ?? []) as {
        created_at: string
      }[]
      for (const entry of raw) {
        const key = entry.created_at?.split('T')[0]
        if (key && altaCounts[key] !== undefined) altaCounts[key]++
      }
    }

    const bajaCounts: Record<string, number> = {}
    allDays.forEach((d) => (bajaCounts[d.dateStr] = 0))
    if (bajasResult.status === 'fulfilled') {
      const raw = ((bajasResult.value as any).data ?? []) as {
        end_date: string
      }[]
      for (const entry of raw) {
        const key = entry.end_date?.split('T')[0]
        if (key && bajaCounts[key] !== undefined) bajaCounts[key]++
      }
    }

    const chart: ChartDayEntry[] = allDays.map((d) => ({
      dia: d.day,
      dateStr: d.dateStr,
      Altas: altaCounts[d.dateStr] ?? 0,
      Bajas: bajaCounts[d.dateStr] ?? 0,
    }))

    const totalAltas = chart.reduce((s, e) => s + e.Altas, 0)
    const totalBajas = chart.reduce((s, e) => s + e.Bajas, 0)
    setChartData(chart)
    setChartSummary({ altas: totalAltas, bajas: totalBajas, neto: totalAltas - totalBajas })
    setChartLoading(false)

    /* ── Expiring ── */
    if (expiringResult.status === 'fulfilled') {
      const rows = (expiringResult.value as any).data ?? []
      setExpiring(
        rows.map((r: any) => ({
          profile_id: r.profile_id,
          full_name: r.profile?.full_name ?? '-',
          plan_name: r.plan?.name ?? '-',
          end_date: r.end_date,
          days_left: daysFromNow(r.end_date),
        })),
      )
    }
    setExpiringLoading(false)

    /* ── Inactive ── */
    if (membersResult.status === 'fulfilled') {
      const allMembers = ((membersResult.value as any).data ??
        []) as { id: string; full_name: string; phone: string | null }[]

      const lastSessionMap = new Map<string, string>()
      if (sessions60Result.status === 'fulfilled') {
        const sessions = ((sessions60Result.value as any).data ??
          []) as { profile_id: string; session_date: string }[]
        for (const s of sessions) {
          if (!lastSessionMap.has(s.profile_id)) {
            lastSessionMap.set(s.profile_id, s.session_date)
          }
        }
      }

      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      const list: InactiveMember[] = []
      for (const m of allMembers) {
        const lastDate = lastSessionMap.get(m.id)
        if (!lastDate || new Date(lastDate) < cutoff) {
          list.push({
            id: m.id,
            full_name: m.full_name,
            last_session: lastDate ?? null,
            phone: m.phone,
          })
        }
      }
      setInactive(list)
    }
    setInactiveLoading(false)
  }

  /* ── Derived summary for chart ── */

  const chartHasData = useMemo(
    () => chartData.some((e) => e.Altas > 0 || e.Bajas > 0),
    [chartData],
  )

  /* ── Render ── */

  return (
    <AdminLayout pageTitle="Dashboard">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        {/* ═══ KPI Cards ═══ */}
        <section>
          <h2
            style={{
              margin: '0 0 14px',
              fontSize: 16,
              fontWeight: 700,
              color: '#111827',
            }}
          >
            Resumen
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 12,
            }}
          >
            {kpiLoading ? (
              <>
                <KpiSkeleton />
                <KpiSkeleton />
                <KpiSkeleton />
                <KpiSkeleton />
              </>
            ) : (
              <>
                <KpiCard
                  icon={<Users size={20} style={{ color: '#DC2626' }} />}
                  label="Miembros activos"
                  value={
                    kpiData.activeMembers !== null
                      ? String(kpiData.activeMembers)
                      : '-'
                  }
                  subtitle={null}
                  hasError={kpiData.activeMembers === null}
                />
                <KpiCard
                  icon={<DollarSign size={20} style={{ color: '#059669' }} />}
                  label="Ingresos del mes"
                  value={
                    kpiData.monthlyRevenue !== null
                      ? formatCurrency(kpiData.monthlyRevenue)
                      : '-'
                  }
                  subtitle={null}
                  hasError={kpiData.monthlyRevenue === null}
                />
                <KpiCard
                  icon={<AlertTriangle size={20} style={{ color: '#D97706' }} />}
                  label="Morosidad Activa"
                  value={
                    kpiData.overdueAmount !== null
                      ? formatCurrency(kpiData.overdueAmount)
                      : '-'
                  }
                  subtitle={
                    kpiData.overdueCount !== null
                      ? `${kpiData.overdueCount} pago${kpiData.overdueCount !== 1 ? 's' : ''} impago${kpiData.overdueCount !== 1 ? 's' : ''} este mes`
                      : null
                  }
                  hasError={kpiData.overdueAmount === null}
                />
                <KpiCard
                  icon={<CalendarCheck size={20} style={{ color: '#7C3AED' }} />}
                  label="Ocupación de Hoy"
                  value={
                    kpiData.attendanceToday !== null
                      ? `${kpiData.attendanceToday} alumno${kpiData.attendanceToday !== 1 ? 's' : ''}`
                      : '-'
                  }
                  subtitle={
                    kpiData.attendanceToday !== null && kpiData.attendancePct !== null
                      ? kpiData.attendanceToday > 0
                        ? `${kpiData.attendancePct}% del promedio diario`
                        : 'Sin actividad hoy'
                      : null
                  }
                  hasError={kpiData.attendanceToday === null}
                />
              </>
            )}
          </div>
        </section>

        {/* ═══ Balance de Miembros (LineChart) ═══ */}
        <section>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: '#111827',
              }}
            >
              Balance de Miembros
            </h2>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {chartSummary.neto >= 0 ? '+' : ''}
              {chartSummary.neto} neto · {chartSummary.altas} altas ·{' '}
              {chartSummary.bajas} bajas
            </span>
          </div>
          {chartLoading ? (
            <ChartSkeleton />
          ) : chartHasData ? (
            <div style={cardStyle}>
              <div style={{ padding: '20px 4px 4px' }}>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 4, right: 12, left: -8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="dia"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickLine={false}
                      minTickGap={20}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        fontSize: 13,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      }}
                      labelFormatter={(label: any) =>
                        label !== undefined ? `Día ${label}` : ''
                      }
                      formatter={(value: any, _name: any) => [
                        value,
                        _name === 'Altas' ? 'Nuevos' : 'Bajas',
                      ]}
                    />
                    <Legend
                      formatter={(value: string) => (
                        <span style={{ color: '#6b7280', fontSize: 13 }}>
                          {value === 'Altas' ? 'Altas' : 'Bajas'}
                        </span>
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="Altas"
                      stroke="#059669"
                      strokeWidth={2}
                      dot={{ r: 2, fill: '#059669' }}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Bajas"
                      stroke="#DC2626"
                      strokeWidth={2}
                      dot={{ r: 2, fill: '#DC2626' }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <EmptyCard message="Sin registros de altas o bajas en los últimos 30 días" />
          )}
        </section>

        {/* ═══ Next to Expire ═══ */}
        <section>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: '#111827',
              }}
            >
              Próximos a Vencer
            </h2>
            {expiring.length > 0 && (
              <button
                onClick={() => navigate('/admin/members')}
                style={linkBtnStyle}
              >
                Ver más
                <ChevronRight size={14} />
              </button>
            )}
          </div>
          {expiringLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: 12,
              }}
            >
              <ExpiringSkeleton />
              <ExpiringSkeleton />
              <ExpiringSkeleton />
            </div>
          ) : expiring.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: 12,
              }}
            >
              {expiring.map((m) => (
                <div
                  key={m.profile_id}
                  onClick={() => navigate('/admin/members')}
                  style={expiringCardStyle}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: '#111',
                      marginBottom: 4,
                    }}
                  >
                    {m.full_name}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: '#6b7280',
                      marginBottom: 6,
                    }}
                  >
                    {m.plan_name}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: m.days_left <= 1 ? '#DC2626' : '#D97706',
                    }}
                  >
                    {m.days_left === 0
                      ? 'Vence hoy'
                      : m.days_left === 1
                        ? 'Vence mañana'
                        : `${m.days_left} días`}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyCard message="No hay membresías próximas a vencer" />
          )}
        </section>

        {/* ═══ Inactive Members ═══ */}
        <section>
          <h2
            style={{
              margin: '0 0 14px',
              fontSize: 16,
              fontWeight: 700,
              color: '#111827',
            }}
          >
            Miembros Inactivos
          </h2>
          {inactiveLoading ? (
            <div style={cardStyle}>
              <InactiveSkeleton />
              <InactiveSkeleton />
              <InactiveSkeleton />
            </div>
          ) : inactive.length > 0 ? (
            <div style={cardStyle}>
              {inactive.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr auto' : '1fr auto auto',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom:
                      i < inactive.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}
                >
                  {/* Name */}
                  <span
                    style={{
                      fontSize: 14,
                      color: '#111',
                      fontWeight: 500,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.full_name}
                  </span>

                  {/* Days absent */}
                  <span
                    style={{
                      fontSize: 13,
                      color: m.last_session ? '#DC2626' : '#9ca3af',
                      fontStyle: m.last_session ? 'normal' : 'italic',
                      textAlign: 'right',
                    }}
                  >
                    {m.last_session
                      ? `${daysSince(m.last_session)} días`
                      : 'Nunca'}
                  </span>

                  {/* WhatsApp action */}
                  {m.phone ? (
                    <a
                      href={formatWhatsAppUrl(m.phone, m.full_name.split(' ')[0])}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Contactar por WhatsApp"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: '#f0fdf4',
                        color: '#16a34a',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        transition: 'background-color 0.15s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.backgroundColor =
                          '#dcfce7'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.backgroundColor =
                          '#f0fdf4'
                      }}
                    >
                      <MessageCircle size={16} />
                    </a>
                  ) : (
                    <span
                      title="Sin teléfono registrado"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: '#f9fafb',
                        color: '#d1d5db',
                        flexShrink: 0,
                      }}
                    >
                      <MessageCircle size={16} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyCard message="No hay miembros inactivos" />
          )}
        </section>
      </div>
    </AdminLayout>
  )
}

/* ════════════════════════ KPI Components ════════════════════════ */

function KpiCard({
  icon,
  label,
  value,
  subtitle,
  hasError,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtitle: string | null
  hasError: boolean
}) {
  return (
    <div style={kpiCardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: '#f9fafb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#6b7280',
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 24,
            color: hasError ? '#9ca3af' : '#111',
          }}
        >
          {value}
        </span>
        {hasError && (
          <span
            title="Error al cargar"
            style={{
              fontSize: 11,
              color: '#DC2626',
              fontWeight: 600,
            }}
          >
            error
          </span>
        )}
        {subtitle && (
          <span
            style={{
              fontSize: 12,
              color: '#9ca3af',
              fontWeight: 400,
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div style={kpiCardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div
          className="animate-pulse"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: '#e5e7eb',
          }}
        />
        <div
          className="animate-pulse"
          style={{
            height: 14,
            width: 100,
            backgroundColor: '#e5e7eb',
            borderRadius: 4,
          }}
        />
      </div>
      <div
        className="animate-pulse"
        style={{
          height: 24,
          width: 80,
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
        }}
      />
    </div>
  )
}

/* ════════════════════════ Chart Components ════════════════════════ */

function ChartSkeleton() {
  return (
    <div style={cardStyle}>
      <div
        className="animate-pulse"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          height: 200,
          padding: '20px 24px',
        }}
      >
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${20 + (i % 10) * 8}%`,
              backgroundColor: '#e5e7eb',
              borderRadius: '2px 2px 0 0',
            }}
          />
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════ Expiring Components ════════════════════════ */

const expiringCardStyle: React.CSSProperties = {
  flex: 1,
  backgroundColor: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 16,
  cursor: 'pointer',
  transition: 'box-shadow 0.15s',
}

function ExpiringSkeleton() {
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div
        className="animate-pulse"
        style={{
          height: 14,
          width: '70%',
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
          marginBottom: 8,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          height: 14,
          width: '50%',
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
          marginBottom: 8,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          height: 14,
          width: '30%',
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
        }}
      />
    </div>
  )
}

/* ════════════════════════ Inactive Components ════════════════════════ */

function InactiveSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 12,
        padding: '12px 16px',
      }}
    >
      <div
        className="animate-pulse"
        style={{
          height: 14,
          width: '40%',
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          height: 14,
          width: 50,
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: '#e5e7eb',
        }}
      />
    </div>
  )
}

/* ════════════════════════ Shared Components ════════════════════════ */

function EmptyCard({ message }: { message: string }) {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        textAlign: 'center',
        padding: '32px 16px',
        color: '#6b7280',
        fontSize: 14,
      }}
    >
      {message}
    </div>
  )
}

/* ════════════════════════ Styles ════════════════════════ */

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 16,
}
