import { useEffect, useState, useCallback } from 'react'
import { agentApi, type AgentStatus, type AgentConversation } from '../../services/api'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useToast } from '../../components/shared/ToastProvider'

const STAGE_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  first_contact:      { label: 'Primeiro contato',   bg: 'rgba(26,110,255,0.15)',  color: '#60a5fa' },
  qualifying:         { label: 'Qualificando',        bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc' },
  presenting:         { label: 'Apresentando',        bg: 'rgba(139,92,246,0.15)', color: '#c084fc' },
  handling_objection: { label: 'Contornando objeção', bg: 'rgba(249,115,22,0.15)', color: '#fb923c' },
  scheduling:         { label: 'Agendando reunião',   bg: 'rgba(6,182,212,0.15)',  color: '#22d3ee' },
  human_needed:       { label: 'Aguardando humano',   bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
}

const CLASSIFICATION_DOT: Record<string, string> = {
  HOT: '#ef4444', WARM: '#eab308', COLD: '#3b82f6',
}

const PACKAGE_LABELS: Record<string, string> = {
  start: 'Start — R$750/mês (promo)', growth: 'Growth — R$1.097/mês (promo)', premium: 'Premium — R$1.797/mês (promo)',
}

function timeAgo(ts: string | Date): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

const cardBase: React.CSSProperties = {
  background: '#0B1F30',
  border: '1px solid rgba(0,200,232,0.14)',
  borderRadius: 12,
  padding: 16,
}

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-3">{icon}</span>
      <p className="font-medium" style={{ color: '#E8F4F8' }}>{title}</p>
      <p className="text-sm mt-1 max-w-xs" style={{ color: '#7EAFC4' }}>{description}</p>
    </div>
  )
}

function ConversationCard({ convo, onTakeover, takingOver }: {
  convo: AgentConversation; onTakeover: (id: string) => void; takingOver: string | null
}) {
  const stage = STAGE_LABELS[convo.agentStage ?? 'first_contact'] ?? STAGE_LABELS.first_contact
  const lastMsg = convo.interactions?.[0]
  const phone = convo.whatsapp ?? convo.phone

  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{
        background: '#0B1F30',
        border: convo.needsHandoff ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(0,200,232,0.14)',
        boxShadow: convo.needsHandoff ? '0 0 12px rgba(239,68,68,0.1)' : 'none',
      }}
    >
      {convo.needsHandoff && (
        <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold" style={{ color: '#f87171' }}>
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Aguardando atendimento humano
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CLASSIFICATION_DOT[convo.classification] ?? '#94a3b8' }} />
            <p className="font-semibold text-sm truncate" style={{ color: '#E8F4F8' }}>{convo.name}</p>
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: '#7EAFC4' }}>{convo.businessName} · {convo.neighborhood}</p>
          {phone && <p className="text-xs mt-0.5" style={{ color: '#5A9AB5' }}>{phone}</p>}
        </div>
        <span className="text-xs font-bold shrink-0" style={{ color: '#A8CCE0' }}>Score {convo.score}</span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: stage.bg, color: stage.color }}>
          {stage.label}
        </span>
      </div>
      {lastMsg && (
        <div className="rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(0,200,232,0.05)', border: '1px solid rgba(0,200,232,0.08)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] uppercase tracking-wide" style={{ color: '#5A9AB5' }}>
              {lastMsg.direction === 'IN' ? '← Lead' : '→ Maya'}
            </span>
            <span className="text-[10px]" style={{ color: '#3E6A80' }}>·</span>
            <span className="text-[10px]" style={{ color: '#5A9AB5' }}>{timeAgo(lastMsg.createdAt)}</span>
          </div>
          <p className="text-xs line-clamp-2" style={{ color: '#A8CCE0' }}>{lastMsg.content}</p>
        </div>
      )}
      <button
        onClick={() => onTakeover(convo.id)}
        disabled={takingOver === convo.id}
        className="w-full text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-60"
        style={convo.needsHandoff
          ? { background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }
          : { background: 'rgba(0,200,232,0.08)', border: '1px solid rgba(0,200,232,0.2)', color: '#A8CCE0' }}
      >
        {takingOver === convo.id ? 'Assumindo...' : '👤 Assumir conversa'}
      </button>
    </div>
  )
}

function HandoffCard({ entry, onTakeover, takingOver }: {
  entry: AgentStatus['handoffQueue'][number]; onTakeover: (id: string) => void; takingOver: string | null
}) {
  const pkg = entry.suggestedPackage ? PACKAGE_LABELS[entry.suggestedPackage] : null
  const phone = entry.lead?.whatsapp ?? entry.lead?.phone

  return (
    <div className="rounded-xl p-4" style={{ background: '#0B1F30', border: '1px solid rgba(239,68,68,0.35)', boxShadow: '0 0 16px rgba(239,68,68,0.08)' }}>
      <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold" style={{ color: '#f87171' }}>
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        Precisa de atendimento — {timeAgo(entry.timestamp)}
      </div>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
          <span className="text-sm font-bold" style={{ color: '#f87171' }}>
            {entry.lead?.name?.charAt(0).toUpperCase() ?? '?'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: '#E8F4F8' }}>{entry.lead?.name}</p>
          <p className="text-xs" style={{ color: '#7EAFC4' }}>{entry.lead?.businessName} · {entry.lead?.neighborhood}</p>
          {phone && <p className="text-xs" style={{ color: '#5A9AB5' }}>{phone}</p>}
        </div>
        {entry.lead?.score !== undefined && (
          <span className="text-xs font-bold shrink-0" style={{ color: '#A8CCE0' }}>Score {entry.lead.score}</span>
        )}
      </div>
      <div className="rounded-lg px-3 py-2 mb-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
        <p className="text-xs mb-0.5" style={{ color: '#7EAFC4' }}>Motivo</p>
        <p className="text-xs" style={{ color: '#fca5a5' }}>{entry.reason}</p>
      </div>
      {pkg && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs" style={{ color: '#7EAFC4' }}>Pacote sugerido:</span>
          <span className="text-xs font-semibold" style={{ color: '#00C8E8' }}>{pkg}</span>
        </div>
      )}
      <button
        onClick={() => entry.leadId && onTakeover(entry.leadId)}
        disabled={!entry.leadId || takingOver === entry.leadId}
        className="w-full text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
        style={{ background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.5)', color: '#f87171' }}
      >
        {takingOver === entry.leadId ? 'Assumindo...' : '🚨 Assumir agora'}
      </button>
    </div>
  )
}

export default function AgentPanel() {
  const { addToast } = useToast()
  const [status, setStatus]         = useState<AgentStatus | null>(null)
  const [conversations, setConvos]  = useState<AgentConversation[]>([])
  const [loading, setLoading]       = useState(true)
  const [takingOver, setTakingOver] = useState<string | null>(null)
  const [toggling, setToggling]     = useState(false)
  const [tab, setTab]               = useState<'handoff' | 'active'>('handoff')

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, convosRes] = await Promise.all([agentApi.status(), agentApi.conversations()])
      setStatus(statusRes.data)
      setConvos(convosRes.data.conversations)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 15_000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const token = localStorage.getItem('accessToken')
  useWebSocket(token, useCallback((event) => {
    if (event.type === 'agent:handoff_needed') {
      const d = event.data as { leadName: string; businessName: string }
      addToast({ type: 'hot_alert', title: `🚨 Maya → Handoff: ${d.leadName}`, message: `${d.businessName} precisa de atendimento humano`, duration: 12_000 })
      fetchAll()
    }
  }, [addToast, fetchAll]))

  async function handleToggle() {
    if (!status) return
    setToggling(true)
    try {
      const newState = !status.enabled
      await agentApi.toggle(newState)
      setStatus((s) => s ? { ...s, enabled: newState } : s)
      addToast({ type: 'sync', title: `Agente Maya ${newState ? 'ativado' : 'desativado'}`, message: newState ? 'Maya responderá leads automaticamente' : 'Respostas manuais necessárias', duration: 4000 })
    } catch {
      addToast({ type: 'hot_alert', title: 'Erro', message: 'Não foi possível alterar o estado do agente', duration: 4000 })
    } finally {
      setToggling(false)
    }
  }

  async function handleTakeover(leadId: string) {
    setTakingOver(leadId)
    try {
      await agentApi.takeover(leadId)
      addToast({ type: 'sync', title: 'Conversa assumida', message: 'Você agora controla este atendimento', duration: 4000 })
      await fetchAll()
    } catch {
      addToast({ type: 'hot_alert', title: 'Erro', message: 'Não foi possível assumir a conversa', duration: 4000 })
    } finally {
      setTakingOver(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-8 rounded w-48" style={{ background: '#0B1F30' }} />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl" style={{ background: '#0B1F30' }} />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-40 rounded-xl" style={{ background: '#0B1F30' }} />)}
        </div>
      </div>
    )
  }

  const handoffQueue   = status?.handoffQueue ?? []
  const activeSessions = conversations.filter((c) => !c.needsHandoff)

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#E8F4F8' }}>🤖 Painel da Maya</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>Agente de IA para WhatsApp — i9 Soluções Digitais</p>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
          style={status?.enabled
            ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }
            : { background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.3)', color: '#94a3b8' }}
        >
          <span className={`w-2 h-2 rounded-full ${status?.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          {toggling ? 'Alterando...' : status?.enabled ? 'Maya ATIVA' : 'Maya INATIVA'}
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className="rounded-xl p-4"
          style={{
            background: handoffQueue.length > 0 ? 'rgba(239,68,68,0.08)' : '#0B1F30',
            border: handoffQueue.length > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(0,200,232,0.14)',
          }}
        >
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#7EAFC4' }}>Aguardando humano</p>
          <p className="text-3xl font-bold" style={{ color: handoffQueue.length > 0 ? '#f87171' : '#E8F4F8', fontFamily: 'monospace' }}>
            {handoffQueue.length}
          </p>
        </div>
        <div style={{ ...cardBase, padding: 16 }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#7EAFC4' }}>Sessões ativas</p>
          <p className="text-3xl font-bold" style={{ color: '#8b5cf6', fontFamily: 'monospace' }}>{activeSessions.length}</p>
        </div>
        <div style={{ ...cardBase, padding: 16 }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#7EAFC4' }}>Status</p>
          <p className="text-3xl font-bold" style={{ color: status?.enabled ? '#34d399' : '#94a3b8', fontFamily: 'monospace' }}>
            {status?.enabled ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid rgba(0,200,232,0.12)' }}>
        <nav className="flex gap-6">
          {([
            { key: 'handoff', label: 'Fila de handoff', badge: handoffQueue.length },
            { key: 'active',  label: 'Sessões ativas',  badge: activeSessions.length },
          ] as const).map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors"
              style={{
                borderBottomColor: tab === key ? '#00C8E8' : 'transparent',
                color: tab === key ? '#00C8E8' : '#7EAFC4',
              }}
            >
              {label}
              {badge > 0 && (
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={key === 'handoff'
                    ? { background: 'rgba(239,68,68,0.9)', color: '#fff' }
                    : { background: 'rgba(0,200,232,0.15)', color: '#00C8E8' }}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'handoff' && (
        handoffQueue.length === 0
          ? <EmptyState icon="✅" title="Nenhum lead aguardando" description="A Maya está gerenciando todas as conversas. Você será notificado quando precisar intervir." />
          : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {handoffQueue.map((entry) => <HandoffCard key={entry.leadId} entry={entry} onTakeover={handleTakeover} takingOver={takingOver} />)}
            </div>
      )}

      {tab === 'active' && (
        activeSessions.length === 0
          ? <EmptyState icon="💬" title="Nenhuma sessão ativa"
              description={status?.enabled ? 'A Maya responderá automaticamente quando leads enviarem mensagens.' : 'Ative a Maya para ela começar a responder leads automaticamente.'} />
          : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeSessions.map((convo) => <ConversationCard key={convo.id} convo={convo} onTakeover={handleTakeover} takingOver={takingOver} />)}
            </div>
      )}
    </div>
  )
}


