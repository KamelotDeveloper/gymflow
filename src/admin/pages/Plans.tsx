import { useState, useEffect } from 'react'
import AdminLayout from '../../shared/components/AdminLayout'
import { supabase } from '../../shared/lib/supabase'
import { Plus, Settings2, X } from 'lucide-react'

function calculateEndDate(startDate: string, durationMonths: number): string {
  const date = new Date(startDate)
  const day = date.getDate()
  date.setMonth(date.getMonth() + durationMonths)
  if (date.getDate() !== day) {
    date.setDate(0)
  }
  return date.toISOString().split('T')[0]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function Plans() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // Data
  const [memberships, setMemberships] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCount, setActiveCount] = useState(0)
  const [expiredCount, setExpiredCount] = useState(0)
  const [overrideCount, setOverrideCount] = useState(0)

  // Modal
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [selectedMembership, setSelectedMembership] = useState<any>(null)

  // Form
  const [formProfileId, setFormProfileId] = useState('')
  const [formPlanId, setFormPlanId] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formStatus, setFormStatus] = useState('active')
  const [formOverride, setFormOverride] = useState(false)
  const [formOverrideReason, setFormOverrideReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      // Counts
      const [activeRes, expiredRes, overrideRes] = await Promise.all([
        supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'expired'),
        supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('admin_override', true),
      ])
      setActiveCount(activeRes.count ?? 0)
      setExpiredCount(expiredRes.count ?? 0)
      setOverrideCount(overrideRes.count ?? 0)

      // Memberships with nested join
      const { data: memData, error: memError } = await (
        supabase.from('memberships') as any
      )
        .select(
          `
          id,
          start_date,
          end_date,
          status,
          admin_override,
          override_reason,
          profile_id,
          plan_id,
          profile:profiles(id, full_name),
          plan:membership_plans(id, name, duration_months)
        `,
        )
        .order('end_date', { ascending: true })

      if (memError) throw memError
      setMemberships(memData ?? [])

      // Profiles for member select (role=member)
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'member')
        .order('full_name', { ascending: true })
      setProfiles(profData ?? [])

      // Active plans for plan select
      const { data: planData } = await supabase
        .from('membership_plans')
        .select('id, name, duration_months')
        .eq('is_active', true)
        .order('name', { ascending: true })
      setPlans(planData ?? [])
    } catch {
      console.error('Error al cargar membresías')
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = (preSelectedProfileId?: string) => {
    setSelectedMembership(null)
    setFormProfileId(preSelectedProfileId ?? '')
    setFormPlanId('')
    setFormStartDate(new Date().toISOString().split('T')[0])
    setFormStatus('active')
    setFormOverride(false)
    setFormOverrideReason('')
    setFormError(null)
    setModalMode('create')
  }

  const openEditModal = (membership: any) => {
    setSelectedMembership(membership)
    setFormProfileId(membership.profile_id)
    setFormPlanId(membership.plan_id)
    setFormStartDate(membership.start_date?.split('T')[0] ?? '')
    setFormStatus(membership.status)
    setFormOverride(membership.admin_override)
    setFormOverrideReason(membership.override_reason ?? '')
    setFormError(null)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setSelectedMembership(null)
    setFormProfileId('')
    setFormPlanId('')
    setFormStartDate('')
    setFormStatus('active')
    setFormOverride(false)
    setFormOverrideReason('')
    setFormError(null)
  }

  const handleSave = async () => {
    // Validate
    if (!formProfileId) {
      setFormError('Debés seleccionar un miembro.')
      return
    }
    if (!formPlanId) {
      setFormError('Debés seleccionar un plan.')
      return
    }
    if (!formStartDate) {
      setFormError('Debés seleccionar una fecha de inicio.')
      return
    }
    if (formOverride && !formOverrideReason.trim()) {
      setFormError('Debés ingresar una razón para el override.')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const selectedPlan = plans.find((p) => p.id === formPlanId)
      if (!selectedPlan) throw new Error('Plan no encontrado')
      const endDate = calculateEndDate(
        formStartDate,
        selectedPlan.duration_months,
      )

      if (modalMode === 'create') {
        const { error } = await (supabase.from('memberships') as any).insert({
          profile_id: formProfileId,
          plan_id: formPlanId,
          start_date: formStartDate,
          end_date: endDate,
          status: 'active',
          admin_override: false,
        })
        if (error) throw error
      } else if (modalMode === 'edit' && selectedMembership) {
        const { error } = await (supabase.from('memberships') as any)
          .update({
            plan_id: formPlanId,
            start_date: formStartDate,
            end_date: endDate,
            status: formStatus,
            admin_override: formOverride,
            override_reason: formOverrideReason.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedMembership.id)
        if (error) throw error
      }

      closeModal()
      await fetchAll()
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

  // Computed end date for plan preview
  const computedEndDate = (() => {
    if (!formPlanId || !formStartDate) return null
    const selectedPlan = plans.find((p) => p.id === formPlanId)
    if (!selectedPlan) return null
    return calculateEndDate(formStartDate, selectedPlan.duration_months)
  })()

  const statusLabels: Record<string, string> = {
    active: 'Activa',
    expired: 'Vencida',
    suspended: 'Suspendida',
    pending: 'Pendiente',
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    expired: 'bg-red-100 text-red-800',
    suspended: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-gray-100 text-gray-600',
  }

  const statusBgColors: Record<string, string> = {
    active: '#dcfce7',
    expired: '#fee2e2',
    suspended: '#fef9c3',
    pending: '#f3f4f6',
  }

  const statusTextColors: Record<string, string> = {
    active: '#166534',
    expired: '#991b1b',
    suspended: '#854d0e',
    pending: '#4b5563',
  }

  // Check if a member already has any active membership
  const memberHasActive = (profileId: string): boolean => {
    return memberships.some(
      (m) => m.profile_id === profileId && m.status === 'active',
    )
  }

  return (
    <AdminLayout pageTitle="Membresías">
      {/* ── Summary cards ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {/* Card: Activas */}
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
            style={{ fontWeight: 700, fontSize: 28, color: '#111' }}
          >
            {loading ? '-' : activeCount}
          </div>
          <div style={{ color: '#6b7280', fontSize: 12 }}>Activas</div>
        </div>

        {/* Card: Vencidas */}
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
            style={{ fontWeight: 700, fontSize: 28, color: '#DC2626' }}
          >
            {loading ? '-' : expiredCount}
          </div>
          <div style={{ color: '#6b7280', fontSize: 12 }}>Vencidas</div>
        </div>

        {/* Card: Con override */}
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
            style={{ fontWeight: 700, fontSize: 28, color: '#f59e0b' }}
          >
            {loading ? '-' : overrideCount}
          </div>
          <div style={{ color: '#6b7280', fontSize: 12 }}>
            Con override
          </div>
        </div>

        {/* Spacer — hidden on mobile */}
        {!isMobile && <div style={{ flex: 1 }} />}

        {/* Button */}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => openCreateModal()}
            style={{
              ...btnPrimaryStyle,
              width: isMobile ? '100%' : undefined,
              justifyContent: isMobile ? 'center' : undefined,
            }}
          >
            <Plus size={18} />
            Nueva membresía
          </button>
        </div>
      </div>

      {/* ── Desktop table / Mobile cards ── */}
      {memberships.length === 0 && !loading ? (
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            textAlign: 'center',
            padding: '48px 16px',
            color: '#6b7280',
            fontSize: 14,
          }}
        >
          No hay membresías registradas aún.
        </div>
      ) : isMobile ? (
        /* ── Mobile cards ── */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginBottom: 24,
          }}
        >
          {loading
            ? [1, 2, 3, 4, 5].map((i) => (
                <MobilePlanCardSkeleton key={i} />
              ))
            : memberships.map((mem) => (
                <div
                  key={mem.id}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {/* Header: name + plan + actions */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 15,
                          color: '#111',
                        }}
                      >
                        {mem.profile?.full_name ?? '-'}
                      </div>
                      <div
                        style={{ fontSize: 13, color: '#6b7280' }}
                      >
                        {mem.plan?.name ?? '-'}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      <IconButton
                        onClick={() => openEditModal(mem)}
                        title="Editar"
                      >
                        <Settings2 size={16} />
                      </IconButton>
                      {!memberHasActive(mem.profile_id) && (
                        <IconButton
                          onClick={() =>
                            openCreateModal(mem.profile_id)
                          }
                          title="Asignar nueva membresía"
                        >
                          <Plus size={16} />
                        </IconButton>
                      )}
                    </div>
                  </div>

                  {/* Inicio */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                      Inicio
                    </span>
                    <span style={{ fontSize: 13, color: '#111' }}>
                      {formatDate(mem.start_date)}
                    </span>
                  </div>

                  {/* Vence */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                      Vence
                    </span>
                    <span style={{ fontSize: 13, color: '#111' }}>
                      {formatDate(mem.end_date)}
                    </span>
                  </div>

                  {/* Status + override */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 4,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor:
                          statusBgColors[mem.status] ?? '#f3f4f6',
                        color:
                          statusTextColors[mem.status] ?? '#4b5563',
                      }}
                    >
                      {statusLabels[mem.status] ?? mem.status}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: mem.admin_override
                          ? '#f59e0b'
                          : '#9ca3af',
                        fontWeight: mem.admin_override ? 600 : 400,
                      }}
                    >
                      {mem.admin_override
                        ? 'Override: Sí'
                        : 'Override: No'}
                    </span>
                  </div>
                </div>
              ))}
        </div>
      ) : (
        /* ── Desktop table ── */
        <div style={cardStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                }}
              >
                <Th>Miembro</Th>
                <Th>Plan</Th>
                <Th>Inicio</Th>
                <Th>Vence</Th>
                <Th>Estado</Th>
                <Th>Override</Th>
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
                memberships.map((mem) => (
                  <tr
                    key={mem.id}
                    style={{ borderBottom: '1px solid #e5e7eb' }}
                  >
                    <Td>{mem.profile?.full_name ?? '-'}</Td>
                    <Td>{mem.plan?.name ?? '-'}</Td>
                    <Td>{formatDate(mem.start_date)}</Td>
                    <Td>{formatDate(mem.end_date)}</Td>
                    <Td>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[mem.status] ?? statusColors.pending}`}
                      >
                        {statusLabels[mem.status] ?? mem.status}
                      </span>
                    </Td>
                    <Td>
                      {mem.admin_override ? (
                        <span
                          style={{
                            color: '#f59e0b',
                            fontWeight: 600,
                            fontSize: 13,
                          }}
                        >
                          Sí
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>-</span>
                      )}
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <IconButton
                          onClick={() => openEditModal(mem)}
                          title="Editar"
                        >
                          <Settings2 size={16} />
                        </IconButton>
                        {!memberHasActive(mem.profile_id) && (
                          <IconButton
                            onClick={() =>
                              openCreateModal(mem.profile_id)
                            }
                            title="Asignar nueva membresía"
                          >
                            <Plus size={16} />
                          </IconButton>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Modal ── */}
      {modalMode === 'create' && (
        <div style={overlayStyle} onClick={closeModal}>
          <div
            style={modalCardStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={modalHeaderStyle}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#111',
                }}
              >
                Nueva membresía
              </h2>
              <button onClick={closeModal} style={iconBtnCleanStyle}>
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Member select */}
              <div>
                <label style={labelStyle}>
                  Miembro{' '}
                  <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={formProfileId}
                  onChange={(e) => setFormProfileId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">
                    Seleccionar miembro...
                  </option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plan select */}
              <div>
                <label style={labelStyle}>
                  Plan{' '}
                  <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={formPlanId}
                  onChange={(e) => setFormPlanId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Seleccionar plan...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {computedEndDate && (
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 12,
                      color: '#6b7280',
                      fontStyle: 'italic',
                    }}
                  >
                    Vence el {formatDate(computedEndDate)}
                  </p>
                )}
              </div>

              {/* Start date */}
              <div>
                <label style={labelStyle}>
                  Fecha de inicio{' '}
                  <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {formError && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: '#DC2626',
                  }}
                >
                  {formError}
                </p>
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

      {/* ── Edit Modal ── */}
      {modalMode === 'edit' && (
        <div style={overlayStyle} onClick={closeModal}>
          <div
            style={modalCardStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={modalHeaderStyle}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#111',
                }}
              >
                Editar membresía
              </h2>
              <button onClick={closeModal} style={iconBtnCleanStyle}>
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Member display (read-only) */}
              <div>
                <label style={labelStyle}>Miembro</label>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: '#111',
                    padding: '8px 0',
                  }}
                >
                  {selectedMembership?.profile?.full_name ?? '-'}
                </p>
              </div>

              {/* Plan select */}
              <div>
                <label style={labelStyle}>Plan</label>
                <select
                  value={formPlanId}
                  onChange={(e) => setFormPlanId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Seleccionar plan...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {computedEndDate && (
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 12,
                      color: '#6b7280',
                      fontStyle: 'italic',
                    }}
                  >
                    Vence el {formatDate(computedEndDate)}
                  </p>
                )}
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

              {/* Status */}
              <div>
                <label style={labelStyle}>Estado</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  style={selectStyle}
                >
                  <option value="active">Activa</option>
                  <option value="expired">Vencida</option>
                  <option value="suspended">Suspendida</option>
                  <option value="pending">Pendiente</option>
                </select>
              </div>

              {/* Override checkbox */}
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formOverride}
                    onChange={(e) => {
                      setFormOverride(e.target.checked)
                      if (!e.target.checked)
                        setFormOverrideReason('')
                    }}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: 'pointer',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#374151',
                    }}
                  >
                    Override manual
                  </span>
                </label>
              </div>

              {/* Override reason (visible only if checked) */}
              {formOverride && (
                <div>
                  <label style={labelStyle}>
                    Razón del override{' '}
                    <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <textarea
                    value={formOverrideReason}
                    onChange={(e) =>
                      setFormOverrideReason(e.target.value)
                    }
                    placeholder="Explicar por qué se extiende el acceso..."
                    rows={3}
                    style={{
                      ...inputStyle,
                      height: 'auto',
                      padding: '10px 12px',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              )}

              {formError && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: '#DC2626',
                  }}
                >
                  {formError}
                </p>
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
  maxWidth: 480,
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
  const widths = [140, 100, 90, 90, 80, 60, 60]
  return (
    <tr>
      {widths.map((w, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <div
            className="animate-pulse"
            style={{
              height: 14,
              width: w,
              backgroundColor: '#e5e7eb',
              borderRadius: 4,
            }}
          />
        </td>
      ))}
    </tr>
  )
}

function MobilePlanCardSkeleton() {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        className="animate-pulse"
        style={{
          height: 14,
          width: '60%',
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
        }}
      />
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
          width: '45%',
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          height: 14,
          width: '35%',
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
        }}
      />
      <div
        className="animate-pulse"
        style={{
          height: 14,
          width: '25%',
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
        }}
      />
    </div>
  )
}
