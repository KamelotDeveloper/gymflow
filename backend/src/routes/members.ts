import { Router } from 'express'
import { supabase } from '../supabase.js'

const router = Router()

// POST /api/members — crear miembro sin afectar sesión del admin
router.post('/', async (req, res) => {
  const { email, password, full_name, phone } = req.body

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, password y full_name son requeridos' })
  }

  // Crear usuario en auth sin iniciar sesión
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  })

  if (error) return res.status(400).json({ error: error.message })

  // Actualizar teléfono si fue enviado
  if (phone && data.user) {
    await supabase
      .from('profiles')
      .update({ phone })
      .eq('id', data.user.id)
  }

  return res.status(201).json({
    message: 'Miembro creado correctamente',
    user: { id: data.user!.id, email: data.user!.email, full_name },
  })
})

export default router
