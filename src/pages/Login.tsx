import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../shared/components/AuthContext'

export default function Login() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { signIn, signUp, user, profile } = useAuthContext()
  const navigate = useNavigate()

  // Redirect si ya está autenticado (en useEffect para no violar reglas de React)
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
