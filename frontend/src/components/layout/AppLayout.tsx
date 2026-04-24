import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuthStore } from '../../stores/authStore'
import { useWebSocket, type WSEvent } from '../../hooks/useWebSocket'
import { useToast } from '../shared/ToastProvider'
import AlertsBadge from '../shared/AlertsBadge'
import { useCallback } from 'react'

function useNotifications(token: string | null) {
  const { addToast } = useToast()

  const handleEvent = useCallback((event: WSEvent) => {
    switch (event.type) {
      case 'lead:hot_alert': {
        const d = event.data as { lead: { businessName: string; score: number }; eventType: string }
        const action = d.eventType === 'click' ? 'clicou em link' : 'abriu o email'
        addToast({
          type: 'hot_alert',
          title: `🔥 Lead quente: ${d.lead.businessName}`,
          message: `Score ${d.lead.score} — ${action}`,
          duration: 8000,
        })
        break
      }
      case 'lead:replied': {
        const d = event.data as { lead: { businessName: string } }
        addToast({
          type: 'replied',
          title: `💬 Resposta recebida!`,
          message: `${d.lead.businessName} respondeu sua mensagem`,
          duration: 8000,
        })
        break
      }
      case 'campaign:sent': {
        const d = event.data as { campaign: { name: string }; stats: { sent: number } }
        addToast({
          type: 'campaign',
          title: `Campanha concluída`,
          message: `"${d.campaign.name}" — ${d.stats.sent} mensagens enviadas`,
          duration: 6000,
        })
        break
      }
      case 'sync:complete': {
        const d = event.data as { stats: { rowsImported: number; rowsUpdated: number } }
        addToast({
          type: 'sync',
          title: `Sincronização concluída`,
          message: `${d.stats.rowsImported} importados · ${d.stats.rowsUpdated} atualizados`,
          duration: 5000,
        })
        break
      }
      case 'opportunity:alert': {
        const d = event.data as { alert: { title: string; urgency: number } }
        addToast({
          type: 'hot_alert',
          title: `🚨 ${d.alert.title}`,
          message: `Urgência ${d.alert.urgency}/10 — abra o CRM para agir agora`,
          duration: 10000,
        })
        break
      }
      case 'agent:handoff_needed': {
        const d = event.data as { leadName: string; businessName: string; reason: string }
        addToast({
          type: 'hot_alert',
          title: `🤖 Maya → ${d.leadName}`,
          message: `${d.businessName} precisa de atendimento humano agora`,
          duration: 15000,
        })
        break
      }
    }
  }, [addToast])

  useWebSocket(token, handleEvent)
}

function AppLayoutInner() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
  useNotifications(token)

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: '#061422' }}
    >
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header
          className="h-12 flex items-center justify-end px-4 shrink-0"
          style={{
            background:   '#0A1E30',
            borderBottom: '1px solid rgba(0,200,232,0.12)',
            fontFamily:   "'Inter', sans-serif",
          }}
        >
          <AlertsBadge token={token} />
        </header>

        {/* Conteúdo */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ background: '#061422' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return null
  return <AppLayoutInner />
}
