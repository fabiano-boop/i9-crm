import { useEffect, useState } from 'react'
import { leadsApi, campaignsApi, alertsApi, type Lead, type Campaign, type OpportunityAlert } from '../services/api'
import ScoreBadge from '../components/shared/ScoreBadge'

const STAGE_LABELS: Record<string, string> = {
  new: 'Novo', contacted: 'Contatado', replied: 'Respondeu',
  proposal: 'Proposta', negotiation: 'Negociação', closed: 'Fechado', lost: 'Perdido',
}
const STAGE_ORDER = ['new', 'contacted', 'replied', 'proposal', 'negotiation', 'closed', 'lost']

export default function Dashboard() {
  const [hotLeads, setHotLeads]     = useState<Lead[]>([])
  const [allLeads, setAllLeads]     = useState<Lead[]>([])
  const [campaigns, setCampaigns]   = useState<Campaign[]>([])
  const [topAlerts, setTopAlerts]   = useState<OpportunityAlert[]>([])
  const [totalLeads, setTotalLeads] = useState(0)
  const [totalHot, setTotalHot]     = useState(0)
  const [totalWarm, setTotalWarm]   = useState(0)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [allRes, hotRes, warmRes, campaignRes, alertsRes] = await Promise.all([
          leadsApi.list({ limit: 200 }),
          leadsApi.list({ classification: 'HOT', limit: 5 }),
          leadsApi.list({ classification: 'WARM', limit: 1 }),
          campaignsApi.list({ limit: 10 }),
          alertsApi.list({ isDismissed: false, isRead: false, limit: 5 }),
        ])
        setTotalLeads(allRes.data.meta.total)
        setTotalHot(hotRes.data.meta.total)
        setTotalWarm(warmRes.data.meta.total)
        setHotLeads(hotRes.data.data)
        setAllLeads(allRes.data.data)
        setCampaigns(campaignRes.data.data)
        setTopAlerts(alertsRes.data.data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Pipeline funnel counts
  const stageCounts = STAGE_ORDER.reduce((acc, s) => {
    acc[s] = allLeads.filter((l) => (l.pipelineStage || 'new') === s).length
    return acc
  }, {} as Record<string, number>)
  const maxCount = Math.max(...Object.values(stageCounts), 1)

  const coldLeads = totalLeads - totalHot - totalWarm

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Visão geral do seu pipeline — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard icon="👥" label="Total de Leads" value={totalLeads} sub="cadastrados no CRM" color="blue" loading={loading} />
        <KPICard icon="🔥" label="Leads HOT" value={totalHot} sub="prontos para fechar" color="red" loading={loading} />
        <KPICard icon="🌤" label="Leads WARM" value={totalWarm} sub="em nutrição" color="yellow" loading={loading} />
        <KPICard icon="❄️" label="COLD" value={coldLeads} sub="precisam de atenção" color="blue-light" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top HOT Leads */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">🔥 Top HOT Leads</h2>
            <a href="/leads?classification=HOT" className="text-xs text-blue-600 hover:underline">Ver todos →</a>
          </div>
          {loading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : hotLeads.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">Nenhum lead HOT ainda</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {hotLeads.map((lead) => (
                <div key={lead.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{lead.businessName}</p>
                    <p className="text-xs text-gray-400 truncate">{lead.neighborhood} · {lead.niche}</p>
                    {lead.whatsappAngle && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 italic">"{lead.whatsappAngle}"</p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <ScoreBadge score={lead.score} classification={lead.classification} />
                    {lead.whatsapp && (
                      <a
                        href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                      >
                        WA
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline Funnel */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">📊 Funil do Pipeline</h2>
            <a href="/pipeline" className="text-xs text-blue-600 hover:underline">Abrir kanban →</a>
          </div>
          {loading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : (
            <div className="px-5 py-4 space-y-2">
              {STAGE_ORDER.map((stage) => {
                const count = stageCounts[stage] ?? 0
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
                const isGood = stage === 'closed'
                const isBad = stage === 'lost'
                const barColor = isGood ? 'bg-emerald-500' : isBad ? 'bg-red-400' : 'bg-blue-500'
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-24 shrink-0">{STAGE_LABELS[stage]}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold w-6 text-right ${isGood ? 'text-emerald-600' : isBad ? 'text-red-500' : 'text-gray-700'}`}>
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Janelas de Oportunidade */}
      {(loading || topAlerts.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">🚨 Janelas de hoje</h2>
            <span className="text-xs text-gray-400">Top alertas de urgência</span>
          </div>
          {loading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {topAlerts.map((alert) => (
                <div key={alert.id} className="px-5 py-3.5 flex items-center gap-3">
                  <span className={`text-sm font-bold shrink-0 w-8 ${
                    alert.urgency >= 9 ? 'text-red-600' : alert.urgency >= 7 ? 'text-orange-500' : 'text-yellow-600'
                  }`}>
                    {alert.urgency}/10
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{alert.title}</p>
                    <p className="text-xs text-gray-400 truncate">{alert.description}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(alert.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Campanhas recentes */}
      {campaigns.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">📣 Campanhas recentes</h2>
            <a href="/campaigns" className="text-xs text-blue-600 hover:underline">Ver todas →</a>
          </div>
          <div className="divide-y divide-gray-50">
            {campaigns.slice(0, 5).map((c) => (
              <div key={c.id} className="px-5 py-3.5 flex items-center gap-3">
                <span className="text-xl">{c.type === 'WHATSAPP' ? '💬' : c.type === 'EMAIL' ? '📧' : '📣'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">{c._count?.campaignLeads ?? 0} leads · {new Date(c.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function KPICard({ icon, label, value, sub, color, loading }: {
  icon: string; label: string; value: number; sub: string; color: string; loading: boolean
}) {
  const dotColors: Record<string, string> = {
    blue: 'bg-blue-500', red: 'bg-red-500', yellow: 'bg-yellow-500', 'blue-light': 'bg-sky-400',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <div className={`w-2 h-2 rounded-full ${dotColors[color] ?? 'bg-gray-400'}`} />
      </div>
      <p className="text-3xl font-bold text-gray-900">{loading ? '—' : value}</p>
      <p className="text-sm font-medium text-gray-700 mt-1">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho', SCHEDULED: 'Agendada', RUNNING: 'Enviando', PAUSED: 'Pausada', COMPLETED: 'Concluída',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', SCHEDULED: 'bg-blue-100 text-blue-700',
  RUNNING: 'bg-yellow-100 text-yellow-700', PAUSED: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}
