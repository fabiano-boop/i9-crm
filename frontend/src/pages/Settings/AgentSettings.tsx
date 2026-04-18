import { useState, useEffect } from 'react'
import { agentApi, leadsApi, type AgentAnalytics, type Lead } from '../../services/api'
import { useToast } from '../../components/shared/ToastProvider'

const cardStyle: React.CSSProperties = {
  background: '#0B1F30',
  border: '1px solid rgba(0,200,232,0.14)',
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0F2840', border: '1px solid rgba(0,200,232,0.18)',
  color: '#E8F4F8', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none',
}

// ─── Test panel ───────────────────────────────────────────────────────────────
function AgentTestPanel() {
  const { addToast } = useToast()
  const [leads, setLeads]     = useState<Lead[]>([])
  const [leadId, setLeadId]   = useState('')
  const [message, setMessage] = useState('')
  const [testing, setTesting] = useState(false)
  const [result, setResult]   = useState<{ message: string; intent: string; stage: string; shouldHandoff: boolean } | null>(null)

  useEffect(() => {
    leadsApi.list({ limit: 50, page: 1 }).then(({ data }) => setLeads(data.data)).catch(() => null)
  }, [])

  async function handleTest() {
    if (!leadId || !message.trim()) return
    setTesting(true); setResult(null)
    try {
      const { data } = await agentApi.test(leadId, message)
      setResult(data.result)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      addToast({ type: 'hot_alert', title: 'Erro no teste', message: msg ?? 'Verifique ANTHROPIC_API_KEY', duration: 6000 })
    } finally { setTesting(false) }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#7EAFC4', fontFamily: 'monospace' }}>Lead para testar</label>
        <select value={leadId} onChange={(e) => setLeadId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="">Selecione um lead...</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>{l.name} — {l.businessName} ({l.classification})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#7EAFC4', fontFamily: 'monospace' }}>Mensagem simulada do lead</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Ex: Quanto custa o serviço de vocês?" rows={3}
          style={{ ...inputStyle, resize: 'none' }} />
      </div>
      <button onClick={handleTest} disabled={!leadId || !message.trim() || testing}
        className="text-sm font-bold px-5 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422' }}>
        {testing ? <><span className="animate-spin">⟳</span> Testando Maya...</> : '🧪 Testar resposta'}
      </button>

      {result && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,200,232,0.05)', border: '1px solid rgba(0,200,232,0.14)' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(26,110,255,0.15)', color: '#60a5fa' }}>Intent: {result.intent}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#c084fc' }}>Estágio: {result.stage}</span>
            {result.shouldHandoff && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>⚠️ Handoff recomendado</span>
            )}
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#7EAFC4' }}>Resposta da Maya:</p>
            <div className="rounded-lg px-3 py-2" style={{ background: '#0F2840', border: '1px solid rgba(0,200,232,0.1)' }}>
              <p className="text-sm whitespace-pre-wrap" style={{ color: '#E8F4F8' }}>{result.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── StatRow ─────────────────────────────────────────────────────────────────
function StatRow({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}>
      <span className="text-sm" style={{ color: '#7EAFC4' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: accent ?? '#E8F4F8', fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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
        message: newState ? 'Agente responderá leads automaticamente via WhatsApp' : 'Atendimento voltou ao modo manual',
        duration: 4000,
      })
    } catch {
      addToast({ type: 'hot_alert', title: 'Erro', message: 'Não foi possível alterar o estado', duration: 4000 })
    } finally { setToggling(false) }
  }

  const rt = analytics?.runtime

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>🤖 Agente Maya (WhatsApp IA)</h2>
          <p className="text-xs mt-0.5" style={{ color: '#7EAFC4' }}>
            Responde leads automaticamente, qualifica e escala para humano quando necessário
          </p>
        </div>
        {/* Toggle switch */}
        <button
          onClick={handleToggle}
          disabled={toggling || enabled === null}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50"
          style={{ background: enabled ? '#00C8E8' : 'rgba(0,200,232,0.15)', border: '1px solid rgba(0,200,232,0.3)' }}
        >
          <span
            className="inline-block h-4 w-4 transform rounded-full transition-transform"
            style={{
              background: enabled ? '#061422' : '#7EAFC4',
              transform: enabled ? 'translateX(24px)' : 'translateX(4px)',
            }}
          />
        </button>
      </div>

      {/* Status badge */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-5"
        style={enabled
          ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }
          : { background: 'rgba(0,200,232,0.05)', border: '1px solid rgba(0,200,232,0.12)' }}
      >
        <span className={`w-2 h-2 rounded-full ${enabled ? 'animate-pulse' : ''}`}
          style={{ background: enabled ? '#34d399' : '#5A9AB5' }} />
        <span className="text-sm font-medium" style={{ color: enabled ? '#34d399' : '#7EAFC4' }}>
          {enabled === null ? 'Carregando...' : enabled ? 'Maya está ativa e respondendo leads' : 'Maya está inativa — modo manual'}
        </span>
      </div>

      {/* Personality */}
      <div className="mb-5 p-4 rounded-xl" style={{ background: 'rgba(0,200,232,0.05)', border: '1px solid rgba(0,200,232,0.12)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#00C8E8', fontFamily: 'monospace' }}>
          Personalidade da Maya
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style={{ color: '#A8CCE0' }}>
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
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#7EAFC4', fontFamily: 'monospace' }}>
            Estatísticas desta sessão
          </p>
          <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(0,200,232,0.04)', border: '1px solid rgba(0,200,232,0.08)' }}>
            <StatRow label="Mensagens processadas" value={rt.totalProcessed} />
            <StatRow label="Respostas enviadas"    value={rt.totalSent} />
            <StatRow label="Handoffs gerados"      value={rt.totalHandoffs}
              accent={rt.totalHandoffs > 0 ? '#f97316' : undefined} />
            <StatRow label="Taxa de handoff"       value={rt.handoffRate}
              accent={parseFloat(rt.handoffRate) > 30 ? '#f97316' : '#34d399'} />
            <StatRow label="Sessões ativas agora"  value={rt.activeSessions} accent="#00C8E8" />
          </div>
        </div>
      )}

      {/* Test */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#7EAFC4', fontFamily: 'monospace' }}>
          Testar Maya (Admin)
        </p>
        <AgentTestPanel />
      </div>
    </div>
  )
}
