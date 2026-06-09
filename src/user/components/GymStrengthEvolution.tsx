import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export type StrengthDataPoint = {
  week: string
  max_weight: number
}

export type ExerciseStrength = {
  exercise_id: string
  exercise_name: string
  data: StrengthDataPoint[]
}

type Props = {
  exercises: ExerciseStrength[]
  selectedExerciseId: string
  onSelectExercise: (id: string) => void
}

const tooltipStyle = {
  backgroundColor: '#18181b',
  border: '1px solid #27272a',
  borderRadius: 8,
  fontSize: 12,
  color: '#f4f4f5',
}

export default function GymStrengthEvolution({ exercises, selectedExerciseId, onSelectExercise }: Props) {
  const current = exercises.find((e) => e.exercise_id === selectedExerciseId)
  const data = current?.data ?? []

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Evolución de fuerza
        </h3>
        <select
          value={selectedExerciseId}
          onChange={(e) => onSelectExercise(e.target.value)}
          className="text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded-md px-2 py-1 outline-none focus:border-red-500 cursor-pointer"
        >
          {exercises.map((ex) => (
            <option key={ex.exercise_id} value={ex.exercise_id}>
              {ex.exercise_name}
            </option>
          ))}
        </select>
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-8">Sin datos para este ejercicio</p>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" strokeOpacity={0.3} />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: '#a1a1aa' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v} kg`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: any) => [`${Number(value).toFixed(1)} kg`, '1RM estimado']}
              labelFormatter={(label: any) => `Semana ${label}`}
            />
            <Line
              type="monotone"
              dataKey="max_weight"
              stroke="#DC2626"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#DC2626', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#DC2626' }}
              name="Peso máximo"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
