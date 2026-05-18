import { useState, type ReactNode, type ComponentType } from 'react'
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
} from 'lucide-react'
import { useGymConfig } from '../hooks/useGymConfig'

type NavItem = {
  icon: ComponentType<{ size?: number }>
  label: string
  path: string
}

const navItems: NavItem[] = [
  { icon: Users, label: 'Miembros', path: '/admin/members' },
  { icon: ClipboardList, label: 'Rutinas', path: '/admin/routines' },
  { icon: Dumbbell, label: 'Ejercicios', path: '/admin/exercises' },
  { icon: Tags, label: 'Planes', path: '/admin/plan-catalog' },
  { icon: CreditCard, label: 'Membresías', path: '/admin/plans' },
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
  const { profile, signOut } = useAuthContext()
  const { config } = useGymConfig()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
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
        {/* Logo section */}
        <div
          style={{
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 16px',
            borderBottom: '1px solid var(--gym-border)',
            gap: collapsed ? 0 : 10,
          }}
        >
          {config?.logo_url ? (
            <img
              src={config.logo_url}
              alt="Logo"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                backgroundColor: 'var(--gym-red)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              G
            </div>
          )}
          {!collapsed && (
            <span
              style={{
                color: 'var(--gym-text)',
                fontWeight: 700,
                fontSize: 16,
                whiteSpace: 'nowrap',
              }}
            >
              {config?.gym_name || 'GymFlow'}
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }: { isActive: boolean }) =>
                [
                  'flex items-center cursor-pointer no-underline',
                  collapsed ? 'justify-center px-0' : 'px-4',
                  isActive
                    ? 'bg-[var(--gym-red)] text-white'
                    : 'text-[var(--gym-muted)] hover:bg-[var(--gym-bg-hover)] hover:text-white',
                ].join(' ')
              }
              style={{
                height: 44,
                transition: 'background-color 0.15s',
                gap: collapsed ? 0 : 12,
              }}
            >
              <item.icon size={20} />
              {!collapsed && (
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
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
              padding: collapsed ? '8px 0' : '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                overflow: 'hidden',
              }}
            >
              {/* Initials circle */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: 'var(--gym-red)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {getInitials(profile.full_name || 'A')}
              </div>
              {!collapsed && (
                <div style={{ overflow: 'hidden' }}>
                  <div
                    style={{
                      color: 'var(--gym-text)',
                      fontSize: 14,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {profile.full_name}
                  </div>
                  <div
                    style={{
                      color: 'var(--gym-muted)',
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Admin
                  </div>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={handleSignOut}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--gym-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                title="Cerrar sesión"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Content area */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Topbar */}
        <header
          style={{
            height: 52,
            backgroundColor: '#fff',
            borderBottom: '1px solid var(--gym-gray-border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            gap: 12,
          }}
        >
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#374151',
            }}
          >
            <Menu size={20} />
          </button>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#111827',
              margin: 0,
            }}
          >
            {pageTitle}
          </h1>
          <div style={{ flex: 1 }} />
        </header>

        {/* Main content */}
        <main
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 24,
            backgroundColor: 'var(--gym-content-bg)',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
