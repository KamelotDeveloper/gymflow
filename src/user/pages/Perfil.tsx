import { useState, useEffect } from 'react'
import { useAuthContext } from '../../shared/components/AuthContext'
import { supabase } from '../../shared/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield, Mail, Home, Trash2 } from 'lucide-react'

export default function UserPerfil() {
  const { profile, user } = useAuthContext()
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showUninstallTip, setShowUninstallTip] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }
  }, [])

  const handleChangePassword = async () => {
    setPwError(null)
    setPwSuccess(false)

    if (newPassword.length < 6) {
      setPwError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Las contraseñas no coinciden')
      return
    }

    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)

    if (error) {
      setPwError(error.message)
      return
    }

    setPwSuccess(true)
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/user')}
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>
        <h1 className="text-xl font-bold text-white">Mi perfil</h1>
      </div>

      {/* Datos del usuario */}
      <div className="bg-[#1a1a1a] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Información personal
        </h2>

        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#DC2626] text-white text-xl font-bold shrink-0">
            {profile?.full_name
              ?.split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) ?? '?'}
          </div>
          <div>
            <p className="text-white font-semibold text-lg">{profile?.full_name}</p>
            <p className="text-gray-400 text-sm capitalize">
              {profile?.role === 'admin' ? 'Administrador' : 'Miembro'}
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3 text-sm">
            <Mail size={16} className="text-gray-500 shrink-0" />
            <span className="text-gray-300">{user?.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Shield size={16} className="text-gray-500 shrink-0" />
            <span className="text-gray-300 capitalize">
              {profile?.role === 'admin' ? 'Administrador' : 'Miembro'}
            </span>
          </div>
        </div>
      </div>

      {/* Cambiar contraseña */}
      <div className="bg-[#1a1a1a] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Cambiar contraseña
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Nueva contraseña
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPwError(null); setPwSuccess(false) }}
              className="w-full px-3 py-2.5 bg-[#111] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPwError(null); setPwSuccess(false) }}
              className="w-full px-3 py-2.5 bg-[#111] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
              placeholder="Repetir contraseña"
            />
          </div>
        </div>

        {pwError && (
          <p className="text-sm text-red-400">{pwError}</p>
        )}
        {pwSuccess && (
          <p className="text-sm text-green-400">¡Contraseña actualizada!</p>
        )}

        <button
          onClick={handleChangePassword}
          disabled={pwSaving}
          className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#DC2626] rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {pwSaving ? 'Guardando...' : 'Guardar contraseña'}
        </button>
      </div>

      {/* Volver al inicio */}
      <button
        onClick={() => navigate('/user')}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-gray-300 bg-[#1a1a1a] rounded-xl hover:bg-white/10 transition-colors"
      >
        <Home size={18} />
        Volver al inicio
      </button>

      {/* Desinstalar app — solo si está instalada como PWA */}
      {isInstalled && (
        <div className="text-center pt-2">
          <button
            onClick={() => setShowUninstallTip(!showUninstallTip)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            <Trash2 size={12} />
            Desinstalar app
          </button>

          {showUninstallTip && (
            <div className="mt-3 bg-[#1a1a1a] rounded-xl p-4 text-left text-xs text-gray-400 space-y-2">
              <p className="font-medium text-gray-300">Para desinstalar:</p>
              {navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad') ? (
                <>
                  <p>1. Abrí Safari</p>
                  <p>2. Tocá el botón <strong>Compartir</strong> (cuadro con flecha arriba)</p>
                  <p>3. Desplazate abajo y tocá <strong>Eliminar "GymFlow"</strong></p>
                </>
              ) : navigator.userAgent.includes('Android') ? (
                <>
                  <p>1. Mantené presionado el ícono de GymFlow</p>
                  <p>2. Tocá <strong>Desinstalar</strong></p>
                </>
              ) : (
                <>
                  <p>1. Abrí Chrome y andá a <span className="text-gray-300">chrome://apps</span></p>
                  <p>2. Click derecho en GymFlow → <strong>Remove from Chrome</strong></p>
                  <p>O: abrí la app, 3 puntitos → <strong>Uninstall GymFlow</strong></p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
