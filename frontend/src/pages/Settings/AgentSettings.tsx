import { useState, useEffect } from 'react'
import { agentApi, leadsApi, type AgentAnalytics, type Lead } from '../../services/api'
import { useToast } from '../../components/shared/ToastProvider'

// ─── Test panel ───────────────────────────────────────────────────────────────

function AgentTestPanel() {
  const { addToast } = useToast()
  const [leads, setLeads]       = useState<Lead[]>([])
  const [leadId, setLeadId]     = useState('')
  const [message, setMessage]   = useState('')
  const [testing, setTesting]   = useState(false)
  const [result, setResult]     = useState<{
    message: string; intent: string; stage: string; shouldHandoff: boolean
  } | null>(null)

  useEffect(() => {
    leadsApi.list({ limit: 50, page: 1 })
      .then(({ data }) => setLeads(data.data))
      .catch(() => null)
  }, [])

  async function handleTest() {
    if (!leadId || !message.trim()) return
    setTesting(true)
    setResult(null)
    try {
      const { data } = await agentApi.test(leadId, message)
      setResult(data.result)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      addToast({ type: 'hot_alert', title: 'Erro no teste', message: msg ?? 'Verifique ANTHROPIC_API_KEY', duration: 6000 })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Lead para testar</label>
        <select
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione um lead...</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} — {l.businessName} ({l.classification})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem simulada do lead</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ex: Quanto custa o serviço de vocês?"
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={handleTest}
        disabled={!leadId || !message.trim() || testing}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
      >
        {testing ? <><span className="animate-spin">⟳</span> Testando Maya...</> : '🧪 Testar resposta'}
      </button>

      {result && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              Intent: {result.intent}
            </span>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              Estágio: {result.stage}
            </span>
            {result.shouldHandoff && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                ⚠️ Handoff recomendado
              </span>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Resposta da Maya:</p>
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stats mini-card ──────────────────────────────────────────────────────────

function StatRow({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${accent ?? 'text-gray-900'}`}>{value}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AgentSettings() {
  const { addToast } = useToast()
  const [analytics, setAnalytics] = useState<AgentAnalytics | null>(null)
  const [enabled, setEnabled]     = useState<boolean | null>(null)
  const [toggling, setToggling]   = useState(false)

  useEffect(() => {
    Promise.all([agentApi.status(), agentApi.analytics()])
      .then(([statusRes, analyticsRes]) => {
        setEnabled(statusRes.data.enabled)
        setAnalytics(analyticsRes.data)
      })
      .catch(() => null)
  }, [])

  async function handleToggle() {
    if (enabled === null) return
    setToggling(true)
    const newState = !enabled
    try {
      await agentApi.toggle(newState)
      setEnabled(newState)
      addToast({
        type: 'sync',
        title: `Maya ${newState ? 'ativada' : 'desativada'}`,
        message: newState
          ? 'Agente responderá leads automaticamente via WhatsApp'
          : 'Atendimento voltou ao modo manual',
        duration: 4000,
      })
    } catch {
      addToast({ type: 'hot_alert', title: 'Erro', message: 'Não foi possível alterar o estado', duration: 4000 })
    } finally {
      setToggling(false)
    }
  }

  const rt = analytics?.runtime

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold text-gray-900">🤖 Agente Maya (WhatsApp IA)</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Responde leads automaticamente, qualifica e escala para humano quando necessário
          </p>
        </div>

        <button
          onClick={handleToggle}
          disabled={toggling || enabled === null}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
            enabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {/* Status badge */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg mb-5 ${
        enabled ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
      }`}>
        <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        <span className={`text-sm font-medium ${enabled ? 'text-green-800' : 'text-gray-600'}`}>
          {enabled === null ? 'Carregando...' : enabled ? 'Maya está ativa e respondendo leads' : 'Maya está inativa — modo manual'}
        </span>
      </div>

      {/* Personality summary */}
      <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <p className="text-xs font-semibold text-blue-800 mb-2">Personalidade da Maya</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-blue-700">
          <span>✓ Tom consultivo e humano</span>
          <span>✓ Máx. 3 linhas por mensagem</span>
          <span>✓ Conhece a Zona Leste de SP</span>
          <span>✓ Nunca revela ser IA</span>
          <span>✓ Biblioteca de 14 objeções</span>
          <span>✓ Escalação automática com email</span>
        </div>
      </div>

      {/* Stats */}
      {rt && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Estatísticas desta sessão
          </p>
          <div className="bg-gray-50 rounded-lg px-4 py-2">
            <StatRow label="Mensagens processadas" value={rt.totalProcessed} />
            <StatRow label="Respostas enviadas" value={rt.totalSent} />
            <StatRow
              label="Handoffs gerados"
              value={rt.totalHandoffs}
              accent={rt.totalHandoffs > 0 ? 'text-orange-600' : undefined}
            />
            <StatRow
              label="Taxa de handoff"
              value={rt.handoffRate}
              accent={parseFloat(rt.handoffRate) > 30 ? 'text-orange-600' : 'text-green-600'}
            />
            <StatRow label="Sessões ativas agora" value={rt.activeSessions} accent="text-indigo-600" />
          </div>
        </div>
      )}

      {/* Test panel */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Testar Maya (Admin)
        </p>
        <AgentTestPanel />
      </div>
    </div>
  )
}
