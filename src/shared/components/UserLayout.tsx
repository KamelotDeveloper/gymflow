import { useState, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthContext } from './AuthContext'
import { useGymConfig } from '../hooks/useGymConfig'
import MembershipGate from './MembershipGate'
import {
  Home,
  ClipboardList,
  CreditCard,
  BarChart2,
  Dumbbell,
  LogOut,
  Menu,
  X,
  Lock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type NavItem = {
  icon: typeof Home
  label: string
  path: string
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Inicio', path: '/user' },
  { icon: ClipboardList, label: 'Mi rutina', path: '/user/rutina' },
  { icon: Dumbbell, label: 'Ejercicios', path: '/user/ejercicios' },
  { icon: CreditCard, label: 'Membresía', path: '/user/membresia' },
  { icon: BarChart2, label: 'Mi progreso', path: '/user/progreso' },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatDateSpanish(date: Date): string {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${dias[date.getDay()]} · ${date.getDate()} de ${meses[date.getMonth()]}`
}

type Props = {
  children: ReactNode
}

export default function UserLayout({ children }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pwModalOpen, setPwModalOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const { profile, signOut } = useAuthContext()
  const { config } = useGymConfig()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

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
    setTimeout(() => setPwModalOpen(false), 1500)
  }

  const handleNav = (path: string) => {
    setDrawerOpen(false)
    navigate(path)
  }

  const isActive = (path: string) => {
    if (path === '/user') return location.pathname === '/user'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* ── Fixed Header ── */}
      <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-14 px-4 bg-[#111] text-white">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>

          {config?.logo_url ? (
          <img src={config.logo_url} alt="Logo" className="h-8" />
        ) : (
          <span className="text-base font-bold tracking-wide">{config?.gym_name || 'GymFlow'}</span>
        )}

        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#DC2626] text-white text-sm font-bold">
          {profile ? getInitials(profile.full_name) : '?'}
        </div>
      </header>

      {/* ── Drawer Overlay ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Drawer ── */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-[260px] bg-[#111] text-white flex flex-col transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-white/10">
        <span className="text-base font-bold tracking-wide">{config?.gym_name || 'GymFlow'}</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer navigation */}
        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const active = isActive(item.path)
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#DC2626] text-white'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* User info + sign out */}
        <div className="border-t border-white/10">
          {profile && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#DC2626] text-white text-xs font-bold shrink-0">
                {getInitials(profile.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile.full_name}
                </p>
                <p className="text-xs text-gray-400 capitalize">Miembro</p>
              </div>
            </div>
          )}
          <div className="px-4 pb-2">
            <button
              onClick={() => setPwModalOpen(true)}
              className="flex items-center gap-3 w-full px-2 py-3 text-sm font-medium text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            >
              <Lock size={18} />
              Cambiar contraseña
            </button>
          </div>
          <div className="px-4 pb-4">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-2 py-3 text-sm font-medium text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content (protegido por MembershipGate) ── */}
      <MembershipGate>
        <main className="pt-14 min-h-screen">
          {children}
        </main>
      </MembershipGate>

      {/* ── Change Password Modal ── */}
      {pwModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-[#111] rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-bold text-white">Cambiar contraseña</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPwError(null); setPwSuccess(false) }}
                  className="w-full px-3 py-2.5 bg-[#1e1e1e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
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
                  className="w-full px-3 py-2.5 bg-[#1e1e1e] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
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

            <div className="flex gap-3">
              <button
                onClick={() => { setPwModalOpen(false); setPwError(null); setPwSuccess(false); setNewPassword(''); setConfirmPassword('') }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangePassword}
                disabled={pwSaving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#DC2626] rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {pwSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { formatDateSpanish, getInitials }
