import { useState, useEffect, useMemo } from 'react'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import { Search, UserPlus, Pencil, Trash2, X } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

type Member = {
  id: string
  full_name: string
  phone: string | null
  created_at: string
}

export default function Members() {
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

  useEffect(() => {
    fetchMembers()
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
        const res = await fetch(`${API_URL}/api/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formEmail.trim(),
            password: formPassword,
            full_name: formName.trim(),
            phone: formPhone.trim() || undefined,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al crear miembro')

        alert('Miembro creado con éxito.')
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
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
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
            placeholder="Buscar por nombre o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#DC2626')}
            onBlur={(e) => (e.target.style.borderColor = '#e5e7eb')}
          />
        </div>

        <button onClick={openCreateModal} style={btnPrimaryStyle}>
          <UserPlus size={18} />
          Nuevo miembro
        </button>
      </div>

      {/* ── Table ── */}
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
            ) : filteredMembers.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: 'center',
                    padding: '48px 16px',
                    color: '#6b7280',
                    fontSize: 14,
                  }}
                >
                  {searchQuery.trim()
                    ? 'No se encontraron miembros con ese criterio.'
                    : 'No hay miembros registrados aún.'}
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => (
                <tr
                  key={member.id}
                  style={{ borderBottom: '1px solid #e5e7eb' }}
                >
                  <Td>{member.full_name}</Td>
                  <Td>
                    <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 13 }}>
                      -
                    </span>
                    {/* TODO: email disponible vía auth.admin API solo desde backend seguro */}
                  </Td>
                  <Td>{member.phone ?? '-'}</Td>
                  <Td>
                    {new Date(member.created_at).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <IconButton
                        onClick={() => openEditModal(member)}
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton
                        onClick={() => handleDelete(member)}
                        title="Eliminar"
                        style={{ color: '#DC2626' }}
                      >
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
              <button onClick={closeModal} style={iconBtnCleanStyle}>
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
