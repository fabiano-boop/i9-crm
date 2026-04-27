import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { duplicatesApi, agentApi } from '../../services/api'
import {
  LayoutDashboard,
  Users,
  Copy,
  GitBranch,
  Megaphone,
  Bot,
  BarChart2,
  Settings,
  Briefcase,
  List,
  UserPlus,
  Globe,
  LogOut,
  ChevronDown,
  ChevronRight,
  Package,
} from 'lucide-react'

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const [dupCount, setDupCount]         = useState(0)
  const [handoffCount, setHandoffCount] = useState(0)
  const [clientsOpen, setClientsOpen]   = useState(
    () => location.pathname.startsWith('/clients') || location.pathname.startsWith('/services')
  )

  useEffect(() => {
    duplicatesApi.list()
      .then(({ data }) => setDupCount(data.total))
      .catch(() => null)

    const checkHandoff = () => {
      agentApi.status()
        .then(({ data }) => setHandoffCount(data.handoffQueue.length))
        .catch(() => null)
    }
    checkHandoff()
    const interval = setInterval(checkHandoff, 30_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (location.pathname.startsWith('/clients') || location.pathname.startsWith('/services')) {
      setClientsOpen(true)
    }
  }, [location.pathname])

  const navItems = [
    { to: '/dashboard',          label: 'Dashboard',        Icon: LayoutDashboard },
    { to: '/market-intelligence', label: 'Intel. de Mercado', Icon: Globe },
    { to: '/leads',              label: 'Leads',            Icon: Users },
    { to: '/leads/duplicates', label: 'Duplicatas',    Icon: Copy,       badge: dupCount      || undefined },
    { to: '/pipeline',         label: 'Pipeline',      Icon: GitBranch },
    { to: '/campaigns',        label: 'Campanhas',     Icon: Megaphone },
    { to: '/agent',            label: 'Agente Maya',   Icon: Bot,        badge: handoffCount  || undefined, badgeRed: true },
    { to: '/analytics',        label: 'Analytics',     Icon: BarChart2 },
    { to: '/settings',         label: 'Configurações', Icon: Settings },
  ]

  return (
    <aside
      className="w-60 min-h-screen flex flex-col"
      style={{ background: '#0A1E30', borderRight: '1px solid rgba(0,200,232,0.12)' }}
    >
      {/* ── Logo ── */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(0,200,232,0.12)' }}
      >
        <img
          src="/logo_i9.png"
          alt="i9 Soluções Digitais"
          style={{
            height: 36,
            width: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 6px rgba(0,200,232,0.3))',
          }}
        />
        <span
          style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '11px', color: '#fff', whiteSpace: 'nowrap' }}
        >
          i9 Soluções Digitais
        </span>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">

        {/* Grupo principal */}
        <p
          className="text-[9px] uppercase tracking-widest px-3 mb-2"
          style={{ color: '#3E6A80', fontFamily: 'monospace', letterSpacing: '0.2em' }}
        >
          Principal
        </p>

        {navItems.map(({ to, label, Icon, badge, badgeRed }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/leads'}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative group"
            style={({ isActive }) => ({
              color:      isActive ? '#00C8E8' : '#7EAFC4',
              background: isActive ? 'rgba(0,200,232,0.10)' : 'transparent',
              borderLeft: isActive ? '2px solid #00C8E8' : '2px solid transparent',
            })}
          >
            <Icon size={15} strokeWidth={1.8} />
            <span className="flex-1">{label}</span>
            {badge !== undefined && badge > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: badgeRed ? 'rgba(239,68,68,0.9)' : 'rgba(0,200,232,0.2)',
                  color:      badgeRed ? '#fff'                 : '#00C8E8',
                }}
              >
                {badge}
              </span>
            )}
          </NavLink>
        ))}

        {/* ── Seção Clientes ── */}
        <div className="pt-3">
          <div style={{ borderTop: '1px solid rgba(0,200,232,0.08)', marginBottom: 6 }} />

          <p
            className="text-[9px] uppercase tracking-widest px-3 mb-2"
            style={{ color: '#3E6A80', fontFamily: 'monospace', letterSpacing: '0.2em' }}
          >
            Clientes
          </p>

          <button
            onClick={() => setClientsOpen(o => !o)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
            style={{ color: '#7EAFC4', background: 'transparent' }}
          >
            <Briefcase size={15} strokeWidth={1.8} />
            <span className="flex-1 text-left">Clientes</span>
            {clientsOpen
              ? <ChevronDown size={13} style={{ color: '#3E6A80' }} />
              : <ChevronRight size={13} style={{ color: '#3E6A80' }} />
            }
          </button>

          {clientsOpen && (
            <div className="mt-1 space-y-0.5">
              <NavLink
                to="/clients"
                end
                className="flex items-center gap-2 pl-9 pr-3 py-2 rounded-lg text-sm transition-all"
                style={({ isActive }) => ({
                  color:      isActive ? '#00E5C8' : '#7EAFC4',
                  background: isActive ? 'rgba(0,229,200,0.08)' : 'transparent',
                })}
              >
                <List size={13} strokeWidth={1.8} />
                Lista de clientes
              </NavLink>

              <NavLink
                to="/clients/new"
                className="flex items-center gap-2 pl-9 pr-3 py-2 rounded-lg text-sm transition-all"
                style={({ isActive }) => ({
                  color:      isActive ? '#00E5C8' : '#7EAFC4',
                  background: isActive ? 'rgba(0,229,200,0.08)' : 'transparent',
                })}
              >
                <UserPlus size={13} strokeWidth={1.8} />
                Novo cliente
              </NavLink>

              <NavLink
                to="/services"
                className="flex items-center gap-2 pl-9 pr-3 py-2 rounded-lg text-sm transition-all"
                style={({ isActive }) => ({
                  color:      isActive ? '#00E5C8' : '#7EAFC4',
                  background: isActive ? 'rgba(0,229,200,0.08)' : 'transparent',
                })}
              >
                <Package size={13} strokeWidth={1.8} />
                Serviços
              </NavLink>

            </div>
          )}
        </div>
      </nav>

      {/* ── User / Logout ── */}
      <div
        className="px-4 py-4"
        style={{ borderTop: '1px solid rgba(0,200,232,0.12)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)' }}
          >
            <span className="text-xs font-bold" style={{ color: '#061422' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: '#E8F4F8' }}>
              {user?.name}
            </p>
            <p className="text-xs truncate" style={{ color: '#7EAFC4' }}>
              {user?.role}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-2 text-xs px-1 py-1 rounded transition-colors"
          style={{ color: '#3E6A80' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#FF8080')}
          onMouseLeave={e => (e.currentTarget.style.color = '#3E6A80')}
        >
          <LogOut size={13} strokeWidth={1.8} />
          Sair
        </button>
      </div>
    </aside>
  )
}
