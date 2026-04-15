import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { alertsApi, type OpportunityAlert } from '../../services/api'
import { useWebSocket, type WSEvent } from '../../hooks/useWebSocket'

function urgencyClass(u: number): string {
  if (u >= 9) return 'text-red-600'
  if (u >= 7) return 'text-orange-500'
  return 'text-yellow-600'
}

interface AlertsBadgeProps {
  token: string | null
}

export default function AlertsBadge({ token }: AlertsBadgeProps) {
  const [count, setCount]     = useState(0)
  const [alerts, setAlerts]   = useState<OpportunityAlert[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const dropRef               = useRef<HTMLDivElement>(null)
  const navigate              = useNavigate()

  // Polling unread count a cada 60s
  useEffect(() => {
    async function fetchCount() {
      try {
        const { data } = await alertsApi.unreadCount()
        setCount(data.count)
      } catch { /* silently fail */ }
    }
    fetchCount()
    const timer = setInterval(fetchCount, 60_000)
    return () => clearInterval(timer)
  }, [])

  // WebSocket: incrementa badge ao receber novo alerta
  const handleWS = useCallback((event: WSEvent) => {
    if (event.type === 'opportunity:alert') {
      setCount((c) => c + 1)
    }
  }, [])
  useWebSocket(token, handleWS)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function toggleOpen() {
    if (!open) {
      setLoading(true)
      try {
        const { data } = await alertsApi.list({ isDismissed: false, limit: 10 })
        setAlerts(data.data)
      } catch { /* ignore */ }
      setLoading(false)
    }
    setOpen((v) => !v)
  }

  async function markRead(id: string) {
    await alertsApi.markRead(id).catch(() => null)
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, isRead: true } : a))
    setCount((c) => Math.max(0, c - 1))
  }

  async function dismiss(id: string) {
    await alertsApi.dismiss(id).catch(() => null)
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    setCount((c) => Math.max(0, c - 1))
  }

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        title="Alertas de oportunidade"
      >
        <span className="text-xl">🔔</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Alertas de Oportunidade</h3>
            <button
              onClick={() => { setOpen(false); navigate('/alerts') }}
              className="text-xs text-blue-600 hover:underline"
            >
              Ver todos
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Carregando...</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum alerta pendente</p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`px-4 py-3 hover:bg-gray-50 transition-colors ${!alert.isRead ? 'bg-blue-50/40' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-xs font-bold mt-0.5 shrink-0 ${urgencyClass(alert.urgency)}`}>
                      {alert.urgency}/10
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-snug">{alert.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{alert.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(alert.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {!alert.isRead && (
                        <button
                          onClick={() => markRead(alert.id)}
                          className="text-[10px] text-blue-500 hover:underline"
                        >
                          Lido
                        </button>
                      )}
                      <button
                        onClick={() => dismiss(alert.id)}
                        className="text-[10px] text-gray-400 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
