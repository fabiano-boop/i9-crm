import { useEffect, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { leadsApi, campaignsApi, agentApi, type AgentAnalytics } from '../services/api'
import type { Lead, Campaign } from '../services/api'

// ─── helpers ───────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  new: 'Novo',
  contacted: 'Contatado',
  replied: 'Respondeu',
  proposal: 'Proposta',
  negotiation: 'Negociação',
  closed: 'Fechado',
  lost: 'Perdido',
}

const STAGE_ORDER = ['new', 'contacted', 'replied', 'proposal', 'negotiation', 'closed', 'lost']

const CLASSIFICATION_COLORS: Record<string, string> = {
  HOT: '#ef4444',
  WARM: '#eab308',
  COLD: '#3b82f6',
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  HOT: 'Quente',
  WARM: 'Morno',
  COLD: 'Frio',
}

const CAMPAIGN_STATUS_BADGE: Record<
  Campaign['status'],
  { label: string; classes: string }
> = {
  DRAFT: { label: 'Rascunho', classes: 'bg-gray-100 text-gray-600' },
  SCHEDULED: { label: 'Agendada', classes: 'bg-blue-100 text-blue-700' },
  RUNNING: { label: 'Enviando', classes: 'bg-yellow-100 text-yellow-700' },
  PAUSED: { label: 'Pausada', classes: 'bg-orange-100 text-orange-700' },
  COMPLETED: { label: 'Concluída', classes: 'bg-green-100 text-green-700' },
}

const CAMPAIGN_TYPE_ICON: Record<Campaign['type'], string> = {
  WHATSAPP: '💬',
  EMAIL: '📧',
  BOTH: '📣',
}

const CAMPAIGN_TYPE_LABEL: Record<Campaign['type'], string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  BOTH: 'Ambos',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

// ─── sub-components ────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1 shadow-sm">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-3xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-gray-800 mb-4">{children}</h2>
  )
}

// Custom tooltip shared between charts
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; fill?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-sm">
      {label && <p className="font-medium text-gray-700 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill ?? '#374151' }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ─── main component ────────────────────────────────────────────────────────

const INTENT_LABELS: Record<string, string> = {
  interested:    'Interessado',
  not_interested: 'Sem interesse',
  has_objection: 'Com objeção',
  wants_price:   'Perguntou preço',
  wants_meeting: 'Quer reunião',
  already_has:   'Já tem parceiro',
  unclear:       'Não claro',
}

const INTENT_COLORS: Record<string, string> = {
  interested:    '#22c55e',
  not_interested: '#ef4444',
  has_objection: '#f97316',
  wants_price:   '#3b82f6',
  wants_meeting: '#8b5cf6',
  already_has:   '#6b7280',
  unclear:       '#d1d5db',
}

export default function Analytics() {
  const [leads, setLeads]           = useState<Lead[]>([])
  const [campaigns, setCampaigns]   = useState<Campaign[]>([])
  const [agentData, setAgentData]   = useState<AgentAnalytics | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

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

  // ── derivations ──────────────────────────────────────────────────────────

  const totalLeads = leads.length
  const hotCount = leads.filter((l) => l.classification === 'HOT').length
  const warmCount = leads.filter((l) => l.classification === 'WARM').length
  const totalCampaigns = campaigns.length

  // Pie: classification distribution
  const classificationData = (['HOT', 'WARM', 'COLD'] as const).map((cls) => ({
    name: CLASSIFICATION_LABELS[cls],
    value: leads.filter((l) => l.classification === cls).length,
    key: cls,
  }))

  // Bar: top 5 niches
  const nicheMap: Record<string, number> = {}
  for (const lead of leads) {
    const niche = lead.niche?.trim() || 'Sem nicho'
    nicheMap[niche] = (nicheMap[niche] ?? 0) + 1
  }
  const nicheData = Object.entries(nicheMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // Pipeline funnel
  const stageMap: Record<string, number> = {}
  for (const lead of leads) {
    const stage = lead.pipelineStage?.toLowerCase() || 'new'
    stageMap[stage] = (stageMap[stage] ?? 0) + 1
  }
  const maxStageCount = Math.max(1, ...Object.values(stageMap))
  const stageRows = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage] ?? stage,
    count: stageMap[stage] ?? 0,
  }))

  // ── loading / error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-64 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
        <div className="h-48 bg-gray-100 rounded-xl" />
        <div className="h-64 bg-gray-100 rounded-xl" />
        <p className="text-center text-sm text-gray-400">Carregando...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-red-700 text-sm">
          {error}
        </div>
      </div>
    )
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Visão geral do desempenho de leads e campanhas
        </p>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard label="Total de leads" value={totalLeads} />
        <KPICard label="Leads quentes (HOT)" value={hotCount} accent="text-red-500" />
        <KPICard label="Leads mornos (WARM)" value={warmCount} accent="text-yellow-500" />
        <KPICard label="Total de campanhas" value={totalCampaigns} accent="text-indigo-600" />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pie: classification */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>Leads por classificação</SectionTitle>
          {totalLeads === 0 ? (
            <EmptyState message="Nenhum lead encontrado." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={classificationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {classificationData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={CLASSIFICATION_COLORS[entry.key]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span className="text-sm text-gray-600">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar: top niches */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>Top 5 nichos com mais leads</SectionTitle>
          {nicheData.length === 0 ? (
            <EmptyState message="Nenhum dado de nicho disponível." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={nicheData}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: string) =>
                    v.length > 16 ? v.slice(0, 15) + '…' : v
                  }
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload?.map((p) => ({
                        name: 'Leads',
                        value: p.value as number,
                        fill: '#6366f1',
                      }))}
                      label={label}
                    />
                  )}
                />
                <Bar dataKey="count" name="Leads" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Pipeline funnel table ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <SectionTitle>Funil do pipeline</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="pb-2 font-medium w-36">Etapa</th>
                <th className="pb-2 font-medium w-16 text-right pr-4">Leads</th>
                <th className="pb-2 font-medium">Distribuição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stageRows.map(({ stage, label, count }) => {
                const pct = maxStageCount > 0 ? (count / maxStageCount) * 100 : 0
                const isSpecial = stage === 'closed' || stage === 'lost'
                const barColor =
                  stage === 'closed'
                    ? 'bg-green-500'
                    : stage === 'lost'
                    ? 'bg-red-400'
                    : 'bg-indigo-500'

                return (
                  <tr key={stage} className="group">
                    <td className="py-2.5 pr-4">
                      <span
                        className={`font-medium ${isSpecial ? (stage === 'closed' ? 'text-green-700' : 'text-red-600') : 'text-gray-700'}`}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className="font-semibold text-gray-900 tabular-nums">{count}</span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Agente Maya ── */}
      {agentData && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-1">🤖 Agente Maya</h2>
            <p className="text-xs text-gray-400">Estatísticas de atendimento automático via WhatsApp</p>
          </div>

          {/* KPIs agente */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Mensagens enviadas',  value: agentData.database.totalMessagesSent,     accent: 'text-indigo-600' },
              { label: 'Leads atendidos',     value: agentData.database.uniqueLeadsAttended,   accent: 'text-blue-600' },
              { label: 'Handoffs gerados',    value: agentData.runtime.totalHandoffs,          accent: agentData.runtime.totalHandoffs > 0 ? 'text-orange-500' : undefined },
              { label: 'Taxa de handoff',     value: agentData.runtime.handoffRate,            accent: parseFloat(agentData.runtime.handoffRate) > 30 ? 'text-orange-500' : 'text-green-600' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">{label}</span>
                <span className={`text-3xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* Intent distribution */}
          {Object.keys(agentData.runtime.intentCounts).length > 0 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <SectionTitle>Distribuição de intenções</SectionTitle>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={Object.entries(agentData.runtime.intentCounts).map(([key, value]) => ({
                        name: INTENT_LABELS[key] ?? key,
                        value,
                        key,
                      }))}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {Object.keys(agentData.runtime.intentCounts).map((key) => (
                        <Cell key={key} fill={INTENT_COLORS[key] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <SectionTitle>Estágios das conversas</SectionTitle>
                {Object.keys(agentData.runtime.stageCounts).length === 0 ? (
                  <EmptyState message="Nenhuma conversa registrada ainda." />
                ) : (
                  <div className="space-y-3 mt-2">
                    {Object.entries(agentData.runtime.stageCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([stage, count]) => {
                        const total = Object.values(agentData.runtime.stageCounts).reduce((a, b) => a + b, 0)
                        const pct = total > 0 ? (count / total) * 100 : 0
                        const stageLabel: Record<string, string> = {
                          first_contact: 'Primeiro contato',
                          qualifying: 'Qualificando',
                          presenting: 'Apresentando',
                          handling_objection: 'Contornando objeção',
                          scheduling: 'Agendando',
                          human_needed: 'Handoff',
                        }
                        return (
                          <div key={stage}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-600">{stageLabel[stage] ?? stage}</span>
                              <span className="font-semibold text-gray-900 tabular-nums">{count}</span>
                            </div>
                            <div className="bg-gray-100 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-indigo-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
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

      {/* ── Campaigns table ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <SectionTitle>Campanhas</SectionTitle>
        {campaigns.length === 0 ? (
          <EmptyState message="Nenhuma campanha cadastrada ainda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="pb-2 font-medium">Nome</th>
                  <th className="pb-2 font-medium">Canal</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Leads</th>
                  <th className="pb-2 font-medium text-right">Criada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map((campaign) => {
                  const badge = CAMPAIGN_STATUS_BADGE[campaign.status]
                  const icon = CAMPAIGN_TYPE_ICON[campaign.type]
                  const typeLabel = CAMPAIGN_TYPE_LABEL[campaign.type]
                  const leadsCount = campaign._count?.campaignLeads ?? 0

                  return (
                    <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-gray-800">{campaign.name}</span>
                        {campaign.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
                            {campaign.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 text-gray-600">
                          <span>{icon}</span>
                          <span>{typeLabel}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="font-semibold text-gray-800 tabular-nums">
                          {leadsCount}
                        </span>
                      </td>
                      <td className="py-3 text-right text-gray-500 tabular-nums">
                        {formatDate(campaign.createdAt)}
                      </td>
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

// ─── shared empty state ────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-24 text-sm text-gray-400">
      {message}
    </div>
  )
}
