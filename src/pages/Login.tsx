import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../shared/components/AuthContext'
import { Download, Smartphone, Shield } from 'lucide-react'

export default function Login() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [_isInstalled, setIsInstalled] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const { signIn, signUp, user, profile } = useAuthContext()
  const navigate = useNavigate()

  // Detect PWA installability
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      setShowLogin(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Redirect si ya está autenticado
  useEffect(() => {
    if (user && profile) {
      const target = profile.role === 'admin' ? '/admin/dashboard' : '/user'
      navigate(target, { replace: true })
    }
  }, [user, profile, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setSubmitting(true)
    try {
      await signUp(email, password, fullName)
      setSuccessMsg('Revisá tu email para confirmar tu cuenta')
      setTab('login')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrarse')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstallPrompt(null)
      setIsInstalled(true)
      setShowLogin(true)
    }
  }

  // ── Splash de instalación ──
  if (installPrompt && !showLogin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center">
        <div className="mb-8 flex items-center justify-center w-20 h-20 rounded-2xl bg-[#DC2626] shadow-lg">
          <span className="text-3xl font-black text-white">GF</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">GymFlow</h1>
        <p className="text-gray-400 mb-8 max-w-xs">
          Instalá la app para llevar tu entrenamiento siempre con vos
        </p>

        <div className="space-y-3 w-full max-w-xs mb-8">
          <div className="flex items-center gap-3 bg-[#1a1a1a] rounded-xl p-4 text-left">
            <Smartphone size={20} className="text-[#DC2626] shrink-0" />
            <p className="text-sm text-gray-300">Sin navegador, como una app nativa</p>
          </div>
          <div className="flex items-center gap-3 bg-[#1a1a1a] rounded-xl p-4 text-left">
            <Shield size={20} className="text-[#DC2626] shrink-0" />
            <p className="text-sm text-gray-300">Acceso rápido desde tu pantalla de inicio</p>
          </div>
        </div>

        <button
          onClick={handleInstall}
          className="flex items-center justify-center gap-2 w-full max-w-xs rounded-xl bg-[#DC2626] px-6 py-3.5 text-base font-bold text-white hover:bg-red-700 transition-colors"
        >
          <Download size={20} />
          Instalar app
        </button>

        <button
          onClick={() => setShowLogin(true)}
          className="mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Ya tenés la app? Iniciar sesión
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <h1 className="mb-8 text-center text-4xl font-bold text-gray-900">
          GymFlow
        </h1>

        {/* Card */}
        <div className="rounded-xl bg-white p-8 shadow-lg">
          {/* Tabs */}
          <div className="mb-6 flex border-b border-gray-200">
            <button
              onClick={() => { setTab('login'); setError(''); setSuccessMsg('') }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                tab === 'login'
                  ? 'border-b-2 border-red-600 text-red-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); setSuccessMsg('') }}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${
                tab === 'register'
                  ? 'border-b-2 border-red-600 text-red-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Registrarse
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {successMsg}
            </div>
          )}

          {/* Login form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  placeholder="tu@email.com"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
          )}

          {/* Register form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="mb-1 block text-sm font-medium text-gray-700">
                  Nombre completo
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  placeholder="Juan Pérez"
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  placeholder="tu@email.com"
                />
              </div>
              <div>
                <label htmlFor="reg-password" className="mb-1 block text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label htmlFor="reg-confirm" className="mb-1 block text-sm font-medium text-gray-700">
                  Confirmar contraseña
                </label>
                <input
                  id="reg-confirm"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
