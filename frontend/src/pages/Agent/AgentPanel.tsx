import { useEffect, useState, useCallback } from 'react'
import { agentApi, type AgentStatus, type AgentConversation } from '../../services/api'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useToast } from '../../components/shared/ToastProvider'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  first_contact:       { label: 'Primeiro contato', color: 'bg-blue-100 text-blue-700' },
  qualifying:          { label: 'Qualificando',      color: 'bg-indigo-100 text-indigo-700' },
  presenting:          { label: 'Apresentando',      color: 'bg-purple-100 text-purple-700' },
  handling_objection:  { label: 'Contornando objeção', color: 'bg-orange-100 text-orange-700' },
  scheduling:          { label: 'Agendando reunião', color: 'bg-cyan-100 text-cyan-700' },
  human_needed:        { label: 'Aguardando humano', color: 'bg-red-100 text-red-700' },
}

const CLASSIFICATION_DOT: Record<string, string> = {
  HOT:  'bg-red-500',
  WARM: 'bg-yellow-500',
  COLD: 'bg-blue-500',
}

const PACKAGE_LABELS: Record<string, string> = {
  starter:   'Starter — R$997/mês',
  growth:    'Growth — R$1.997/mês',
  dominacao: 'Dominação — R$3.497/mês',
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-3">{icon}</span>
      <p className="font-medium text-gray-700">{title}</p>
      <p className="text-sm text-gray-400 mt-1 max-w-xs">{description}</p>
    </div>
  )
}

function ConversationCard({
  convo,
  onTakeover,
  takingOver,
}: {
  convo: AgentConversation
  onTakeover: (id: string) => void
  takingOver: string | null
}) {
  const stage = STAGE_LABELS[convo.agentStage ?? 'first_contact'] ?? STAGE_LABELS.first_contact
  const lastMsg = convo.interactions?.[0]
  const phone = convo.whatsapp ?? convo.phone

  return (
    <div className={`bg-white rounded-xl border p-4 shadow-sm transition-all ${convo.needsHandoff ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'}`}>
      {convo.needsHandoff && (
        <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-red-600">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Aguardando atendimento humano
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${CLASSIFICATION_DOT[convo.classification] ?? 'bg-gray-400'} shrink-0`} />
            <p className="font-semibold text-gray-900 text-sm truncate">{convo.name}</p>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{convo.businessName} · {convo.neighborhood}</p>
          {phone && (
            <p className="text-xs text-gray-400 mt-0.5">{phone}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="text-xs font-bold text-gray-700">Score {convo.score}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stage.color}`}>
          {stage.label}
        </span>
      </div>

      {lastMsg && (
        <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">
              {lastMsg.direction === 'IN' ? '← Lead' : '→ Maya'}
            </span>
            <span className="text-[10px] text-gray-300">·</span>
            <span className="text-[10px] text-gray-400">{timeAgo(lastMsg.createdAt)}</span>
          </div>
          <p className="text-xs text-gray-600 line-clamp-2">{lastMsg.content}</p>
        </div>
      )}

      <button
        onClick={() => onTakeover(convo.id)}
        disabled={takingOver === convo.id}
        className={`w-full text-sm font-medium py-2 rounded-lg transition-colors ${
          convo.needsHandoff
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        } disabled:opacity-60`}
      >
        {takingOver === convo.id ? 'Assumindo...' : '👤 Assumir conversa'}
      </button>
    </div>
  )
}

function HandoffCard({
  entry,
  onTakeover,
  takingOver,
}: {
  entry: AgentStatus['handoffQueue'][number]
  onTakeover: (id: string) => void
  takingOver: string | null
}) {
  const pkg = entry.suggestedPackage ? PACKAGE_LABELS[entry.suggestedPackage] : null
  const phone = entry.lead?.whatsapp ?? entry.lead?.phone

  return (
    <div className="bg-white rounded-xl border border-red-200 ring-1 ring-red-100 p-4 shadow-sm">
      <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold text-red-600">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        Precisa de atendimento — {timeAgo(entry.timestamp)}
      </div>

      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-red-700">
            {entry.lead?.name?.charAt(0).toUpperCase() ?? '?'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{entry.lead?.name}</p>
          <p className="text-xs text-gray-500">{entry.lead?.businessName} · {entry.lead?.neighborhood}</p>
          {phone && <p className="text-xs text-gray-400">{phone}</p>}
        </div>
        {entry.lead?.score !== undefined && (
          <span className="text-xs font-bold text-gray-600 shrink-0">Score {entry.lead.score}</span>
        )}
      </div>

      <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
        <p className="text-xs text-gray-500 mb-0.5">Motivo</p>
        <p className="text-xs text-gray-800">{entry.reason}</p>
      </div>

      {pkg && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-500">Pacote sugerido:</span>
          <span className="text-xs font-semibold text-blue-700">{pkg}</span>
        </div>
      )}

      <button
        onClick={() => entry.leadId && onTakeover(entry.leadId)}
        disabled={!entry.leadId || takingOver === entry.leadId}
        className="w-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
      >
        {takingOver === entry.leadId ? 'Assumindo...' : '🚨 Assumir agora'}
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AgentPanel() {
  const { addToast } = useToast()
  const [status, setStatus]       = useState<AgentStatus | null>(null)
  const [conversations, setConvos] = useState<AgentConversation[]>([])
  const [loading, setLoading]     = useState(true)
  const [takingOver, setTakingOver] = useState<string | null>(null)
  const [toggling, setToggling]   = useState(false)
  const [tab, setTab]             = useState<'handoff' | 'active'>('handoff')

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, convosRes] = await Promise.all([
        agentApi.status(),
        agentApi.conversations(),
      ])
      setStatus(statusRes.data)
      setConvos(convosRes.data.conversations)
    } catch {
      // silent — dados podem ser indisponíveis momentaneamente
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 15_000) // poll a cada 15s
    return () => clearInterval(interval)
  }, [fetchAll])

  // WebSocket — atualiza painel em tempo real quando chega handoff
  const token = localStorage.getItem('accessToken')
  useWebSocket(token, useCallback((event) => {
    if (event.type === 'agent:handoff_needed') {
      const d = event.data as { leadName: string; businessName: string }
      addToast({
        type: 'hot_alert',
        title: `🚨 Maya → Handoff: ${d.leadName}`,
        message: `${d.businessName} precisa de atendimento humano`,
        duration: 12_000,
      })
      fetchAll() // re-busca imediatamente
    }
  }, [addToast, fetchAll]))

  async function handleToggle() {
    if (!status) return
    setToggling(true)
    try {
      const newState = !status.enabled
      await agentApi.toggle(newState)
      setStatus((s) => s ? { ...s, enabled: newState } : s)
      addToast({
        type: 'sync',
        title: `Agente Maya ${newState ? 'ativado' : 'desativado'}`,
        message: newState ? 'Maya responderá leads automaticamente' : 'Respostas manuais necessárias',
        duration: 4000,
      })
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
        <div className="h-8 bg-gray-100 rounded w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const handoffQueue = status?.handoffQueue ?? []
  const activeSessions = conversations.filter((c) => !c.needsHandoff)

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">🤖 Painel da Maya</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Agente de IA para WhatsApp — i9 Soluções Digitais
          </p>
        </div>

        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 ${
            status?.enabled
              ? 'bg-green-100 text-green-800 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${status?.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          {toggling ? 'Alterando...' : status?.enabled ? 'Maya ATIVA' : 'Maya INATIVA'}
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-xl border p-4 shadow-sm ${handoffQueue.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Aguardando humano</p>
          <p className={`text-3xl font-bold ${handoffQueue.length > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {handoffQueue.length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sessões ativas</p>
          <p className="text-3xl font-bold text-indigo-600">{activeSessions.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
          <p className={`text-3xl font-bold ${status?.enabled ? 'text-green-600' : 'text-gray-400'}`}>
            {status?.enabled ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {([
            { key: 'handoff', label: 'Fila de handoff', badge: handoffQueue.length },
            { key: 'active',  label: 'Sessões ativas',  badge: activeSessions.length },
          ] as const).map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                tab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {badge > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  key === 'handoff' ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-700'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'handoff' && (
        handoffQueue.length === 0 ? (
          <EmptyState
            icon="✅"
            title="Nenhum lead aguardando"
            description="A Maya está gerenciando todas as conversas. Você será notificado quando precisar intervir."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {handoffQueue.map((entry) => (
              <HandoffCard
                key={entry.leadId}
                entry={entry}
                onTakeover={handleTakeover}
                takingOver={takingOver}
              />
            ))}
          </div>
        )
      )}

      {tab === 'active' && (
        activeSessions.length === 0 ? (
          <EmptyState
            icon="💬"
            title="Nenhuma sessão ativa"
            description={status?.enabled
              ? 'A Maya responderá automaticamente quando leads enviarem mensagens.'
              : 'Ative a Maya para ela começar a responder leads automaticamente.'}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeSessions.map((convo) => (
              <ConversationCard
                key={convo.id}
                convo={convo}
                onTakeover={handleTakeover}
                takingOver={takingOver}
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}
