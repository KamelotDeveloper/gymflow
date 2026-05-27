import { useState, useEffect, useCallback, type ReactNode, type ComponentType } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthContext } from './AuthContext'
import {
  Users,
  ClipboardList,
  Dumbbell,
  CreditCard,
  Newspaper,
  Settings,
  Tags,
  Menu,
  LogOut,
  DollarSign,
  X,
  LayoutDashboard,
} from 'lucide-react'
import { useGymConfig } from '../hooks/useGymConfig'
import { supabase } from '../lib/supabase'

type NavItem = {
  icon: ComponentType<{ size?: number }>
  label: string
  path: string
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
  { icon: Users, label: 'Miembros', path: '/admin/members' },
  { icon: ClipboardList, label: 'Rutinas', path: '/admin/routines' },
  { icon: Dumbbell, label: 'Ejercicios', path: '/admin/exercises' },
  { icon: Tags, label: 'Planes', path: '/admin/plan-catalog' },
  { icon: CreditCard, label: 'Membresías', path: '/admin/plans' },
  { icon: DollarSign, label: 'Pagos', path: '/admin/payments' },
  { icon: Newspaper, label: 'Noticias', path: '/admin/news' },
  { icon: Settings, label: 'Configuración', path: '/admin/config' },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

type Props = {
  children: ReactNode
  pageTitle: string
}

export default function AdminLayout({ children, pageTitle }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const { profile, signOut } = useAuthContext()
  const { config } = useGymConfig()
  const navigate = useNavigate()
  const [pendingCount, setPendingCount] = useState(0)

  // Detect screen size
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Close mobile sidebar on navigation
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  // Poll pending payments count every 30s
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const { count } = await supabase
          .from('payment_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending') as any
        setPendingCount(count ?? 0)
      } catch {
        // silently ignore — badge is non-critical
      }
    }
    fetchPendingCount()
    const interval = setInterval(fetchPendingCount, 30_000)
    return () => clearInterval(interval)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  /* ── Sidebar content (shared between desktop inline and mobile overlay) ── */
  const sidebarContent = (
    <>
      {/* Logo section */}
      <div
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'flex-start' : collapsed ? 'center' : 'flex-start',
          padding: isMobile ? '0 16px' : collapsed ? 0 : '0 16px',
          borderBottom: '1px solid var(--gym-border)',
          gap: 10,
        }}
      >
        {config?.logo_url ? (
          <img
            src={config.logo_url}
            alt="Logo"
            style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 28, height: 28, borderRadius: 6,
              backgroundColor: 'var(--gym-red)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0,
            }}
          >
            G
          </div>
        )}
        {(!collapsed || isMobile) && (
          <span
            style={{
              flex: 1, color: 'var(--gym-text)', fontWeight: 700,
              fontSize: 16, whiteSpace: 'nowrap',
            }}
          >
            {config?.gym_name || 'GymFlow'}
          </span>
        )}
        {isMobile && (
          <button
            onClick={closeMobile}
            style={{ background: 'none', border: 'none', color: 'var(--gym-muted)', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={isMobile ? closeMobile : undefined}
            className={({ isActive }: { isActive: boolean }) =>
              [
                'flex items-center cursor-pointer no-underline',
                isMobile || !collapsed ? 'px-4' : 'justify-center px-0',
                isActive
                  ? 'bg-[var(--gym-red)] text-white'
                  : 'text-[var(--gym-muted)] hover:bg-[var(--gym-bg-hover)] hover:text-white',
              ].join(' ')
            }
            style={{
              height: 44,
              transition: 'background-color 0.15s',
              gap: 12,
              position: !isMobile && collapsed ? 'relative' : undefined,
            }}
          >
            <item.icon size={20} />
            {(isMobile || !collapsed) && (
              <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
            )}
            {/* Pending badge */}
            {item.label === 'Pagos' && pendingCount > 0 && (
              <span
                style={{
                  marginLeft: 'auto',
                  backgroundColor: '#DC2626', color: '#fff',
                  fontSize: 11, fontWeight: 700,
                  minWidth: 20, height: 20, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 5px',
                }}
              >
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
            {/* Collapsed badge overlay (only needed on desktop collapsed) */}
            {!isMobile && collapsed && item.label === 'Pagos' && pendingCount > 0 && (
              <span
                style={{
                  position: 'absolute', top: 2, right: 2,
                  backgroundColor: '#DC2626', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  minWidth: 16, height: 16, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px',
                }}
              >
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      {profile && (
        <div
          style={{
            borderTop: '1px solid var(--gym-border)',
            padding: isMobile || !collapsed ? '8px 12px' : '8px 0',
            display: 'flex', alignItems: 'center',
            justifyContent: isMobile || !collapsed ? 'space-between' : 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: '50%',
                backgroundColor: 'var(--gym-red)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}
            >
              {getInitials(profile.full_name || 'A')}
            </div>
            {(isMobile || !collapsed) && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ color: 'var(--gym-text)', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {profile.full_name}
                </div>
                <div style={{ color: 'var(--gym-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>Admin</div>
              </div>
            )}
          </div>
          {(isMobile || !collapsed) && (
            <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'var(--gym-muted)', cursor: 'pointer', padding: 4, display: 'flex' }} title="Cerrar sesión">
              <LogOut size={18} />
            </button>
          )}
        </div>
      )}
    </>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Desktop sidebar (inline) ── */}
      {!isMobile && (
        <aside
          style={{
            width: collapsed ? 56 : 220,
            transition: 'width 0.25s ease',
            backgroundColor: 'var(--gym-bg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {sidebarContent}
        </aside>
      )}

      {/* ── Mobile sidebar (overlay) ── */}
      {isMobile && mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeMobile}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}
          />
          {/* Drawer */}
          <aside
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
              width: 280,
              backgroundColor: 'var(--gym-bg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '4px 0 16px rgba(0,0,0,0.15)',
            }}
          >
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Content area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {/* Topbar */}
        <header
          style={{
            height: 52,
            backgroundColor: '#fff',
            borderBottom: '1px solid var(--gym-gray-border)',
            display: 'flex',
            alignItems: 'center',
            padding: isMobile ? '0 12px' : '0 24px',
            gap: 12,
          }}
        >
          <button
            onClick={() => (isMobile ? setMobileOpen(true) : setCollapsed(!collapsed))}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#374151',
            }}
          >
            <Menu size={20} />
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
            {pageTitle}
          </h1>
          <div style={{ flex: 1 }} />
        </header>

        {/* Main content */}
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: isMobile ? 16 : 24,
            backgroundColor: 'var(--gym-content-bg)',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
