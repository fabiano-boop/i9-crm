import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { duplicatesApi, agentApi } from '../../services/api'

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const [dupCount, setDupCount]         = useState(0)
  const [handoffCount, setHandoffCount] = useState(0)

  useEffect(() => {
    duplicatesApi.list()
      .then(({ data }) => setDupCount(data.total))
      .catch(() => null)

    // Verifica fila de handoff do agente a cada 30s
    const checkHandoff = () => {
      agentApi.status()
        .then(({ data }) => setHandoffCount(data.handoffQueue.length))
        .catch(() => null)
    }
    checkHandoff()
    const interval = setInterval(checkHandoff, 30_000)
    return () => clearInterval(interval)
  }, [])

  const navItems = [
    { to: '/dashboard',         label: 'Dashboard',     icon: '📊' },
    { to: '/leads',             label: 'Leads',         icon: '👥' },
    { to: '/leads/duplicates',  label: 'Duplicatas',    icon: '🔁', badge: dupCount   || undefined },
    { to: '/pipeline',          label: 'Pipeline',      icon: '🔄' },
    { to: '/campaigns',         label: 'Campanhas',     icon: '📣' },
    { to: '/agent',             label: 'Agente Maya',   icon: '🤖', badge: handoffCount || undefined, badgeColor: 'bg-red-500' },
    { to: '/analytics',         label: 'Analytics',     icon: '📈' },
    { to: '/settings',          label: 'Configurações', icon: '⚙️' },
  ]

  return (
    <aside className="w-60 min-h-screen bg-gray-900 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">i9</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">i9 CRM</p>
            <p className="text-gray-400 text-xs">Zona Leste SP</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/leads'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <span>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {'badge' in item && item.badge !== undefined && item.badge > 0 && (
              <span className={`${('badgeColor' in item && item.badgeColor) ? item.badgeColor : 'bg-yellow-500'} text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full`}>
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.name}</p>
            <p className="text-gray-400 text-xs truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full text-left text-xs text-gray-400 hover:text-red-400 transition-colors px-1"
        >
          Sair
        </button>
      </div>
    </aside>
  )
}
