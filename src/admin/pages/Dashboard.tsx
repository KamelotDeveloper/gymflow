import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import {
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  MessageCircle,
  ChevronRight,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

/* ── Types ── */

type KpiData = {
  activeMembers: number | null
  monthlyRevenue: number | null
  delinquencyAmount: number | null
  newMembersMonth: number | null
  growthPct: number | null
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

/* ── Component ── */

export default function Dashboard() {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  /* ── Section states ── */

  const [kpiData, setKpiData] = useState<KpiData>({
    activeMembers: null,
    monthlyRevenue: null,
    delinquencyAmount: null,
    newMembersMonth: null,
    growthPct: null,
  })
  const [kpiLoading, setKpiLoading] = useState(true)

  const [chartMonthsData, setChartMonthsData] = useState<
    { month: string; altas: number; bajas: number }[]
  >([])
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
    const sixtyDaysAgo = daysAgo(60)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const results = await Promise.allSettled([
      /* 0 — Active members */
      (supabase as any)
        .from('memberships')
        .select('profile_id')
        .or('status.eq.active,admin_override.eq.true')
        .gte('end_date', todayStr),

      /* 1 — Monthly revenue (confirmed this month) */
      supabase
        .from('payment_transactions')
        .select('amount')
        .eq('status', 'confirmed')
        .gte('confirmed_at', startOfMonth.toISOString()),

      /* 2 — Pending payments (delinquency) */
      supabase
        .from('payment_transactions')
        .select('id, amount')
        .eq('status', 'pending')
        .gte('created_at', startOfMonth.toISOString()),

      /* 3 — Expired memberships last 6 months (bajas) */
      supabase
        .from('memberships')
        .select('profile_id, end_date, status')
        .eq('status', 'expired')
        .gte('end_date', sixMonthsAgo.toISOString())
        .order('end_date'),

      /* 4 — All memberships start dates (for altas) */
      supabase
        .from('memberships')
        .select('profile_id, start_date')
        .order('start_date'),

      /* 5 — Expiring members next 7 days */
      (supabase as any)
        .from('memberships')
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
      pendingResult,
      expiredMembershipsResult,
      membershipResult,
      expiringResult,
      membersResult,
      sessions60Result,
    ] = results

    /* ── KPI ── */
    const kpi: KpiData = {
      activeMembers: null,
      monthlyRevenue: null,
      delinquencyAmount: null,
      newMembersMonth: null,
      growthPct: null,
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
      kpi.delinquencyAmount = rows.reduce(
        (s: number, r: any) => s + (r.amount ?? 0),
        0,
      )
    }

    /* ── Growth & Chart Altas ── */
    let altasByMonth: Record<string, number> = {}
    let newCount = 0
    if (membershipResult.status === 'fulfilled') {
      const rows = (membershipResult.value as any).data ?? []
      // Find earliest membership per member (= first join)
      const firstJoinMap = new Map<string, string>()
      for (const r of rows) {
        const pid = r.profile_id
        const sd = r.start_date
        if (!pid || !sd) continue
        const existing = firstJoinMap.get(pid)
        if (!existing || sd < existing) {
          firstJoinMap.set(pid, sd)
        }
      }
      const currentMonth = todayISO().substring(0, 7)
      for (const [, startDate] of firstJoinMap) {
        const month = startDate.substring(0, 7)
        altasByMonth[month] = (altasByMonth[month] || 0) + 1
        if (month === currentMonth) newCount++
      }
    }
    kpi.newMembersMonth = newCount
    kpi.growthPct =
      kpi.activeMembers && kpi.activeMembers > 0
        ? Math.round((newCount / kpi.activeMembers) * 1000) / 10
        : 0

    setKpiData(kpi)
    setKpiLoading(false)

    /* ── Chart ── */
    const months: string[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      months.push(`${y}-${m}`)
    }

    // Build set of currently active profile_ids to exclude from bajas
    const activeProfileIds = new Set<string>()
    if (activeResult.status === 'fulfilled') {
      const rows = (activeResult.value as any).data ?? []
      for (const r of rows) {
        if (r.profile_id) activeProfileIds.add(r.profile_id)
      }
    }

    const bajasByMonth: Record<string, number> = {}
    if (expiredMembershipsResult.status === 'fulfilled') {
      const rows = (expiredMembershipsResult.value as any).data ?? []
      for (const r of rows) {
        // Skip profiles that currently have an active membership (they came back)
        if (activeProfileIds.has(r.profile_id)) continue
        const month = r.end_date?.substring(0, 7)
        if (month) bajasByMonth[month] = (bajasByMonth[month] || 0) + 1
      }
    }

    setChartMonthsData(
      months.map((m) => ({
        month: m,
        altas: altasByMonth[m] || 0,
        bajas: bajasByMonth[m] || 0,
      })),
    )
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
            phone: m.phone ?? null,
          })
        }
      }
      setInactive(list)
    }
    setInactiveLoading(false)
  }

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
                  icon={
                    <Clock
                      size={20}
                      style={{ color: '#D97706' }}
                    />
                  }
                  label="Morosidad Activa"
                  value={
                    kpiData.delinquencyAmount !== null
                      ? formatCurrency(kpiData.delinquencyAmount)
                      : '-'
                  }
                  subtitle={null}
                  hasError={kpiData.delinquencyAmount === null}
                />
                <KpiCard
                  icon={
                    <TrendingUp
                      size={20}
                      style={{ color: '#059669' }}
                    />
                  }
                  label="Crecimiento"
                  value={
                    kpiData.newMembersMonth !== null
                      ? `${kpiData.newMembersMonth} nuevos`
                      : '-'
                  }
                  subtitle={
                    kpiData.growthPct !== null
                      ? `${kpiData.growthPct}% vs activos`
                      : null
                  }
                  hasError={kpiData.newMembersMonth === null}
                />
              </>
            )}
          </div>
        </section>

        {/* ═══ Retention Chart ═══ */}
        <section>
          <h2
            style={{
              margin: '0 0 14px',
              fontSize: 16,
              fontWeight: 700,
              color: '#111827',
            }}
          >
            Retención Mensual
          </h2>
          {chartLoading ? (
            <div style={cardStyle}>
              <div
                className="animate-pulse"
                style={{
                  height: 250,
                  backgroundColor: '#e5e7eb',
                  borderRadius: 8,
                  margin: 16,
                }}
              />
            </div>
          ) : chartMonthsData.length > 0 ? (
            <div style={cardStyle}>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartMonthsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    tickFormatter={(m: string) => {
                      const [y, mo] = m.split('-')
                      const months = [
                        'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dec',
                      ]
                      return `${months[parseInt(mo) - 1]} ${y}`
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    allowDecimals={false}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="altas"
                    stroke="#059669"
                    strokeWidth={2}
                    name="Altas"
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bajas"
                    stroke="#DC2626"
                    strokeWidth={2}
                    name="Bajas"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyCard message="Sin datos de retención en los últimos 6 meses" />
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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
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
                        ? `Hace ${daysSince(m.last_session)} días`
                        : 'Nunca entrenó'}
                    </span>
                    {m.phone ? (
                      <a
                        href={`https://wa.me/${m.phone.replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(m.full_name)}%2C%20queremos%20verte%20de%20vuelta%20en%20el%20gimnasio%21`}
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
                          color: '#22c55e',
                          border: 'none',
                          cursor: 'pointer',
                          textDecoration: 'none',
                        }}
                      >
                        <MessageCircle size={16} />
                      </a>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          color: '#d1d5db',
                        }}
                      >
                        <MessageCircle size={16} />
                      </span>
                    )}
                  </div>
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
