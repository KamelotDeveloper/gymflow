import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import {
  Users,
  DollarSign,
  Clock,
  Dumbbell,
  ChevronRight,
} from 'lucide-react'

/* ── Types ── */

type KpiData = {
  activeMembers: number | null
  monthlyRevenue: number | null
  pendingCount: number | null
  pendingAmount: number | null
  workoutsToday: number | null
  activeMembersToday: number | null
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
  Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))

/* ── Constants ── */

const CHART_W = 800
const CHART_H = 200
const PAD_LEFT = 36
const PAD_TOP = 8
const PAD_BOTTOM = 22
const PAD_RIGHT = 8
const INNER_W = CHART_W - PAD_LEFT - PAD_RIGHT
const INNER_H = CHART_H - PAD_TOP - PAD_BOTTOM

/* ── Component ── */

export default function Dashboard() {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  /* ── Section states ── */

  const [kpiData, setKpiData] = useState<KpiData>({
    activeMembers: null,
    monthlyRevenue: null,
    pendingCount: null,
    pendingAmount: null,
    workoutsToday: null,
    activeMembersToday: null,
  })
  const [kpiLoading, setKpiLoading] = useState(true)

  const [chartDayCounts, setChartDayCounts] = useState<
    Record<string, number>
  >({})
  const [chartLoading, setChartLoading] = useState(true)

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

      /* 1 — Monthly revenue */
      supabase
        .from('payment_transactions')
        .select('amount')
        .eq('status', 'confirmed')
        .gte('confirmed_at', startOfMonth.toISOString()),

      /* 2 — Pending payments */
      supabase
        .from('payment_transactions')
        .select('id, amount')
        .eq('status', 'pending'),

      /* 3 — Workouts today */
      supabase
        .from('workout_sessions')
        .select('id, profile_id')
        .eq('session_date', todayStr),

      /* 4 — New members last 30 days */
      supabase
        .from('profiles')
        .select('created_at')
        .eq('role', 'member')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at'),

      /* 5 — Expiring members next 7 days */
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

      /* 6 — All member profiles (for inactivity) */
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'member'),

      /* 7 — Recent sessions (for inactivity) */
      supabase
        .from('workout_sessions')
        .select('profile_id, session_date')
        .gte('session_date', sixtyDaysAgo.toISOString())
        .order('session_date', { ascending: false }),
    ])

    const [
      activeResult,
      revenueResult,
      pendingResult,
      workoutsResult,
      newMembersResult,
      expiringResult,
      membersResult,
      sessionsResult,
    ] = results

    /* ── KPI ── */
    const kpi: KpiData = {
      activeMembers: null,
      monthlyRevenue: null,
      pendingCount: null,
      pendingAmount: null,
      workoutsToday: null,
      activeMembersToday: null,
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
    if (pendingResult.status === 'fulfilled') {
      const rows = (pendingResult.value as any).data ?? []
      kpi.pendingCount = rows.length
      kpi.pendingAmount = rows.reduce(
        (s: number, r: any) => s + (r.amount ?? 0),
        0,
      )
    }
    if (workoutsResult.status === 'fulfilled') {
      const rows = (workoutsResult.value as any).data ?? []
      kpi.workoutsToday = rows.length
      kpi.activeMembersToday = new Set(
        rows.map((r: any) => r.profile_id),
      ).size
    }
    setKpiData(kpi)
    setKpiLoading(false)

    /* ── Chart ── */
    if (newMembersResult.status === 'fulfilled') {
      const raw = ((newMembersResult.value as any).data ?? []) as {
        created_at: string
      }[]
      const counts: Record<string, number> = {}
      const today = new Date()
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        counts[d.toISOString().split('T')[0]] = 0
      }
      for (const entry of raw) {
        const key = entry.created_at?.split('T')[0]
        if (key && counts[key] !== undefined) counts[key]++
      }
      setChartDayCounts(counts)
    }
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
        []) as { id: string; full_name: string }[]

      const lastSessionMap = new Map<string, string>()
      if (sessionsResult.status === 'fulfilled') {
        const sessions = ((sessionsResult.value as any).data ??
          []) as { profile_id: string; session_date: string }[]
        for (const s of sessions) {
          if (!lastSessionMap.has(s.profile_id)) {
            lastSessionMap.set(s.profile_id, s.session_date)
          }
        }
      }

      const cutoff = new Date(
        Date.now() - 14 * 24 * 60 * 60 * 1000,
      )
      const list: InactiveMember[] = []
      for (const m of allMembers) {
        const lastDate = lastSessionMap.get(m.id)
        if (!lastDate || new Date(lastDate) < cutoff) {
          list.push({
            id: m.id,
            full_name: m.full_name,
            last_session: lastDate ?? null,
          })
        }
      }
      setInactive(list)
    }
    setInactiveLoading(false)
  }

  /* ── Derived chart data ── */

  const chartSummary = useMemo(() => {
    const entries = Object.entries(chartDayCounts)
    const total30 = entries.reduce((s, [, c]) => s + c, 0)
    const last7 = entries
      .slice(-7)
      .reduce((s, [, c]) => s + c, 0)
    return { last7, total30 }
  }, [chartDayCounts])

  const chartHasData = useMemo(
    () => Object.values(chartDayCounts).some((v) => v > 0),
    [chartDayCounts],
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
              gridTemplateColumns: isMobile
                ? '1fr'
                : '1fr 1fr',
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
                  icon={
                    <Users
                      size={20}
                      style={{ color: '#DC2626' }}
                    />
                  }
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
                  icon={
                    <DollarSign
                      size={20}
                      style={{ color: '#059669' }}
                    />
                  }
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
                  icon={
                    <Clock
                      size={20}
                      style={{ color: '#D97706' }}
                    />
                  }
                  label="Pagos pendientes"
                  value={
                    kpiData.pendingCount !== null
                      ? `${kpiData.pendingCount} · ${formatCurrency(kpiData.pendingAmount ?? 0)}`
                      : '-'
                  }
                  subtitle={null}
                  hasError={kpiData.pendingCount === null}
                />
                <KpiCard
                  icon={
                    <Dumbbell
                      size={20}
                      style={{ color: '#7C3AED' }}
                    />
                  }
                  label="Entrenos hoy"
                  value={
                    kpiData.workoutsToday !== null
                      ? `${kpiData.workoutsToday} sesiones`
                      : '-'
                  }
                  subtitle={
                    kpiData.activeMembersToday !== null
                      ? `${kpiData.activeMembersToday} miembros`
                      : null
                  }
                  hasError={kpiData.workoutsToday === null}
                />
              </>
            )}
          </div>
        </section>

        {/* ═══ New Members Chart ═══ */}
        <section>
          <h2
            style={{
              margin: '0 0 14px',
              fontSize: 16,
              fontWeight: 700,
              color: '#111827',
            }}
          >
            Nuevos Miembros
          </h2>
          {chartLoading ? (
            <ChartSkeleton />
          ) : chartHasData ? (
            <>
              <p
                style={{
                  margin: '0 0 10px',
                  fontSize: 13,
                  color: '#6b7280',
                }}
              >
                7 días: {chartSummary.last7} · 30 días:{' '}
                {chartSummary.total30}
              </p>
              <BarChart data={chartDayCounts} />
            </>
          ) : (
            <EmptyCard message="Sin registros nuevos en los últimos 30 días" />
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
                  onClick={() =>
                    navigate('/admin/members')
                  }
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
                      color:
                        m.days_left <= 1
                          ? '#DC2626'
                          : '#D97706',
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
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom:
                      i < inactive.length - 1
                        ? '1px solid #f3f4f6'
                        : 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      color: '#111',
                      fontWeight: 500,
                    }}
                  >
                    {m.full_name}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: m.last_session
                        ? '#DC2626'
                        : '#9ca3af',
                      fontStyle: m.last_session
                        ? 'normal'
                        : 'italic',
                    }}
                  >
                    {m.last_session
                      ? `${daysSince(m.last_session)} días sin actividad`
                      : 'Nunca entrenó'}
                  </span>
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
              fontSize: 13,
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

function BarChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data)
  const maxVal = Math.max(...Object.values(data), 1)
  const barW = INNER_W / entries.length

  return (
    <div style={cardStyle}>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
        }}
      >
        {/* Y axis line */}
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT}
          y2={CHART_H - PAD_BOTTOM}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
        {/* Baseline */}
        <line
          x1={PAD_LEFT}
          y1={CHART_H - PAD_BOTTOM}
          x2={CHART_W - PAD_RIGHT}
          y2={CHART_H - PAD_BOTTOM}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
        {/* Y axis labels */}
        <text
          x={PAD_LEFT - 6}
          y={CHART_H - PAD_BOTTOM + 4}
          textAnchor="end"
          fill="#9ca3af"
          fontSize={10}
        >
          0
        </text>
        <text
          x={PAD_LEFT - 6}
          y={PAD_TOP + 4}
          textAnchor="end"
          fill="#9ca3af"
          fontSize={10}
        >
          {maxVal}
        </text>
        {/* Bars */}
        {entries.map(([day, count], i) => {
          const h = (count / maxVal) * INNER_H
          const x = PAD_LEFT + i * barW + 1
          return (
            <g key={day}>
              <rect
                x={x}
                y={CHART_H - PAD_BOTTOM - h}
                width={Math.max(barW - 2, 2)}
                height={Math.max(h, 0)}
                fill="#DC2626"
                rx={2}
              />
              {/* X axis label every 5th day */}
              {i % 5 === 0 && (
                <text
                  x={x + barW / 2}
                  y={CHART_H - PAD_BOTTOM + 14}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize={8}
                >
                  {new Date(day + 'T12:00:00').getDate()}
                </text>
              )}
              {/* Value on hover target (transparent wider rect for tooltip) */}
              <title>
                {new Date(
                  day + 'T12:00:00',
                ).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                })}
                : {count} nuevo{count !== 1 ? 's' : ''}
              </title>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div style={cardStyle}>
      <div
        className="animate-pulse"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          height: 160,
          padding: '16px 24px',
        }}
      >
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${20 + Math.random() * 80}%`,
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
        display: 'flex',
        justifyContent: 'space-between',
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
          width: '30%',
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
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

/* ════════════════════════ Shared Styles ════════════════════════ */

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
}

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 16,
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
