import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export type MuscleDataPoint = {
  name: string
  value: number
  color: string
}

type Props = {
  data: MuscleDataPoint[]
}

const tooltipStyle = {
  backgroundColor: '#18181b',
  border: '1px solid #27272a',
  borderRadius: 8,
  fontSize: 12,
  color: '#f4f4f5',
}

const MUSCLE_COLORS: Record<string, string> = {
  Piernas: '#DC2626',
  Espalda: '#f97316',
  Pecho: '#a855f7',
  Hombros: '#3b82f6',
  Brazos: '#22c55e',
  Core: '#eab308',
  Cardio: '#ec4899',
  Otro: '#6b7280',
}

function normalizeMuscleName(muscle: string): string {
  const map: Record<string, string> = {
    quads: 'Piernas',
    hamstrings: 'Piernas',
    glutes: 'Piernas',
    calves: 'Piernas',
    back: 'Espalda',
    chest: 'Pecho',
    shoulders: 'Hombros',
    biceps: 'Brazos',
    triceps: 'Brazos',
    forearms: 'Brazos',
    core: 'Core',
    cardio: 'Cardio',
    full_body: 'Otro',
    other: 'Otro',
  }
  return map[muscle] ?? muscle
}

function aggregateByGroup(data: { muscle_group: string; volume: number }[]): MuscleDataPoint[] {
  const grouped: Record<string, number> = {}
  for (const d of data) {
    const name = normalizeMuscleName(d.muscle_group)
    grouped[name] = (grouped[name] ?? 0) + d.volume
  }

  const total = Object.values(grouped).reduce((a, b) => a + b, 0)
  if (total === 0) return []

  return Object.entries(grouped)
    .map(([name, value]) => ({
      name,
      value: Math.round((value / total) * 100),
      color: MUSCLE_COLORS[name] ?? '#6b7280',
    }))
    .sort((a, b) => b.value - a.value)
}

export { normalizeMuscleName, aggregateByGroup }

export default function GymMuscleBalance({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Balance muscular
        </h3>
        <p className="text-xs text-gray-500 text-center py-8">Sin datos aún</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Balance muscular
      </h3>
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                dataKey="value"
                nameKey="name"
                paddingAngle={2}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: any) => [`${value}%`, 'Volumen']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-gray-400 flex-1 truncate">{entry.name}</span>
              <span className="text-xs font-semibold text-gray-200">{entry.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
