import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type GymConfig = {
  id: string
  gym_name: string
  logo_url: string | null
  primary_color: string | null
  whatsapp: string | null
  address: string | null
  updated_at: string
}

export function useGymConfig() {
  const [config, setConfig] = useState<GymConfig | null>(null)

  useEffect(() => {
    ;(supabase as any)
      .from('gym_config')
      .select('*')
      .single()
      .then(({ data }: any) => {
        if (data) setConfig(data as GymConfig)
      })
      .catch(() => {
        // table might not exist yet
      })
  }, [])

  return { config }
}
