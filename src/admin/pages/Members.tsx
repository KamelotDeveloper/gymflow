import { useState, useEffect, useMemo } from 'react'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import { Search, UserPlus, Pencil, Trash2, X } from 'lucide-react'
import { calculateEndDate } from '../../shared/lib/dates'

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

type Member = {
  id: string
  full_name: string
  phone: string | null
  created_at: string
}

export default function Members() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Multi-step create + activate
  const [step, setStep] = useState<'member' | 'membership'>('member')
  const [formPlanId, setFormPlanId] = useState('')
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0])
  const [plans, setPlans] = useState<any[]>([])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    fetchMembers()
    fetchPlans()
  }, [])

  const fetchMembers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, created_at')
        .eq('role', 'member')
        .order('full_name', { ascending: true })

      if (error) throw error
      setMembers(data ?? [])
    } catch {
      console.error('Error al cargar miembros')
    } finally {
      setLoading(false)
    }
  }

  const fetchPlans = async () => {
    try {
      const { data } = await (supabase as any)
        .from('membership_plans')
        .select('id, name, duration_months, price')
        .eq('is_active', true)
        .order('duration_months', { ascending: true })
      if (data) setPlans(data)
    } catch {
      /* ignore */
    }
  }

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        (m.phone ?? '').toLowerCase().includes(q),
    )
  }, [members, searchQuery])

  const openCreateModal = () => {
    setSelectedMember(null)
    setFormName('')
    setFormPhone('')
    setFormEmail('')
    setFormPassword('')
    setFormError(null)
    setStep('member')
    setFormPlanId('')
    setFormStartDate(new Date().toISOString().split('T')[0])
    setModalMode('create')
  }

  const openEditModal = (member: Member) => {
    setSelectedMember(member)
    setFormName(member.full_name)
    setFormPhone(member.phone ?? '')
    setFormError(null)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setSelectedMember(null)
    setFormName('')
    setFormPhone('')
    setFormEmail('')
    setFormPassword('')
    setFormError(null)
    setStep('member')
    setFormPlanId('')
    setFormStartDate(new Date().toISOString().split('T')[0])
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      setFormError('El nombre es obligatorio.')
      return
    }

    if (modalMode === 'create' && !formEmail.trim()) {
      setFormError('El email es obligatorio.')
      return
    }

    if (modalMode === 'create' && (!formPassword.trim() || formPassword.length < 8)) {
      setFormError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      if (modalMode === 'create') {
        // Retry up to 3 times for Render cold start (free tier sleeps after 15 min)
        let res: Response | undefined
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            res = await fetch(`${API_URL}/api/members`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: formEmail.trim(),
                password: formPassword,
                full_name: formName.trim(),
                phone: formPhone.trim() || undefined,
              }),
            })
            break // success, exit retry loop
          } catch (fetchErr) {
            if (attempt < 3) {
              console.warn(`Intento ${attempt} falló, reintentando en 3s...`)
              await new Promise((r) => setTimeout(r, 3000))
            } else {
              console.error('Fetch error — backend no responde:', fetchErr)
              throw new Error(
                `No se puede conectar con el backend (${API_URL}). ` +
                'Asegurate de que el servidor esté corriendo y el CORS permita este origen.',
              )
            }
          }
        }
        if (!res) throw new Error('Error inesperado al conectar con el backend.')

        let data: any
        try {
          data = await res.json()
          console.log('Backend response:', res.status, data)
        } catch {
          const text = await res.text().catch(() => '')
          throw new Error(`Error ${res.status} — respuesta inválida: ${text || '(sin cuerpo)'}`)
        }

        if (!res.ok) throw new Error(data.error || `Error ${res.status} del servidor`)

        // If step 2 with membership, also create membership
        if (step === 'membership' && formPlanId && formStartDate) {
          const plan = plans.find((p: any) => p.id === formPlanId)
          if (plan) {
            const endDate = calculateEndDate(formStartDate, plan.duration_months)
            const { error: memError } = await (supabase.from('memberships') as any).insert({
              profile_id: data.user.id,
              plan_id: formPlanId,
              start_date: formStartDate,
              end_date: endDate,
              status: 'active',
              admin_override: false,
            })
            if (memError) {
              alert(`Miembro creado, pero la membresía no pudo activarse: ${memError.message}`)
            } else {
              alert('Miembro creado con membresía activa.')
            }
          }
        } else {
          alert('Miembro creado con éxito.')
        }
      } else if (modalMode === 'edit' && selectedMember) {
        const { error } = await (supabase.from('profiles') as any)
          .update({
            full_name: formName.trim(),
            phone: formPhone.trim() || null,
          })
          .eq('id', selectedMember.id)
        if (error) throw error
      }

      closeModal()
      await fetchMembers()
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

  const handleDelete = async (member: Member) => {
    if (!window.confirm(`¿Estás seguro de eliminar a "${member.full_name}"?`)) return

    try {
      const { error } = await (supabase.from('profiles') as any)
        .delete()
        .eq('id', member.id)
      if (error) throw error
      await fetchMembers()
    } catch (err) {
      console.error('Error al eliminar miembro:', err)
    }
  }

  return (
    <AdminLayout pageTitle="Miembros">
      {/* ── Top bar ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, maxWidth: isMobile ? '100%' : 360 }}>
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
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#DC2626')}
            onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
          />
        </div>

        <button onClick={openCreateModal} style={{ ...btnPrimaryStyle, justifyContent: 'center' }}>
          <UserPlus size={18} />
          Nuevo miembro
        </button>
      </div>

      {/* ── Desktop table / Mobile cards ── */}
      {filteredMembers.length === 0 && !loading ? (
        <div
          style={{
            backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
            textAlign: 'center', padding: '48px 16px', color: '#6b7280', fontSize: 14,
          }}
        >
          {searchQuery.trim()
            ? 'No se encontraron miembros con ese criterio.'
            : 'No hay miembros registrados aún.'}
        </div>
      ) : isMobile ? (
        /* ── Mobile cards ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading
            ? [1, 2, 3, 4, 5].map((i) => <MobileMemberCardSkeleton key={i} />)
            : filteredMembers.map((member) => (
                <div
                  key={member.id}
                  style={{
                    backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
                    padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{member.full_name}</div>
                      <div style={{ fontSize: 13, color: '#9ca3af' }}>{member.phone ?? 'Sin teléfono'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <IconButton onClick={() => openEditModal(member)} title="Editar">
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton onClick={() => handleDelete(member)} title="Eliminar" style={{ color: '#DC2626' }}>
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    Alta: {new Date(member.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })}
                  </div>
                </div>
              ))}
        </div>
      ) : (
        /* ── Desktop table ── */
        <div style={cardStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <Th>Nombre</Th>
                <Th>Email</Th>
                <Th>Teléfono</Th>
                <Th>Fecha de alta</Th>
                <Th style={{ width: 80 }}>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <Td>{member.full_name}</Td>
                    <Td>
                      <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 13 }}>-</span>
                    </Td>
                    <Td>{member.phone ?? '-'}</Td>
                    <Td>
                      {new Date(member.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                      })}
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <IconButton onClick={() => openEditModal(member)} title="Editar">
                          <Pencil size={16} />
                        </IconButton>
                        <IconButton onClick={() => handleDelete(member)} title="Eliminar" style={{ color: '#DC2626' }}>
                          <Trash2 size={16} />
                        </IconButton>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ── */}
      {modalMode && (
        <div style={overlayStyle} onClick={closeModal}>
          <div
            style={modalCardStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111' }}>
                {modalMode === 'create' ? 'Nuevo miembro' : 'Editar miembro'}
              </h2>
              {modalMode === 'create' && (
                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                  Paso {step === 'member' ? 1 : 2} de 2
                </span>
              )}
              <button onClick={closeModal} style={iconBtnCleanStyle}>
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {modalMode === 'edit' ? (
                <>
                  <div>
                    <label style={labelStyle}>
                      Nombre completo <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = '#DC2626')}
                      onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Teléfono{' '}
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="Ej: +54 11 1234 5678"
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = '#DC2626')}
                      onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                    />
                  </div>

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
                </>
              ) : step === 'member' ? (
                <>
                  <div>
                    <label style={labelStyle}>
                      Nombre completo <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = '#DC2626')}
                      onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Correo electrónico <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="Ej: juan@example.com"
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = '#DC2626')}
                      onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Contraseña temporal <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = '#DC2626')}
                      onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                    />
                    <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                      Esta contraseña es temporal. Entregásela al miembro en mano.
                    </p>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Teléfono{' '}
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="Ej: +54 11 1234 5678"
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = '#DC2626')}
                      onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
                    />
                  </div>

                  {formError && (
                    <p style={{ margin: 0, fontSize: 13, color: '#DC2626' }}>{formError}</p>
                  )}

                  {/* Activate membership button */}
                  <button
                    onClick={() => setStep('membership')}
                    style={{
                      ...btnSecondaryStyle,
                      width: '100%',
                      justifyContent: 'center',
                      marginTop: 8,
                    }}
                  >
                    Activar membresía →
                  </button>

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
                </>
              ) : (
                <>
                  {/* Back button */}
                  <button
                    onClick={() => setStep('member')}
                    style={{
                      ...btnSecondaryStyle,
                      alignSelf: 'flex-start',
                      justifyContent: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    ← Volver
                  </button>

                  {/* Plan selector */}
                  <div>
                    <label style={labelStyle}>
                      Plan <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select
                      value={formPlanId}
                      onChange={(e) => setFormPlanId(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Seleccionar plan...</option>
                      {plans.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(p.price)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Start date */}
                  <div>
                    <label style={labelStyle}>Fecha de inicio</label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  {/* Computed end date */}
                  {formPlanId && formStartDate && (() => {
                    const plan = plans.find((p: any) => p.id === formPlanId)
                    if (!plan) return null
                    const endDate = calculateEndDate(formStartDate, plan.duration_months)
                    return (
                      <div>
                        <label style={{ ...labelStyle, color: '#9ca3af' }}>Vencimiento</label>
                        <p style={{ fontSize: 14, color: '#111', fontWeight: 500 }}>
                          {new Date(endDate + 'T00:00:00').toLocaleDateString('es-AR')}
                        </p>
                      </div>
                    )
                  })()}

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
                      {saving ? 'Guardando...' : 'Crear y activar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

/* ── Shared styles ── */

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 12px',
  paddingLeft: 38,
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 14,
  outline: 'none',
  backgroundColor: '#fff',
  color: '#111',
  boxSizing: 'border-box',
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
  backgroundColor: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
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
  maxWidth: 448,
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

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: '12px 16px', fontSize: 14, color: '#111' }}>
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

function MobileMemberCardSkeleton() {
  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
      padding: 16, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div className="animate-pulse" style={{ height: 14, width: '60%', backgroundColor: '#e5e7eb', borderRadius: 4 }} />
      <div className="animate-pulse" style={{ height: 14, width: '40%', backgroundColor: '#e5e7eb', borderRadius: 4 }} />
      <div className="animate-pulse" style={{ height: 12, width: '30%', backgroundColor: '#e5e7eb', borderRadius: 4 }} />
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr>
      <td style={{ padding: '12px 16px' }}>
        <div
          className="animate-pulse"
          style={{ height: 14, width: 140, backgroundColor: '#e5e7eb', borderRadius: 4 }}
        />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div
          className="animate-pulse"
          style={{ height: 14, width: 180, backgroundColor: '#e5e7eb', borderRadius: 4 }}
        />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div
          className="animate-pulse"
          style={{ height: 14, width: 120, backgroundColor: '#e5e7eb', borderRadius: 4 }}
        />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div
          className="animate-pulse"
          style={{ height: 14, width: 100, backgroundColor: '#e5e7eb', borderRadius: 4 }}
        />
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div
          className="animate-pulse"
          style={{ height: 14, width: 60, backgroundColor: '#e5e7eb', borderRadius: 4 }}
        />
      </td>
    </tr>
  )
}
