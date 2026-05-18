import { useState, useEffect, useMemo } from 'react'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import { useAuthContext } from '../../shared/components/AuthContext'
import { Search, Plus, Pencil, Trash2, X, Play } from 'lucide-react'

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

const muscleOptions = Object.entries(muscleLabels).map(([value, label]) => ({
  value,
  label,
}))

function getYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/)
  return match ? match[1] : null
}

export default function Exercises() {
  const { profile } = useAuthContext()

  // Data
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [muscleFilter, setMuscleFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)

  // Form
  const [formName, setFormName] = useState('')
  const [formMuscleGroup, setFormMuscleGroup] = useState('')
  const [formVideoUrl, setFormVideoUrl] = useState('')
  const [formVideoType, setFormVideoType] = useState<'youtube' | 'url'>('youtube')
  const [formInstructions, setFormInstructions] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    fetchExercises()
  }, [])

  const fetchExercises = async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase.from('exercises') as any)
        .select('id, name, muscle_group, video_url, video_type, instructions')
        .order('name', { ascending: true })

      if (error) throw error
      setExercises(data ?? [])
    } catch {
      console.error('Error al cargar ejercicios')
    } finally {
      setLoading(false)
    }
  }

  const filteredExercises = useMemo(() => {
    let result = exercises

    if (muscleFilter) {
      result = result.filter((e) => e.muscle_group === muscleFilter)
    }

    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter((e) => e.name.toLowerCase().includes(q))
    }

    return result
  }, [exercises, muscleFilter, searchQuery])

  // ── Modal handlers ──

  const openCreateModal = () => {
    setSelectedExercise(null)
    setFormName('')
    setFormMuscleGroup('')
    setFormVideoUrl('')
    setFormVideoType('youtube')
    setFormInstructions('')
    setFormError(null)
    setModalMode('create')
  }

  const openEditModal = (exercise: Exercise) => {
    setSelectedExercise(exercise)
    setFormName(exercise.name)
    setFormMuscleGroup(exercise.muscle_group)
    setFormVideoUrl(exercise.video_url)
    setFormVideoType(exercise.video_type)
    setFormInstructions(exercise.instructions ?? '')
    setFormError(null)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setSelectedExercise(null)
    setFormName('')
    setFormMuscleGroup('')
    setFormVideoUrl('')
    setFormVideoType('youtube')
    setFormInstructions('')
    setFormError(null)
  }

  const handleVideoUrlChange = (url: string) => {
    setFormVideoUrl(url)
    if (/youtube|youtu\.be/i.test(url)) {
      setFormVideoType('youtube')
    }
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      setFormError('El nombre es obligatorio.')
      return
    }
    if (!formMuscleGroup) {
      setFormError('El grupo muscular es obligatorio.')
      return
    }
    if (!formVideoUrl.trim()) {
      setFormError('La URL del video es obligatoria.')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      if (modalMode === 'create') {
        const { error } = await (supabase.from('exercises') as any).insert({
          name: formName.trim(),
          muscle_group: formMuscleGroup,
          video_url: formVideoUrl.trim(),
          video_type: formVideoType,
          instructions: formInstructions.trim() || null,
          created_by: profile?.id,
        })
        if (error) throw error
      } else if (modalMode === 'edit' && selectedExercise) {
        const { error } = await (supabase.from('exercises') as any)
          .update({
            name: formName.trim(),
            muscle_group: formMuscleGroup,
            video_url: formVideoUrl.trim(),
            video_type: formVideoType,
            instructions: formInstructions.trim() || null,
          })
          .eq('id', selectedExercise.id)
        if (error) throw error
      }

      closeModal()
      await fetchExercises()
    } catch (err: any) {
      console.log('Error completo:', JSON.stringify(err))
      setFormError(
        typeof err === 'object' && err !== null && err.message
          ? err.message
          : 'Error al guardar.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (exercise: Exercise) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${exercise.name}"?`)) return

    try {
      const { error } = await (supabase.from('exercises') as any)
        .delete()
        .eq('id', exercise.id)
      if (error) throw error
      await fetchExercises()
    } catch (err) {
      console.error('Error al eliminar ejercicio:', err)
    }
  }

  // ── Render ──

  return (
    <AdminLayout pageTitle="Ejercicios">
      {/* ── Top bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        {/* Muscle group filter */}
        <select
          value={muscleFilter}
          onChange={(e) => setMuscleFilter(e.target.value)}
          style={filterSelectStyle}
        >
          <option value="">Todos</option>
          {muscleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#DC2626')}
            onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
          />
        </div>

        <button onClick={openCreateModal} style={btnPrimaryStyle}>
          <Plus size={18} />
          Nuevo ejercicio
        </button>
      </div>

      {/* ── Exercise grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filteredExercises.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '48px 16px',
              color: '#6b7280',
              fontSize: 14,
            }}
          >
            {searchQuery.trim() || muscleFilter
              ? 'No se encontraron ejercicios con ese criterio.'
              : 'No hay ejercicios en la biblioteca aún.'}
          </div>
        ) : (
          filteredExercises.map((exercise) => (
            <div key={exercise.id} style={cardStyle}>
              {/* Video preview */}
              <div style={{ position: 'relative', width: '100%', height: 140 }}>
                {/* Fallback: always present */}
                <div
                  style={{
                    width: '100%',
                    height: 140,
                    backgroundColor: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                  }}
                >
                  <Play size={32} />
                </div>

                {/* YouTube thumbnail overlay */}
                {exercise.video_type === 'youtube' && getYouTubeVideoId(exercise.video_url) && (
                  <img
                    src={`https://img.youtube.com/vi/${getYouTubeVideoId(exercise.video_url)}/mqdefault.jpg`}
                    alt=""
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: 140,
                      objectFit: 'cover',
                      display: 'block',
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
              </div>

              {/* Card content */}
              <div style={{ padding: 12 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: '#111',
                    marginBottom: 8,
                  }}
                >
                  {exercise.name}
                </div>
                <span
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 12,
                  }}
                >
                  {muscleLabels[exercise.muscle_group] ?? exercise.muscle_group}
                </span>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 4,
                    marginTop: 12,
                  }}
                >
                  <IconButton onClick={() => openEditModal(exercise)} title="Editar">
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDelete(exercise)}
                    title="Eliminar"
                    style={{ color: '#DC2626' }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Modal: Create / Edit ── */}
      {modalMode && (
        <div style={overlayStyle} onClick={closeModal}>
          <div
            style={modalCardStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111' }}>
                {modalMode === 'create' ? 'Nuevo ejercicio' : 'Editar ejercicio'}
              </h2>
              <button onClick={closeModal} style={iconBtnCleanStyle}>
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <label style={labelStyle}>
                  Nombre <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Press de banca"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = '#DC2626')}
                  onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                />
              </div>

              {/* Muscle group */}
              <div>
                <label style={labelStyle}>
                  Grupo muscular <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={formMuscleGroup}
                  onChange={(e) => setFormMuscleGroup(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Seleccionar grupo...</option>
                  {muscleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Video URL */}
              <div>
                <label style={labelStyle}>
                  URL del video <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formVideoUrl}
                  onChange={(e) => handleVideoUrlChange(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = '#DC2626')}
                  onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                />
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                  Pegá el link de YouTube o cualquier URL de video
                </p>
              </div>

              {/* Video type */}
              <div>
                <label style={labelStyle}>Tipo de video</label>
                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      fontSize: 14,
                      color: '#374151',
                    }}
                  >
                    <input
                      type="radio"
                      name="videoType"
                      checked={formVideoType === 'youtube'}
                      onChange={() => setFormVideoType('youtube')}
                    />
                    YouTube
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      fontSize: 14,
                      color: '#374151',
                    }}
                  >
                    <input
                      type="radio"
                      name="videoType"
                      checked={formVideoType === 'url'}
                      onChange={() => setFormVideoType('url')}
                    />
                    URL directa
                  </label>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label style={labelStyle}>
                  Instrucciones{' '}
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>(opcional)</span>
                </label>
                <textarea
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  placeholder="Describí cómo se ejecuta el ejercicio..."
                  rows={3}
                  style={{
                    ...inputStyle,
                    height: 'auto',
                    padding: '10px 12px',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#DC2626')}
                  onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                />
              </div>

              {/* YouTube thumbnail preview */}
              {formVideoType === 'youtube' && getYouTubeVideoId(formVideoUrl) && (
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
                    Preview:
                  </p>
                  <img
                    src={`https://img.youtube.com/vi/${getYouTubeVideoId(formVideoUrl)}/mqdefault.jpg`}
                    alt="Thumbnail preview"
                    style={{
                      width: '100%',
                      maxHeight: 160,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              )}

              {formError && (
                <p style={{ margin: 0, fontSize: 13, color: '#DC2626' }}>{formError}</p>
              )}

              {/* Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                  marginTop: 8,
                }}
              >
                <button onClick={closeModal} style={btnSecondaryStyle}>
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    ...btnPrimaryStyle,
                    opacity: saving ? 0.6 : 1,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

/* ── Styles ── */

const filterSelectStyle: React.CSSProperties = {
  height: 38,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 14,
  outline: 'none',
  backgroundColor: '#fff',
  color: '#111',
  cursor: 'pointer',
  minWidth: 160,
}

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 12px 0 38px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 14,
  outline: 'none',
  backgroundColor: '#fff',
  color: '#111',
  boxSizing: 'border-box',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 14,
  outline: 'none',
  backgroundColor: '#fff',
  color: '#111',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'auto',
}

const btnPrimaryStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 38,
  padding: '0 16px',
  backgroundColor: '#DC2626',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

const btnSecondaryStyle: React.CSSProperties = {
  height: 38,
  padding: '0 16px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  backgroundColor: '#fff',
  color: '#374151',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  overflow: 'hidden',
  backgroundColor: '#fff',
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: 40,
  paddingBottom: 40,
  overflowY: 'auto',
  zIndex: 50,
}

const modalCardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 24,
  width: '100%',
  maxWidth: 520,
  margin: 16,
}

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 24,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 4,
}

const iconBtnCleanStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#6b7280',
  padding: 4,
  display: 'flex',
}

/* ── Helpers ── */

function IconButton({
  children,
  onClick,
  title,
  style,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b7280',
        borderRadius: 6,
        transition: 'background-color 0.15s',
        ...style,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = '#f3f4f6')
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = 'transparent')
      }
    >
      {children}
    </button>
  )
}

function SkeletonCard() {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#fff',
      }}
    >
      <div
        className="animate-pulse"
        style={{ width: '100%', height: 140, backgroundColor: '#e5e7eb' }}
      />
      <div style={{ padding: 12 }}>
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
            height: 12,
            width: '40%',
            backgroundColor: '#e5e7eb',
            borderRadius: 4,
          }}
        />
      </div>
    </div>
  )
}
