import { supabase } from '../supabase.js'

export async function expireMemberships() {
  console.log('[CRON] Verificando membresías vencidas...')
  const { error } = await supabase.rpc('expire_memberships')
  if (error) console.error('[CRON] Error:', error.message)
  else console.log('[CRON] Membresías actualizadas correctamente')
}
