import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../shared/lib/supabase'
import UserLayout from '../../shared/components/UserLayout'
import { Search, Play, Loader2 } from 'lucide-react'

type Exercise = {
  id: string
  name: string
  muscle_group: string
  video_url: string
  video_type: 'youtube' | 'url'
  instructions: string | null
}

const muscleLabels: Record<string, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  core: 'Core',
  quads: 'Cuádriceps',
  hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos',
  calves: 'Pantorrillas',
  full_body: 'Cuerpo completo',
  cardio: 'Cardio',
  other: 'Otro',
}

const muscleOptions = Object.entries(muscleLabels).map(([value, label]) => ({ value, label }))

function getYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/)
  return match ? match[1] : null
}

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [muscleFilter, setMuscleFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchExercises()
  }, [])

  const fetchExercises = async () => {
    setLoading(true)
    try {
      const { data } = await (supabase as any)
        .from('exercises')
        .select('id, name, muscle_group, video_url, video_type, instructions')
        .order('name', { ascending: true })
      if (data) setExercises(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    let result = exercises
    if (muscleFilter) {
      result = result.filter((e) => e.muscle_group === muscleFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((e) => e.name.toLowerCase().includes(q))
    }
    return result
  }, [exercises, muscleFilter, searchQuery])

  return (
    <UserLayout>
      <div className="px-4 py-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Ejercicios
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Biblioteca de ejercicios del gym
        </p>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar ejercicio..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
            />
          </div>
          <select
            value={muscleFilter}
            onChange={(e) => setMuscleFilter(e.target.value)}
            className="h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-2 focus:outline-none focus:ring-2 focus:ring-[#DC2626] focus:border-transparent"
          >
            <option value="">Todos</option>
            {muscleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-16">
            No se encontraron ejercicios.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((exercise) => {
              const videoId = exercise.video_type === 'youtube' ? getYouTubeVideoId(exercise.video_url) : null
              return (
                <a
                  key={exercise.id}
                  href={exercise.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    {videoId ? (
                      <img
                        src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                        alt={exercise.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <Play size={24} className="text-gray-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {exercise.name}
                    </p>
                    <span className="inline-block text-[10px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5 mt-1">
                      {muscleLabels[exercise.muscle_group] ?? exercise.muscle_group}
                    </span>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </UserLayout>
  )
}
