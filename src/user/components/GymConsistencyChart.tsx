import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type DataPoint = {
  week: string
  sessions: number
}

type Props = {
  data: DataPoint[]
  monthlyCompliance: number
  goalDays: number
}

const tooltipStyle = {
  backgroundColor: '#18181b',
  border: '1px solid #27272a',
  borderRadius: 8,
  fontSize: 12,
  color: '#f4f4f5',
}

export default function GymConsistencyChart({ data, monthlyCompliance, goalDays }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Consistencia semanal
        </h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          <span className="font-bold text-red-500">{monthlyCompliance}%</span> de cumplimiento
        </span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barCategoryGap={8}>
          <defs>
            <linearGradient id="consistencyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#DC2626" stopOpacity={1} />
              <stop offset="100%" stopColor="#DC2626" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" strokeOpacity={0.3} />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, goalDays]} tick={{ fontSize: 10, fill: '#a1a1aa' }} allowDecimals={false} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: any) => [`${value} / ${goalDays} días`, 'Asistencia']}
            labelFormatter={(label: any) => `Semana ${label}`}
          />
          <Bar dataKey="sessions" fill="url(#consistencyGrad)" radius={[3, 3, 0, 0]} maxBarSize={32} name="Días entrenados" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
