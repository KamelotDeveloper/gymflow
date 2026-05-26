import { useState, useEffect } from 'react'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import { useAuthContext } from '../../shared/components/AuthContext'
import { Plus, Trash2, ExternalLink, FileText, Loader2 } from 'lucide-react'

type Profile = {
  id: string
  full_name: string
}

type Routine = {
  id: string
  name: string
  description: string | null
  is_template: boolean
  day_number: number | null
  member_id: string | null
  created_by: string
  created_at: string
}

type Exercise = {
  id: string
  name: string
  video_url: string
}

type ProgressEntry = {
  set_number: number
  current_reps: number | null
  current_weight: number | null
}

type SetDatum = {
  set: number
  reps: number
  weight_kg: number | null
}

type RoutineExercise = {
  id: string
  routine_id: string
  exercise_id: string
  sets: number
  reps: number
  weight_kg: number
  rest_seconds: number
  order_index: number
  sets_data: SetDatum[] | null
  exercise: Exercise
}

const DAY_LABELS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
}

export default function Routines() {
  const { profile } = useAuthContext()

  // ── Column 1: Members ──
  const [members, setMembers] = useState<Profile[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')

  // ── Column 2: Days / Templates ──
  const [routinesByDay, setRoutinesByDay] = useState<(Routine | null)[]>(
    Array(5).fill(null),
  )
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [templates, setTemplates] = useState<Routine[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)

  // ── Column 3: Editor ──
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null)
  const [routineExercises, setRoutineExercises] = useState<RoutineExercise[]>([])
  const [exercisesLoading, setExercisesLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [perSetExpanded, setPerSetExpanded] = useState<Set<string>>(new Set())
  const [memberProgress, setMemberProgress] = useState<Record<string, ProgressEntry[]>>({})
  const [, setProgressLoading] = useState(false)

  // ── Create form ──
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createSaving, setCreateSaving] = useState(false)
  const [createForDay, setCreateForDay] = useState<number | null>(null)

  // ── Effects ──

  useEffect(() => {
    fetchMembers()
  }, [])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (selectedMemberId) {
      setRoutinesByDay(Array(5).fill(null))
      setSelectedDay(null)
      setSelectedRoutine(null)
      setShowCreateForm(false)
      fetchRoutinesByDay(selectedMemberId)
    }
  }, [selectedMemberId])

  useEffect(() => {
    if (showTemplates) {
      fetchTemplates()
      setSelectedDay(null)
      setSelectedRoutine(null)
      setShowCreateForm(false)
    }
  }, [showTemplates])

  useEffect(() => {
    if (selectedRoutine) {
      fetchRoutineExercises(selectedRoutine.id)
    } else {
      setRoutineExercises([])
      setMemberProgress({})
    }
  }, [selectedRoutine])

  // ── Data fetching ──

  const fetchMembers = async () => {
    setMembersLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'member')
        .order('full_name', { ascending: true })
      setMembers(data ?? [])
    } catch {
      console.error('Error al cargar miembros')
    } finally {
      setMembersLoading(false)
    }
  }

  const fetchRoutinesByDay = async (memberId: string) => {
    try {
      const { data } = await (supabase.from('routines') as any)
        .select('*')
        .eq('member_id', memberId)
        .not('day_number', 'is', null)
      const routines: Routine[] = data ?? []
      const byDay: (Routine | null)[] = Array(5).fill(null)
      for (const r of routines) {
        if (r.day_number != null && r.day_number >= 1 && r.day_number <= 5) {
          byDay[r.day_number - 1] = r
        }
      }
      setRoutinesByDay(byDay)
    } catch {
      console.error('Error al cargar rutinas del miembro')
    }
  }

  const fetchTemplates = async () => {
    setTemplatesLoading(true)
    try {
      const { data } = await (supabase.from('routines') as any)
        .select('*')
        .eq('is_template', true)
        .order('name', { ascending: true })
      setTemplates(data ?? [])
    } catch {
      console.error('Error al cargar plantillas')
    } finally {
      setTemplatesLoading(false)
    }
  }

  const fetchRoutineExercises = async (routineId: string) => {
    setExercisesLoading(true)
    setMemberProgress({})
    try {
      const { data } = await (supabase.from('routine_exercises') as any)
        .select(
          'id, sets, reps, weight_kg, rest_seconds, order_index, sets_data, exercise:exercises(id, name, video_url)',
        )
        .eq('routine_id', routineId)
        .order('order_index', { ascending: true })
      setRoutineExercises(data ?? [])

      // Fetch member progress for each exercise if routine has a member
      const routine = selectedRoutine
      if (routine?.member_id && data && data.length > 0) {
        fetchMemberProgress(routine.member_id, data.map((re: any) => re.exercise_id))
      }
    } catch {
      console.error('Error al cargar ejercicios')
    } finally {
      setExercisesLoading(false)
    }
  }

  const fetchMemberProgress = async (memberId: string, exerciseIds: string[]) => {
    setProgressLoading(true)
    try {
      const { data } = await (supabase.from('progress_comparison') as any)
        .select('exercise_id, set_number, current_reps, current_weight')
        .eq('profile_id', memberId)
        .in('exercise_id', exerciseIds)
        .order('set_number', { ascending: true })

      if (data) {
        const grouped: Record<string, ProgressEntry[]> = {}
        for (const entry of data) {
          if (!grouped[entry.exercise_id]) grouped[entry.exercise_id] = []
          grouped[entry.exercise_id].push({
            set_number: entry.set_number,
            current_reps: entry.current_reps,
            current_weight: entry.current_weight,
          })
        }
        setMemberProgress(grouped)
      }
    } catch {
      console.error('Error al cargar progreso del miembro')
    } finally {
      setProgressLoading(false)
    }
  }

  // ── Navigation ──

  const handleSelectMember = (memberId: string) => {
    setSelectedMemberId(memberId)
    setShowTemplates(false)
    setSelectedRoutine(null)
    setShowCreateForm(false)
  }

  const handleSelectTemplates = () => {
    setShowTemplates(true)
    setSelectedMemberId(null)
    setSelectedRoutine(null)
    setShowCreateForm(false)
  }

  const handleSelectDay = (day: number) => {
    setSelectedDay(day)
    setShowCreateForm(false)
    const routine = routinesByDay[day - 1]
    setSelectedRoutine(routine ?? null)
  }

  const handleDayPlusClick = (day: number) => {
    setSelectedDay(day)
    setSelectedRoutine(null)
    setCreateForDay(day)
    setCreateName(`Día ${day} — ${DAY_LABELS[day]}`)
    setCreateDescription('')
    setShowCreateForm(true)
  }

  const handleSelectTemplate = (template: Routine) => {
    setSelectedRoutine(template)
    setSelectedDay(null)
    setShowCreateForm(false)
  }

  // ── Create routine ──

  const handleCreateRoutine = async () => {
    if (!createName.trim() || !selectedMemberId || !createForDay) return
    setCreateSaving(true)
    try {
      const { data: newRoutine } = await (supabase.from('routines') as any)
        .insert({
          name: createName.trim(),
          description: createDescription.trim() || null,
          member_id: selectedMemberId,
          day_number: createForDay,
          is_template: false,
          created_by: profile?.id,
        })
        .select()
        .single()

      if (newRoutine) {
        const byDay = [...routinesByDay]
        byDay[createForDay - 1] = newRoutine as Routine
        setRoutinesByDay(byDay)
        setSelectedRoutine(newRoutine as Routine)
        setShowCreateForm(false)
      }
    } catch (err) {
      console.error('Error al crear rutina:', err)
    } finally {
      setCreateSaving(false)
    }
  }

  // ── Create template ──

  const handleCreateTemplate = async () => {
    try {
      const { data: newTemplate } = await (supabase.from('routines') as any)
        .insert({
          name: 'Nueva plantilla',
          description: null,
          is_template: true,
          created_by: profile?.id,
        })
        .select()
        .single()

      if (newTemplate) {
        setTemplates((prev) => [...prev, newTemplate as Routine])
        setSelectedRoutine(newTemplate as Routine)
      }
    } catch (err) {
      console.error('Error al crear plantilla:', err)
    }
  }

  // ── Delete routine ──

  const handleDeleteRoutine = async () => {
    if (!selectedRoutine) return
    if (
      !window.confirm(
        `¿Eliminar "${selectedRoutine.name}" y todos sus ejercicios?`,
      )
    )
      return

    try {
      // 1. Obtener exercise_ids
      const { data: reLinks } = await (supabase as any)
        .from('routine_exercises')
        .select('id, exercise_id')
        .eq('routine_id', selectedRoutine.id)

      // 2. DELETE routine_exercises
      await (supabase as any)
        .from('routine_exercises')
        .delete()
        .eq('routine_id', selectedRoutine.id)

      // 3. DELETE exercises
      if (reLinks && reLinks.length > 0) {
        const exerciseIds = reLinks.map((r: any) => r.exercise_id)
        await (supabase as any)
          .from('exercises')
          .delete()
          .in('id', exerciseIds)
      }

      // 4. DELETE routine_assignments
      await (supabase as any)
        .from('routine_assignments')
        .delete()
        .eq('routine_id', selectedRoutine.id)

      // 5. DELETE routines
      await (supabase as any)
        .from('routines')
        .delete()
        .eq('id', selectedRoutine.id)

      // 6. Limpiar estado local
      if (selectedRoutine.day_number && selectedRoutine.member_id) {
        const byDay = [...routinesByDay]
        byDay[selectedRoutine.day_number - 1] = null
        setRoutinesByDay(byDay)
      } else if (selectedRoutine.is_template) {
        setTemplates((prev) => prev.filter((t) => t.id !== selectedRoutine.id))
      }

      setSelectedRoutine(null)
      setSelectedDay(null)
    } catch (err: any) {
      console.error('Error al eliminar rutina:', err)
      alert('Error al eliminar: ' + err.message)
    }
  }

  // ── Auto-save routine fields ──

  const updateRoutineField = async (field: string, value: string) => {
    if (!selectedRoutine) return
    try {
      await (supabase.from('routines') as any)
        .update({ [field]: value })
        .eq('id', selectedRoutine.id)
      setSelectedRoutine((prev) =>
        prev ? { ...prev, [field]: value } : null,
      )
    } catch {
      console.error(`Error al guardar ${field}`)
    }
  }

  // ── Inline exercise editing ──

  const saveRoutineExerciseRow = async (re: RoutineExercise) => {
    try {
      // Leer valor actual del state para evitar stale closure
      const current = routineExercises.find((r) => r.id === re.id) ?? re
      const updatePayload: any = {
        sets: current.sets,
        reps: current.reps,
        weight_kg: current.weight_kg,
        rest_seconds: current.rest_seconds,
      }
      // Cuando per-set está expandido, escribir sets_data y sincronizar sets
      if (perSetExpanded.has(current.id) && current.sets_data) {
        updatePayload.sets_data = current.sets_data
        updatePayload.sets = current.sets_data.length
      } else {
        updatePayload.sets_data = null
      }
      await (supabase.from('routine_exercises') as any)
        .update(updatePayload)
        .eq('id', current.id)
    } catch {
      console.error('Error al guardar ejercicio')
    }
  }

  const updateExerciseField = (id: string, field: string, value: any) => {
    setRoutineExercises((prev) =>
      prev.map((re) => (re.id === id ? { ...re, [field]: value } : re)),
    )
  }

  const updateExerciseExerciseField = (
    id: string,
    field: string,
    value: any,
  ) => {
    setRoutineExercises((prev) =>
      prev.map((re) => {
        if (re.id !== id) return re
        return { ...re, exercise: { ...re.exercise, [field]: value } }
      }),
    )
  }

  const updateExerciseSetField = (
    id: string,
    setIndex: number,
    field: 'reps' | 'weight_kg',
    value: number | null,
  ) => {
    setRoutineExercises((prev) =>
      prev.map((re) => {
        if (re.id !== id || !re.sets_data) return re
        const newSetsData = re.sets_data.map((sd, i) =>
          i === setIndex ? { ...sd, [field]: value } : sd,
        )
        return { ...re, sets_data: newSetsData }
      }),
    )
  }

  const togglePerSet = (re: RoutineExercise) => {
    const isCurrentlyExpanded = perSetExpanded.has(re.id)
    if (isCurrentlyExpanded) {
      // Colapsar: limpiar sets_data
      setRoutineExercises((prev) =>
        prev.map((r) => (r.id === re.id ? { ...r, sets_data: null } : r)),
      )
    } else {
      // Expandir: generar sets_data desde valores escalares
      const sd = buildSetsData(re.sets, re.reps, re.weight_kg)
      setRoutineExercises((prev) =>
        prev.map((r) => (r.id === re.id ? { ...r, sets_data: sd } : r)),
      )
    }
    setPerSetExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(re.id)) next.delete(re.id)
      else next.add(re.id)
      return next
    })
  }

  const handleExerciseNameBlur = async (re: RoutineExercise) => {
    try {
      // Leer valor actual del state para evitar stale closure
      const current = routineExercises.find((r) => r.id === re.id) ?? re
      const name = current.exercise.name.trim()
      if (!name) return

      await (supabase.from('exercises') as any)
        .update({ name })
        .eq('id', current.exercise.id)

      // Auto-fill video_url si está vacío y existe otro ejercicio con el mismo nombre
      if (!current.exercise.video_url) {
        const { data: existing } = await (supabase.from('exercises') as any)
          .select('video_url')
          .eq('name', name)
          .not('video_url', 'eq', '')
          .not('id', 'eq', current.exercise.id)
          .limit(1)
          .maybeSingle()

        if (existing?.video_url) {
          await (supabase.from('exercises') as any)
            .update({ video_url: existing.video_url })
            .eq('id', current.exercise.id)

          // Actualizar estado local
          setRoutineExercises((prev) =>
            prev.map((r) =>
              r.id === re.id
                ? { ...r, exercise: { ...r.exercise, video_url: existing.video_url } }
                : r,
            ),
          )
        }
      }
    } catch {
      console.error('Error al guardar nombre')
    }
  }

  const handleExerciseVideoBlur = async (re: RoutineExercise) => {
    try {
      const current = routineExercises.find((r) => r.id === re.id) ?? re
      await (supabase.from('exercises') as any)
        .update({ video_url: current.exercise.video_url })
        .eq('id', current.exercise.id)
    } catch {
      console.error('Error al guardar URL')
    }
  }

  // ── Add exercise ──

  const handleAddExercise = async () => {
    if (!selectedRoutine) return
    try {
      // Nombre único para evitar UNIQUE constraint en exercises.name
      const uniqueName = `Ejercicio ${routineExercises.length + 1}`

      const { data: newExercise } = await (
        supabase.from('exercises') as any
      )
        .insert({
          name: uniqueName,
          muscle_group: 'other',
          video_url: '',
          video_type: 'youtube',
          created_by: profile?.id,
        })
        .select()
        .single()

      if (!newExercise) {
        alert('No se pudo crear el ejercicio. ¿Puede existir uno con el mismo nombre?')
        return
      }

      const nextOrder = routineExercises.length + 1
      const { error: linkError } = await (supabase.from('routine_exercises') as any)
        .insert({
          routine_id: selectedRoutine.id,
          exercise_id: newExercise.id,
          sets: 3,
          reps: 10,
          weight_kg: 0,
          rest_seconds: 60,
          order_index: nextOrder,
        })

      if (linkError) {
        alert(`Error al agregar ejercicio: ${linkError.message}`)
        return
      }

      await fetchRoutineExercises(selectedRoutine.id)
    } catch (err) {
      console.error('Error al agregar ejercicio:', err)
      alert('Error al agregar ejercicio. Revisá la consola para más detalles.')
    }
  }

  // ── Delete exercise ──

  const handleDeleteExercise = async (re: RoutineExercise) => {
    if (!window.confirm('¿Eliminar este ejercicio de la rutina?')) return
    try {
      await (supabase.from('routine_exercises') as any)
        .delete()
        .eq('id', re.id)

      await (supabase.from('exercises') as any)
        .delete()
        .eq('id', re.exercise.id)

      if (selectedRoutine) {
        await fetchRoutineExercises(selectedRoutine.id)
      }
    } catch (err) {
      console.error('Error al eliminar ejercicio:', err)
    }
  }

  // ── Derived ──

  const selectedMember = members.find((m) => m.id === selectedMemberId)
  const memberSearchLower = memberSearch.toLowerCase()
  const filteredMembers = members.filter((m) =>
    m.full_name.toLowerCase().includes(memberSearchLower),
  )

  // ── Render ──

  // On mobile, decide which step to show
  const mobileStep =
    showTemplates
      ? 'days'
      : !selectedMemberId
        ? 'members'
        : selectedDay || selectedRoutine || showCreateForm
          ? 'editor'
          : 'days'

  const showMembersColumn = !isMobile || mobileStep === 'members'
  const showDaysColumn = !isMobile || mobileStep === 'days'
  const showEditorColumn = !isMobile || mobileStep === 'editor'

  return (
    <AdminLayout pageTitle="Rutinas">
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          minHeight: isMobile ? 'auto' : '100%',
          margin: isMobile ? 0 : '0 -24px',
          alignItems: isMobile ? 'stretch' : 'stretch',
        }}
      >
        {/* ── COLUMN 1: Members Sidebar ── */}
        {showMembersColumn && (
        <div
          style={{
            width: isMobile ? '100%' : 220,
            flexShrink: 0,
            backgroundColor: '#111',
            color: '#fff',
            minHeight: '100%',
          }}
        >
          <div style={{ fontWeight: 600, padding: 16, fontSize: 14 }}>
            Miembros
          </div>

          <div style={{ padding: '0 12px 8px' }}>
            <input
              type="text"
              placeholder="Buscar miembro..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = '#DC2626')
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = '#374151')
              }
              style={{
                width: '100%',
                height: 32,
                padding: '0 10px',
                borderRadius: 6,
                border: '1px solid #374151',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {membersLoading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: 24,
              }}
            >
              <Loader2
                size={20}
                className="animate-spin"
                style={{ color: '#9ca3af' }}
              />
            </div>
          ) : members.length === 0 ? (
            <div
              style={{ padding: '10px 16px', fontSize: 14, color: '#9ca3af' }}
            >
              No hay miembros
            </div>
          ) : filteredMembers.length === 0 ? (
            <div
              style={{ padding: '10px 16px', fontSize: 14, color: '#9ca3af' }}
            >
              No coincide ningún miembro
            </div>
          ) : (
            <div>
              {filteredMembers.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleSelectMember(m.id)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    fontSize: 14,
                    backgroundColor:
                      selectedMemberId === m.id ? '#DC2626' : 'transparent',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedMemberId !== m.id)
                      e.currentTarget.style.backgroundColor = '#1f1f1f'
                  }}
                  onMouseLeave={(e) => {
                    if (selectedMemberId !== m.id)
                      e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  {m.full_name}
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              borderTop: '1px solid #2a2a2a',
              marginTop: 8,
            }}
          />

          <div
            onClick={handleSelectTemplates}
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: showTemplates ? '#DC2626' : 'transparent',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!showTemplates)
                e.currentTarget.style.backgroundColor = '#1f1f1f'
            }}
            onMouseLeave={(e) => {
              if (!showTemplates)
                e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <FileText size={16} />
            Plantillas
          </div>
        </div>
        )}

        {/* ── COLUMN 2: Days / Templates ── */}
        {showDaysColumn && (
        <div
          style={{
            width: isMobile ? '100%' : 200,
            flexShrink: 0,
            backgroundColor: '#fff',
            borderRight: isMobile ? 'none' : '1px solid #e5e7eb',
          }}
        >
          {isMobile && (selectedMemberId || showTemplates) && (
            <div
              onClick={() => {
                setShowTemplates(false)
                setSelectedMemberId(null)
                setSelectedDay(null)
                setSelectedRoutine(null)
                setShowCreateForm(false)
              }}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: 13,
                color: '#DC2626',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              ← {showTemplates ? 'Volver a miembros' : 'Cambiar miembro'}
            </div>
          )}
          {selectedMemberId && !showTemplates ? (
            <>
              {!isMobile && (
              <div
                style={{
                  fontWeight: 600,
                  padding: '12px 16px',
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: 14,
                  color: '#111',
                }}
              >
                {selectedMember?.full_name}
              </div>
              )}
              <div>
                {[1, 2, 3, 4, 5].map((day) => {
                  const routine = routinesByDay[day - 1]
                  const hasRoutine = !!routine
                  const isSelected =
                    selectedDay === day && !showCreateForm && hasRoutine
                  return (
                    <div
                      key={day}
                      onClick={() =>
                        hasRoutine ? handleSelectDay(day) : handleDayPlusClick(day)
                      }
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        fontSize: 13,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: isSelected || (selectedDay === day && showCreateForm)
                          ? '#fee2e2'
                          : 'transparent',
                        borderLeft: isSelected || (selectedDay === day && showCreateForm)
                          ? '3px solid #DC2626'
                          : '3px solid transparent',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected && !(selectedDay === day && showCreateForm))
                          e.currentTarget.style.backgroundColor = '#f9fafb'
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected && !(selectedDay === day && showCreateForm))
                          e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 500, color: '#111' }}>
                          Día {day}
                        </span>
                        {hasRoutine && (
                          <span
                            style={{
                              color: '#6b7280',
                              marginLeft: 4,
                              fontSize: 12,
                            }}
                          >
                            — {routine.name}
                          </span>
                        )}
                        {!hasRoutine && (
                          <span
                            style={{
                              color: '#9ca3af',
                              marginLeft: 4,
                              fontSize: 12,
                            }}
                          >
                            Sin rutina
                          </span>
                        )}
                      </div>
                      {!hasRoutine && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDayPlusClick(day)
                          }}
                          style={{
                            backgroundColor: '#DC2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            padding: '2px 8px',
                            fontSize: 12,
                            cursor: 'pointer',
                            lineHeight: 1.4,
                          }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : showTemplates ? (
            <>
              <div
                style={{
                  fontWeight: 600,
                  padding: '12px 16px',
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: 14,
                  color: '#111',
                }}
              >
                Plantillas
              </div>
              <div>
                {templatesLoading ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      padding: 24,
                    }}
                  >
                    <Loader2
                      size={20}
                      className="animate-spin"
                      style={{ color: '#9ca3af' }}
                    />
                  </div>
                ) : templates.length === 0 ? (
                  <div
                    style={{
                      padding: '10px 16px',
                      fontSize: 13,
                      color: '#9ca3af',
                    }}
                  >
                    No hay plantillas
                  </div>
                ) : (
                  templates.map((t) => {
                    const isSelected = selectedRoutine?.id === t.id
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleSelectTemplate(t)}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          fontSize: 13,
                          color: '#111',
                          backgroundColor: isSelected
                            ? '#fee2e2'
                            : 'transparent',
                          borderLeft: isSelected
                            ? '3px solid #DC2626'
                            : '3px solid transparent',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.backgroundColor = '#f9fafb'
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.backgroundColor =
                              'transparent'
                        }}
                      >
                        {t.name}
                      </div>
                    )
                  })
                )}
                <div style={{ padding: '12px 16px' }}>
                  <button onClick={handleCreateTemplate} style={btnPrimaryStyle}>
                    <Plus size={16} />
                    Nueva plantilla
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: 14,
              }}
            >
              Seleccioná un miembro
            </div>
          )}
        </div>
        )}

        {/* ── COLUMN 3: Editor / Create ── */}
        {showEditorColumn && (
        <div
          style={{
            flex: 1,
            backgroundColor: '#f9fafb',
            padding: isMobile ? 16 : 24,
            minWidth: 0,
          }}
        >
          {isMobile && (selectedRoutine || showCreateForm) && (
            <div
              onClick={() => {
                setSelectedRoutine(null)
                setShowCreateForm(false)
                setSelectedDay(null)
              }}
              style={{
                cursor: 'pointer',
                fontSize: 13,
                color: '#DC2626',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 12,
              }}
            >
              ← Volver a días
            </div>
          )}
          {!selectedRoutine && !showCreateForm && (
            <div
              style={{
                textAlign: 'center',
                padding: '80px 16px',
                color: '#6b7280',
                fontSize: 16,
              }}
            >
              Seleccioná un día para editar la rutina
            </div>
          )}

          {/* ── Create form ── */}
          {showCreateForm && createForDay && (
            <div>
              <div style={cardStyle}>
                <div
                  style={{
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#111',
                    }}
                  >
                    Nueva rutina — Día {createForDay}
                  </h3>
                  <div>
                    <label style={labelStyle}>Nombre</label>
                    <input
                      type="text"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="Ej: Día 1 — Pecho"
                      style={inputStyle}
                      onFocus={(e) =>
                        (e.currentTarget.style.borderColor = '#DC2626')
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.borderColor = '#e5e7eb')
                      }
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>
                      Descripción{' '}
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>
                        (opcional)
                      </span>
                    </label>
                    <textarea
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      placeholder="Describí el propósito de la rutina..."
                      rows={3}
                      style={{
                        ...inputStyle,
                        height: 'auto',
                        padding: '10px 12px',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                      onFocus={(e) =>
                        (e.currentTarget.style.borderColor = '#DC2626')
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.borderColor = '#e5e7eb')
                      }
                    />
                  </div>
                  <button
                    onClick={handleCreateRoutine}
                    disabled={!createName.trim() || createSaving}
                    style={{
                      ...btnPrimaryStyle,
                      opacity:
                        !createName.trim() || createSaving ? 0.6 : 1,
                      cursor:
                        !createName.trim() || createSaving
                          ? 'not-allowed'
                          : 'pointer',
                      alignSelf: 'flex-start',
                    }}
                  >
                    {createSaving ? 'Creando...' : 'Crear rutina'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Editor ── */}
          {selectedRoutine && (
            <div key={selectedRoutine.id}>
              {/* Editor header */}
              <div style={cardStyle}>
                <div style={{ padding: 24 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: 1, marginRight: 16 }}>
                      <input
                        type="text"
                        defaultValue={selectedRoutine.name}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'transparent'
                          e.currentTarget.style.backgroundColor = 'transparent'
                          updateRoutineField('name', e.target.value)
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#DC2626'
                          e.currentTarget.style.backgroundColor = '#fff'
                        }}
                        style={{
                          ...inputStyle,
                          fontSize: 20,
                          fontWeight: 700,
                          height: 44,
                          border: '1px solid transparent',
                          backgroundColor: 'transparent',
                          padding: '0 4px',
                          margin: 0,
                          width: '100%',
                        }}
                      />
                      {selectedRoutine.day_number && (
                        <span
                          style={{
                            display: 'inline-block',
                            backgroundColor: '#fef3c7',
                            color: '#d97706',
                            borderRadius: 4,
                            padding: '2px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            marginTop: 8,
                          }}
                        >
                          Día {selectedRoutine.day_number}
                        </span>
                      )}
                      <textarea
                        defaultValue={selectedRoutine.description ?? ''}
                        placeholder="Descripción (opcional)"
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'transparent'
                          e.currentTarget.style.backgroundColor = 'transparent'
                          updateRoutineField(
                            'description',
                            e.target.value,
                          )
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#DC2626'
                          e.currentTarget.style.backgroundColor = '#fff'
                        }}
                        rows={2}
                        style={{
                          ...inputStyle,
                          height: 'auto',
                          padding: '8px 4px',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          fontSize: 14,
                          border: '1px solid transparent',
                          backgroundColor: 'transparent',
                          marginTop: 8,
                          width: '100%',
                        }}
                      />
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <button
                        onClick={handleDeleteRoutine}
                        style={btnDangerStyle}
                      >
                        <Trash2 size={16} />
                        Eliminar rutina
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Exercises section */}
              <div style={{ marginTop: 16 }}>
                {exercisesLoading ? (
                  isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <SkeletonExerciseCard />
                      <SkeletonExerciseCard />
                      <SkeletonExerciseCard />
                    </div>
                  ) : (
                    <div style={cardStyle}>
                      <SkeletonExerciseRow />
                      <SkeletonExerciseRow />
                      <SkeletonExerciseRow />
                    </div>
                  )
                ) : routineExercises.length === 0 ? (
                  <div
                    style={{
                      ...cardStyle,
                      padding: 24,
                      textAlign: 'center',
                      color: '#6b7280',
                      fontSize: 14,
                    }}
                  >
                    <p style={{ margin: 0 }}>
                      Esta rutina no tiene ejercicios. Agregá el primero con el
                      botón de abajo.
                    </p>
                  </div>
                ) : isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {routineExercises.map((re) => (
                      <div
                        key={re.id}
                        style={{
                          backgroundColor: '#fff',
                          borderRadius: 12,
                          border: '1px solid #e5e7eb',
                          padding: 16,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        {/* Header: order + delete */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#6b7280',
                            }}
                          >
                            #{re.order_index}
                          </span>
                          <IconButton
                            onClick={() => handleDeleteExercise(re)}
                            title="Eliminar"
                            style={{ color: '#DC2626' }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </div>

                        {/* Exercise name */}
                        <input
                          type="text"
                          value={re.exercise.name}
                          onChange={(e) =>
                            updateExerciseExerciseField(
                              re.id,
                              'name',
                              e.target.value,
                            )
                          }
                          onBlur={() => handleExerciseNameBlur(re)}
                          style={inlineInputStyle}
                        />

                        {/* 2x2 grid for numeric fields */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 8,
                          }}
                        >
                          <div>
                            <label
                              style={{
                                ...labelStyle,
                                marginBottom: 2,
                                fontSize: 12,
                              }}
                            >
                              Series
                            </label>
                            {perSetExpanded.has(re.id) ? (
                              <div
                                style={{
                                  ...inlineInputStyle,
                                  textAlign: 'center',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 600,
                                  color: '#111',
                                }}
                              >
                                {re.sets}
                              </div>
                            ) : (
                              <input
                                type="number"
                                min={1}
                                value={re.sets}
                                onChange={(e) =>
                                  updateExerciseField(
                                    re.id,
                                    'sets',
                                    Number(e.target.value),
                                  )
                                }
                                onBlur={() => saveRoutineExerciseRow(re)}
                                style={{
                                  ...inlineInputStyle,
                                  textAlign: 'center',
                                }}
                              />
                            )}
                          </div>
                          <div>
                            <label
                              style={{
                                ...labelStyle,
                                marginBottom: 2,
                                fontSize: 12,
                              }}
                            >
                              Reps
                            </label>
                            {perSetExpanded.has(re.id) ? (
                              <div
                                style={{
                                  ...inlineInputStyle,
                                  textAlign: 'center',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 12,
                                  color: '#9ca3af',
                                  fontStyle: 'italic',
                                }}
                              >
                                por serie
                              </div>
                            ) : (
                              <input
                                type="number"
                                min={1}
                                value={re.reps}
                                onChange={(e) =>
                                  updateExerciseField(
                                    re.id,
                                    'reps',
                                    Number(e.target.value),
                                  )
                                }
                                onBlur={() => saveRoutineExerciseRow(re)}
                                style={{
                                  ...inlineInputStyle,
                                  textAlign: 'center',
                                }}
                              />
                            )}
                          </div>
                          <div>
                            <label
                              style={{
                                ...labelStyle,
                                marginBottom: 2,
                                fontSize: 12,
                              }}
                            >
                              Peso (kg)
                            </label>
                            {perSetExpanded.has(re.id) ? (
                              <div
                                style={{
                                  ...inlineInputStyle,
                                  textAlign: 'center',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 12,
                                  color: '#9ca3af',
                                  fontStyle: 'italic',
                                }}
                              >
                                por serie
                              </div>
                            ) : (
                              <input
                                type="number"
                                step={0.5}
                                min={0}
                                value={re.weight_kg}
                                onChange={(e) =>
                                  updateExerciseField(
                                    re.id,
                                    'weight_kg',
                                    Number(e.target.value),
                                  )
                                }
                                onBlur={() => saveRoutineExerciseRow(re)}
                                style={{
                                  ...inlineInputStyle,
                                  textAlign: 'center',
                                }}
                              />
                            )}
                          </div>
                          <div>
                            <label
                              style={{
                                ...labelStyle,
                                marginBottom: 2,
                                fontSize: 12,
                              }}
                            >
                              Descanso (seg)
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={re.rest_seconds}
                              onChange={(e) =>
                                updateExerciseField(
                                  re.id,
                                  'rest_seconds',
                                  Number(e.target.value),
                                )
                              }
                              onBlur={() => saveRoutineExerciseRow(re)}
                              style={{
                                ...inlineInputStyle,
                                textAlign: 'center',
                              }}
                            />
                          </div>
                        </div>

                        {/* Video */}
                        <div>
                          <label
                            style={{
                              ...labelStyle,
                              marginBottom: 2,
                              fontSize: 12,
                            }}
                          >
                            Video
                          </label>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <input
                              type="text"
                              value={re.exercise.video_url}
                              onChange={(e) =>
                                updateExerciseExerciseField(
                                  re.id,
                                  'video_url',
                                  e.target.value,
                                )
                              }
                              onBlur={() => handleExerciseVideoBlur(re)}
                              style={{
                                ...inlineInputStyle,
                                flex: 1,
                                minWidth: 120,
                              }}
                            />
                            {re.exercise.video_url && (
                              <a
                                href={re.exercise.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: '#6b7280',
                                  display: 'flex',
                                  alignItems: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Progress reference (mobile) */}
                        {memberProgress[re.exercise_id] && memberProgress[re.exercise_id].length > 0 && (
                          <div style={{ backgroundColor: '#f0fdf4', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#16a34a', lineHeight: 1.6 }}>
                            <span style={{ fontWeight: 600 }}>Último:</span>{' '}
                            {memberProgress[re.exercise_id].map(p =>
                              `S${p.set_number}: ${p.current_weight ?? '—'}kg × ${p.current_reps ?? '—'} reps`
                            ).join(' · ')}
                          </div>
                        )}

                          {/* Per-set collapsible section (mobile) */}
                          {re.sets > 1 && (
                            <div>
                              <button
                                onClick={() => togglePerSet(re)}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  color: '#DC2626',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  padding: '4px 0',
                                  textDecoration: 'underline',
                                }}
                              >
                                {perSetExpanded.has(re.id)
                                  ? '✕ Cerrar serie'
                                  : '☰ Por serie'}
                              </button>
                              {perSetExpanded.has(re.id) &&
                                re.sets_data?.map((setDatum, setIdx) => (
                                  <div
                                    key={`${re.id}-set-${setIdx}`}
                                    style={{
                                      display: 'flex',
                                      gap: 8,
                                      alignItems: 'center',
                                      marginTop: 6,
                                      padding: 8,
                                      backgroundColor: '#fafafa',
                                      borderRadius: 8,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: '#6b7280',
                                        minWidth: 48,
                                      }}
                                    >
                                      Serie {setDatum.set}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                      <label
                                        style={{
                                          display: 'block',
                                          fontSize: 10,
                                          color: '#6b7280',
                                          marginBottom: 2,
                                        }}
                                      >
                                        Reps
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        value={setDatum.reps}
                                        onChange={(e) =>
                                          updateExerciseSetField(
                                            re.id,
                                            setIdx,
                                            'reps',
                                            Number(e.target.value),
                                          )
                                        }
                                        onBlur={() =>
                                          saveRoutineExerciseRow(re)
                                        }
                                        style={{
                                          ...inlineInputStyle,
                                          textAlign: 'center',
                                          border: '1px solid #e5e7eb',
                                          backgroundColor: '#fff',
                                          width: '100%',
                                        }}
                                      />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label
                                        style={{
                                          display: 'block',
                                          fontSize: 10,
                                          color: '#6b7280',
                                          marginBottom: 2,
                                        }}
                                      >
                                        Peso (kg)
                                      </label>
                                      <input
                                        type="number"
                                        step={0.5}
                                        min={0}
                                        value={setDatum.weight_kg ?? ''}
                                        onChange={(e) =>
                                          updateExerciseSetField(
                                            re.id,
                                            setIdx,
                                            'weight_kg',
                                            e.target.value === ''
                                              ? null
                                              : Number(e.target.value),
                                          )
                                        }
                                        onBlur={() =>
                                          saveRoutineExerciseRow(re)
                                        }
                                        style={{
                                          ...inlineInputStyle,
                                          textAlign: 'center',
                                          border: '1px solid #e5e7eb',
                                          backgroundColor: '#fff',
                                          width: '100%',
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                    ))}
                  </div>
                ) : (
                  <div style={cardStyle}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr
                          style={{
                            borderBottom: '1px solid #e5e7eb',
                            backgroundColor: '#f9fafb',
                          }}
                        >
                          <Th style={{ width: 40, textAlign: 'center' }}>
                            #
                          </Th>
                          <Th>Ejercicio</Th>
                          <Th style={{ width: 72, textAlign: 'center' }}>
                            Series
                          </Th>
                          <Th style={{ width: 72, textAlign: 'center' }}>
                            Reps
                          </Th>
                          <Th style={{ width: 88, textAlign: 'center' }}>
                            Peso (kg)
                          </Th>
                          <Th style={{ width: 104, textAlign: 'center' }}>
                            Descanso (seg)
                          </Th>
                          <Th>Video</Th>
                          <Th style={{ width: 60, textAlign: 'center' }}>
                            Acciones
                          </Th>
                        </tr>
                      </thead>
                      <tbody>
                        {routineExercises.map((re) => {
                          const isExpanded = perSetExpanded.has(re.id)
                          return (
                            <>
                              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <Td center>{re.order_index}</Td>
                                <Td>
                                  <input
                                    type="text"
                                    value={re.exercise.name}
                                    onChange={(e) =>
                                      updateExerciseExerciseField(
                                        re.id,
                                        'name',
                                        e.target.value,
                                      )
                                    }
                                    onBlur={() => handleExerciseNameBlur(re)}
                                    style={inlineInputStyle}
                                  />
                                </Td>
                                <Td center>
                                  {isExpanded ? (
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 4,
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: 14,
                                          fontWeight: 600,
                                          color: '#111',
                                        }}
                                      >
                                        {re.sets}
                                      </span>
                                      <button
                                        onClick={() => togglePerSet(re)}
                                        style={{
                                          border: 'none',
                                          background: 'none',
                                          color: '#DC2626',
                                          fontSize: 10,
                                          cursor: 'pointer',
                                          fontWeight: 600,
                                          padding: 0,
                                          textDecoration: 'underline',
                                        }}
                                      >
                                        Cerrar serie
                                      </button>
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 4,
                                      }}
                                    >
                                      <input
                                        type="number"
                                        min={1}
                                        value={re.sets}
                                        onChange={(e) =>
                                          updateExerciseField(
                                            re.id,
                                            'sets',
                                            Number(e.target.value),
                                          )
                                        }
                                        onBlur={() => saveRoutineExerciseRow(re)}
                                        style={{
                                          ...inlineInputStyle,
                                          width: 56,
                                          textAlign: 'center',
                                        }}
                                      />
                                      {re.sets > 1 && (
                                        <button
                                          onClick={() => togglePerSet(re)}
                                          style={{
                                            border: 'none',
                                            background: 'none',
                                            color: '#DC2626',
                                            fontSize: 10,
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            padding: 0,
                                            textDecoration: 'underline',
                                          }}
                                        >
                                          Por serie
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </Td>
                                <Td center>
                                  {isExpanded ? (
                                    <span
                                      style={{
                                        fontSize: 12,
                                        color: '#9ca3af',
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      por serie
                                    </span>
                                  ) : (
                                    <input
                                      type="number"
                                      min={1}
                                      value={re.reps}
                                      onChange={(e) =>
                                        updateExerciseField(
                                          re.id,
                                          'reps',
                                          Number(e.target.value),
                                        )
                                      }
                                      onBlur={() => saveRoutineExerciseRow(re)}
                                      style={{
                                        ...inlineInputStyle,
                                        width: 56,
                                        textAlign: 'center',
                                      }}
                                    />
                                  )}
                                </Td>
                                <Td center>
                                  {isExpanded ? (
                                    <span
                                      style={{
                                        fontSize: 12,
                                        color: '#9ca3af',
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      por serie
                                    </span>
                                  ) : (
                                    <input
                                      type="number"
                                      step={0.5}
                                      min={0}
                                      value={re.weight_kg}
                                      onChange={(e) =>
                                        updateExerciseField(
                                          re.id,
                                          'weight_kg',
                                          Number(e.target.value),
                                        )
                                      }
                                      onBlur={() => saveRoutineExerciseRow(re)}
                                      style={{
                                        ...inlineInputStyle,
                                        width: 68,
                                        textAlign: 'center',
                                      }}
                                    />
                                  )}
                                </Td>
                                <Td center>
                                  <input
                                    type="number"
                                    min={0}
                                    value={re.rest_seconds}
                                    onChange={(e) =>
                                      updateExerciseField(
                                        re.id,
                                        'rest_seconds',
                                        Number(e.target.value),
                                      )
                                    }
                                    onBlur={() => saveRoutineExerciseRow(re)}
                                    style={{
                                      ...inlineInputStyle,
                                      width: 68,
                                      textAlign: 'center',
                                    }}
                                  />
                                </Td>
                                <Td>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <input
                                      type="text"
                                      value={re.exercise.video_url}
                                      onChange={(e) =>
                                        updateExerciseExerciseField(
                                          re.id,
                                          'video_url',
                                          e.target.value,
                                        )
                                      }
                                      onBlur={() => handleExerciseVideoBlur(re)}
                                      style={{
                                        ...inlineInputStyle,
                                        flex: 1,
                                        minWidth: 120,
                                      }}
                                    />
                                    {re.exercise.video_url && (
                                      <a
                                        href={re.exercise.video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          color: '#6b7280',
                                          display: 'flex',
                                          alignItems: 'center',
                                          flexShrink: 0,
                                        }}
                                      >
                                        <ExternalLink size={14} />
                                      </a>
                                    )}
                                  </div>
                                </Td>
                                <Td center>
                                  <IconButton
                                    onClick={() => handleDeleteExercise(re)}
                                    title="Eliminar"
                                    style={{ color: '#DC2626' }}
                                  >
                                    <Trash2 size={16} />
                                  </IconButton>
                                </Td>
                              </tr>
                              {/* Progress reference row */}
                              {!isExpanded && memberProgress[re.exercise_id] && memberProgress[re.exercise_id].length > 0 && (
                                <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f0fdf4' }}>
                                  <td colSpan={9} style={{ padding: '4px 16px', fontSize: 11, color: '#16a34a', lineHeight: 1.6 }}>
                                    <span style={{ fontWeight: 600 }}>Último:</span>{' '}
                                    {memberProgress[re.exercise_id].map(p =>
                                      `S${p.set_number}: ${p.current_weight ?? '—'}kg × ${p.current_reps ?? '—'} reps`
                                    ).join(' · ')}
                                  </td>
                                </tr>
                              )}
                              {/* Per-set sub-rows cuando está expandido */}
                              {isExpanded &&
                                re.sets_data?.map((setDatum, setIdx) => (
                                  <tr
                                    key={`${re.id}-set-${setIdx}`}
                                    style={{
                                      borderBottom: '1px solid #e5e7eb',
                                      backgroundColor: '#fafafa',
                                    }}
                                  >
                                    <td
                                      style={{
                                        padding: '6px 12px',
                                        fontSize: 12,
                                        color: '#9ca3af',
                                        textAlign: 'center',
                                        width: 40,
                                      }}
                                    ></td>
                                    <td
                                      style={{
                                        padding: '6px 12px',
                                        fontSize: 12,
                                        color: '#6b7280',
                                        fontWeight: 500,
                                        paddingLeft: 24,
                                      }}
                                    >
                                      Serie {setDatum.set}
                                    </td>
                                    <td
                                      style={{
                                        padding: '6px 12px',
                                        textAlign: 'center',
                                      }}
                                    ></td>
                                    <td
                                      style={{
                                        padding: '6px 12px',
                                        textAlign: 'center',
                                      }}
                                    >
                                      <input
                                        type="number"
                                        min={1}
                                        value={setDatum.reps}
                                        onChange={(e) =>
                                          updateExerciseSetField(
                                            re.id,
                                            setIdx,
                                            'reps',
                                            Number(e.target.value),
                                          )
                                        }
                                        onBlur={() =>
                                          saveRoutineExerciseRow(re)
                                        }
                                        style={{
                                          ...inlineInputStyle,
                                          width: 56,
                                          textAlign: 'center',
                                        }}
                                      />
                                    </td>
                                    <td
                                      style={{
                                        padding: '6px 12px',
                                        textAlign: 'center',
                                      }}
                                    >
                                      <input
                                        type="number"
                                        step={0.5}
                                        min={0}
                                        value={setDatum.weight_kg ?? ''}
                                        onChange={(e) =>
                                          updateExerciseSetField(
                                            re.id,
                                            setIdx,
                                            'weight_kg',
                                            e.target.value === ''
                                              ? null
                                              : Number(e.target.value),
                                          )
                                        }
                                        onBlur={() =>
                                          saveRoutineExerciseRow(re)
                                        }
                                        style={{
                                          ...inlineInputStyle,
                                          width: 68,
                                          textAlign: 'center',
                                        }}
                                      />
                                    </td>
                                    <td
                                      colSpan={3}
                                      style={{
                                        padding: '6px 12px',
                                      }}
                                    ></td>
                                  </tr>
                                ))}
                                </>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <button
                    onClick={handleAddExercise}
                    style={btnPrimaryStyle}
                  >
                    <Plus size={18} />
                    Agregar ejercicio
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </AdminLayout>
  )
}

/* ── Shared Styles ── */

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

const inlineInputStyle: React.CSSProperties = {
  height: 32,
  padding: '0 8px',
  borderRadius: 6,
  border: '1px solid transparent',
  fontSize: 13,
  outline: 'none',
  backgroundColor: 'transparent',
  color: '#111',
  boxSizing: 'border-box',
  width: '100%',
  transition: 'border-color 0.15s',
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

const btnDangerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 38,
  padding: '0 16px',
  borderRadius: 8,
  border: '1px solid #DC2626',
  backgroundColor: '#fff',
  color: '#DC2626',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 4,
}

/* ── Helpers ── */

function buildSetsData(
  sets: number,
  reps: number,
  weight_kg: number | null,
): SetDatum[] {
  return Array.from({ length: sets }, (_, i) => ({
    set: i + 1,
    reps,
    weight_kg,
  }))
}

function Th({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <th
      style={{
        padding: '10px 16px',
        textAlign: 'left',
        fontSize: 12,
        fontWeight: 600,
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        ...style,
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  center,
}: {
  children: React.ReactNode
  center?: boolean
}) {
  return (
    <td
      style={{
        padding: '8px 12px',
        fontSize: 14,
        color: '#111',
        textAlign: center ? 'center' : 'left',
      }}
    >
      {children}
    </td>
  )
}

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

function SkeletonExerciseRow() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid #e5e7eb',
        alignItems: 'center',
      }}
    >
      {[40, 160, 60, 60, 72, 72, 140, 60].map((w, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            height: 14,
            width: w,
            backgroundColor: '#e5e7eb',
            borderRadius: 4,
          }}
        />
      ))}
    </div>
  )
}

function SkeletonExerciseCard() {
  return (
    <div
      className="animate-pulse"
      style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div
          style={{
            height: 14,
            width: 30,
            backgroundColor: '#e5e7eb',
            borderRadius: 4,
          }}
        />
        <div
          style={{
            height: 14,
            width: 20,
            backgroundColor: '#e5e7eb',
            borderRadius: 4,
          }}
        />
      </div>
      <div
        style={{
          height: 32,
          backgroundColor: '#e5e7eb',
          borderRadius: 6,
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}
      >
        <div
          style={{
            height: 56,
            backgroundColor: '#e5e7eb',
            borderRadius: 6,
          }}
        />
        <div
          style={{
            height: 56,
            backgroundColor: '#e5e7eb',
            borderRadius: 6,
          }}
        />
        <div
          style={{
            height: 56,
            backgroundColor: '#e5e7eb',
            borderRadius: 6,
          }}
        />
        <div
          style={{
            height: 56,
            backgroundColor: '#e5e7eb',
            borderRadius: 6,
          }}
        />
      </div>
      <div
        style={{
          height: 32,
          backgroundColor: '#e5e7eb',
          borderRadius: 6,
        }}
      />
    </div>
  )
}
