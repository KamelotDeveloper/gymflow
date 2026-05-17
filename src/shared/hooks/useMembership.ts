import { supabase } from '../lib/supabase'

type MembershipResult = {
  end_date: string
  status: string
  admin_override: boolean
} | null

export async function fetchActiveMembership(profileId: string): Promise<MembershipResult> {
  console.log('🔍 fetchActiveMembership — profile.id:', profileId)
  try {
    const { data, error } = await (supabase as any)
      .from('memberships')
      .select('end_date, status, admin_override')
      .eq('profile_id', profileId)
      .order('end_date', { ascending: false })
      .limit(1)
      .single()

    console.log('📦 membresía data:', data, 'error:', error)
    return data as MembershipResult
  } catch (err) {
    console.log('❌ fetchActiveMembership error:', err)
    return null
  }
}

export function checkMembership(membership: MembershipResult) {
  console.log('🔍 checkMembership — input:', membership)

  if (!membership) {
    console.log('status calculado: sin_membresía')
    return { valid: false, reason: 'Sin membresía' }
  }

  const today = new Date()
  const endDate = new Date(membership.end_date)
  const diff = Math.ceil((endDate.getTime() - today.getTime()) / 86400000)

  const expiredByDate = diff <= 0
  const expiredByStatus = membership.status === 'expired'
  const hasOverride = membership.admin_override

  console.log('status calculado:', {
    status: membership.status,
    end_date: membership.end_date,
    daysLeft: diff,
    expiredByDate,
    expiredByStatus,
    hasOverride,
  })

  if (expiredByStatus && !hasOverride) {
    console.log('→ resultado: BLOQUEAR (status expired + sin override)')
    return { valid: false, reason: 'Vencida' }
  }

  if (expiredByDate && !hasOverride) {
    console.log('→ resultado: BLOQUEAR (fecha vencida + sin override)')
    return { valid: false, reason: 'Vencida' }
  }

  console.log('→ resultado: OK')
  return { valid: true, reason: null }
}
