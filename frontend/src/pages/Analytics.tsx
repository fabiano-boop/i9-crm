import { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { leadsApi, campaignsApi, agentApi, type AgentAnalytics } from '../services/api'
import type { Lead, Campaign } from '../services/api'

const STAGE_LABELS: Record<string, string> = {
  new: 'Novo', contacted: 'Contatado', replied: 'Respondeu',
  proposal: 'Proposta', negotiation: 'Negociação', closed: 'Fechado', lost: 'Perdido',
}
const STAGE_ORDER = ['new', 'contacted', 'replied', 'proposal', 'negotiation', 'closed', 'lost']

const CLASSIFICATION_COLORS: Record<string, string> = {
  HOT: '#ef4444', WARM: '#eab308', COLD: '#3b82f6',
}
const CLASSIFICATION_LABELS: Record<string, string> = {
  HOT: 'Quente', WARM: 'Morno', COLD: 'Frio',
}

const CAMPAIGN_STATUS_BADGE: Record<Campaign['status'], { label: string; bg: string; color: string }> = {
  DRAFT:     { label: 'Rascunho',  bg: 'rgba(100,116,139,0.2)', color: '#94a3b8' },
  SCHEDULED: { label: 'Agendada',  bg: 'rgba(26,110,255,0.15)', color: '#60a5fa' },
  RUNNING:   { label: 'Enviando',  bg: 'rgba(234,179,8,0.15)',  color: '#fbbf24' },
  PAUSED:    { label: 'Pausada',   bg: 'rgba(249,115,22,0.15)', color: '#fb923c' },
  COMPLETED: { label: 'Concluída', bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
}
const CAMPAIGN_TYPE_ICON: Record<Campaign['type'], string> = { WHATSAPP: '💬', EMAIL: '📧', BOTH: '📣' }
const CAMPAIGN_TYPE_LABEL: Record<Campaign['type'], string> = { WHATSAPP: 'WhatsApp', EMAIL: 'E-mail', BOTH: 'Ambos' }

const INTENT_LABELS: Record<string, string> = {
  interested: 'Interessado', not_interested: 'Sem interesse', has_objection: 'Com objeção',
  wants_price: 'Perguntou preço', wants_meeting: 'Quer reunião', already_has: 'Já tem parceiro', unclear: 'Não claro',
}
const INTENT_COLORS: Record<string, string> = {
  interested: '#22c55e', not_interested: '#ef4444', has_objection: '#f97316',
  wants_price: '#3b82f6', wants_meeting: '#8b5cf6', already_has: '#6b7280', unclear: '#d1d5db',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })
}

const cardStyle: React.CSSProperties = {
  background: '#0B1F30',
  border: '1px solid rgba(0,200,232,0.14)',
  borderRadius: 12,
  padding: 20,
}

function KPICard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={cardStyle} className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#7EAFC4' }}>{label}</span>
      <span className="text-3xl font-bold" style={{ color: accent ?? '#00C8E8', fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold mb-4" style={{ color: '#E8F4F8' }}>{children}</h2>
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-sm" style={{ background: '#0F2840', border: '1px solid rgba(0,200,232,0.2)' }}>
      {label && <p className="font-medium mb-1" style={{ color: '#E8F4F8' }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill ?? '#A8CCE0' }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-24 text-sm" style={{ color: '#7EAFC4' }}>
      {message}
    </div>
  )
}

export default function Analytics() {
  const [leads, setLeads]         = useState<Lead[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [agentData, setAgentData] = useState<AgentAnalytics | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [leadsRes, campaignsRes, agentRes] = await Promise.all([
          leadsApi.list({ limit: 200, page: 1 }),
          campaignsApi.list({ limit: 100 }),
          agentApi.analytics().catch(() => null),
        ])
        setLeads(leadsRes.data.data)
        setCampaigns(campaignsRes.data.data)
        if (agentRes) setAgentData(agentRes.data)
      } catch (err) {
        setError('Não foi possível carregar os dados. Verifique a conexão com o servidor.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const totalLeads     = leads.length
  const hotCount       = leads.filter((l) => l.classification === 'HOT').length
  const warmCount      = leads.filter((l) => l.classification === 'WARM').length
  const totalCampaigns = campaigns.length

  const classificationData = (['HOT', 'WARM', 'COLD'] as const).map((cls) => ({
    name: CLASSIFICATION_LABELS[cls],
    value: leads.filter((l) => l.classification === cls).length,
    key: cls,
  }))

  const nicheMap: Record<string, number> = {}
  for (const lead of leads) {
    const niche = lead.niche?.trim() || 'Sem nicho'
    nicheMap[niche] = (nicheMap[niche] ?? 0) + 1
  }
  const nicheData = Object.entries(nicheMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }))

  const stageMap: Record<string, number> = {}
  for (const lead of leads) {
    const stage = lead.pipelineStage?.toLowerCase() || 'new'
    stageMap[stage] = (stageMap[stage] ?? 0) + 1
  }
  const maxStageCount = Math.max(1, ...Object.values(stageMap))
  const stageRows = STAGE_ORDER.map((stage) => ({ stage, label: STAGE_LABELS[stage] ?? stage, count: stageMap[stage] ?? 0 }))

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl" style={{ background: '#0B1F30' }} />)}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-64 rounded-xl" style={{ background: '#0B1F30' }} />
          <div className="h-64 rounded-xl" style={{ background: '#0B1F30' }} />
        </div>
        <p className="text-center text-sm" style={{ color: '#7EAFC4' }}>Carregando...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="rounded-xl px-6 py-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#E8F4F8' }}>Analytics</h1>
        <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>Visão geral do desempenho de leads e campanhas</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Total de leads"       value={totalLeads}     accent="#00C8E8" />
        <KPICard label="Leads quentes (HOT)"  value={hotCount}       accent="#ef4444" />
        <KPICard label="Leads mornos (WARM)"  value={warmCount}      accent="#eab308" />
        <KPICard label="Total de campanhas"   value={totalCampaigns} accent="#8b5cf6" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div style={cardStyle}>
          <SectionTitle>Leads por classificação</SectionTitle>
          {totalLeads === 0 ? <EmptyState message="Nenhum lead encontrado." /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={classificationData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}
                >
                  {classificationData.map((entry) => <Cell key={entry.key} fill={CLASSIFICATION_COLORS[entry.key]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={(value) => <span style={{ fontSize: 13, color: '#A8CCE0' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={cardStyle}>
          <SectionTitle>Top 5 nichos com mais leads</SectionTitle>
          {nicheData.length === 0 ? <EmptyState message="Nenhum dado de nicho disponível." /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={nicheData} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,200,232,0.08)" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#7EAFC4' }} allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: '#7EAFC4' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 15) + '…' : v}
                />
                <Tooltip content={({ active, payload, label }) => (
                  <ChartTooltip active={active} payload={payload?.map((p) => ({ name: 'Leads', value: p.value as number, fill: '#00C8E8' }))} label={label} />
                )} />
                <Bar dataKey="count" name="Leads" fill="#00C8E8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Pipeline funnel */}
      <div style={cardStyle}>
        <SectionTitle>Funil do pipeline</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,200,232,0.1)' }}>
                <th className="pb-2 font-medium text-left w-36 text-xs uppercase tracking-wide" style={{ color: '#7EAFC4' }}>Etapa</th>
                <th className="pb-2 font-medium text-right pr-4 w-16 text-xs uppercase tracking-wide" style={{ color: '#7EAFC4' }}>Leads</th>
                <th className="pb-2 font-medium text-left text-xs uppercase tracking-wide" style={{ color: '#7EAFC4' }}>Distribuição</th>
              </tr>
            </thead>
            <tbody>
              {stageRows.map(({ stage, label, count }) => {
                const pct = maxStageCount > 0 ? (count / maxStageCount) * 100 : 0
                const barColor = stage === 'closed' ? '#10b981' : stage === 'lost' ? '#ef4444' : '#00C8E8'
                return (
                  <tr key={stage} style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}>
                    <td className="py-2.5 pr-4">
                      <span className="font-medium" style={{ color: stage === 'closed' ? '#10b981' : stage === 'lost' ? '#ef4444' : '#A8CCE0' }}>
                        {label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className="font-semibold tabular-nums" style={{ color: '#E8F4F8' }}>{count}</span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: 'rgba(0,200,232,0.08)' }}>
                          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                        <span className="text-xs w-8 text-right" style={{ color: '#7EAFC4' }}>{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agente Maya */}
      {agentData && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold mb-1" style={{ color: '#E8F4F8' }}>🤖 Agente Maya</h2>
            <p className="text-xs" style={{ color: '#7EAFC4' }}>Estatísticas de atendimento automático via WhatsApp</p>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Mensagens enviadas', value: agentData.database.totalMessagesSent,   accent: '#8b5cf6' },
              { label: 'Leads atendidos',    value: agentData.database.uniqueLeadsAttended, accent: '#00C8E8' },
              { label: 'Handoffs gerados',   value: agentData.runtime.totalHandoffs,        accent: agentData.runtime.totalHandoffs > 0 ? '#f97316' : '#00C8E8' },
              { label: 'Taxa de handoff',    value: agentData.runtime.handoffRate,          accent: parseFloat(agentData.runtime.handoffRate) > 30 ? '#f97316' : '#10b981' },
            ].map(({ label, value, accent }) => (
              <KPICard key={label} label={label} value={value} accent={accent} />
            ))}
          </div>
          {Object.keys(agentData.runtime.intentCounts).length > 0 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div style={cardStyle}>
                <SectionTitle>Distribuição de intenções</SectionTitle>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={Object.entries(agentData.runtime.intentCounts).map(([key, value]) => ({ name: INTENT_LABELS[key] ?? key, value, key }))}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}
                    >
                      {Object.keys(agentData.runtime.intentCounts).map((key) => <Cell key={key} fill={INTENT_COLORS[key] ?? '#94a3b8'} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={cardStyle}>
                <SectionTitle>Estágios das conversas</SectionTitle>
                {Object.keys(agentData.runtime.stageCounts).length === 0 ? <EmptyState message="Nenhuma conversa registrada ainda." /> : (
                  <div className="space-y-3 mt-2">
                    {Object.entries(agentData.runtime.stageCounts).sort((a, b) => b[1] - a[1]).map(([stage, count]) => {
                      const total = Object.values(agentData.runtime.stageCounts).reduce((a, b) => a + b, 0)
                      const pct = total > 0 ? (count / total) * 100 : 0
                      const stageLabel: Record<string, string> = {
                        first_contact: 'Primeiro contato', qualifying: 'Qualificando', presenting: 'Apresentando',
                        handling_objection: 'Contornando objeção', scheduling: 'Agendando', human_needed: 'Handoff',
                      }
                      return (
                        <div key={stage}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span style={{ color: '#A8CCE0' }}>{stageLabel[stage] ?? stage}</span>
                            <span className="font-semibold tabular-nums" style={{ color: '#E8F4F8' }}>{count}</span>
                          </div>
                          <div className="rounded-full h-1.5" style={{ background: 'rgba(0,200,232,0.08)' }}>
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: '#00C8E8' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Campanhas */}
      <div style={cardStyle}>
        <SectionTitle>Campanhas</SectionTitle>
        {campaigns.length === 0 ? <EmptyState message="Nenhuma campanha cadastrada ainda." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,200,232,0.1)' }}>
                  {['Nome', 'Canal', 'Status', 'Leads', 'Criada em'].map((h, i) => (
                    <th key={h} className={`pb-2 font-medium text-xs uppercase tracking-wide ${i >= 3 ? 'text-right' : 'text-left'}`} style={{ color: '#7EAFC4' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const badge = CAMPAIGN_STATUS_BADGE[campaign.status]
                  const leadsCount = campaign._count?.campaignLeads ?? 0
                  return (
                    <tr
                      key={campaign.id}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="py-3 pr-4">
                        <span className="font-medium" style={{ color: '#E8F4F8' }}>{campaign.name}</span>
                        {campaign.description && <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: '#7EAFC4' }}>{campaign.description}</p>}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5" style={{ color: '#A8CCE0' }}>
                          <span>{CAMPAIGN_TYPE_ICON[campaign.type]}</span>
                          <span>{CAMPAIGN_TYPE_LABEL[campaign.type]}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="font-semibold tabular-nums" style={{ color: '#E8F4F8' }}>{leadsCount}</span>
                      </td>
                      <td className="py-3 text-right tabular-nums" style={{ color: '#7EAFC4' }}>{formatDate(campaign.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
