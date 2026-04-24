import { useEffect, useState } from 'react'
import { leadsApi, campaignsApi, alertsApi, analyticsApi, settingsApi, type Lead, type Campaign, type OpportunityAlert, type FinancialAnalytics, type DashboardComparison, type SmartAlert } from '../services/api'
import ScoreBadge from '../components/shared/ScoreBadge'
import MetricDelta from '../components/shared/MetricDelta'

const STAGE_LABELS: Record<string, string> = {
  new: 'Novo', contacted: 'Contatado', replied: 'Respondeu',
  proposal: 'Proposta', negotiation: 'Negociação', closed: 'Fechado', lost: 'Perdido',
}
const STAGE_ORDER = ['new', 'contacted', 'replied', 'proposal', 'negotiation', 'closed', 'lost']

export default function Dashboard() {
  const [hotLeads, setHotLeads]       = useState<Lead[]>([])
  const [allLeads, setAllLeads]       = useState<Lead[]>([])
  const [campaigns, setCampaigns]     = useState<Campaign[]>([])
  const [topAlerts, setTopAlerts]     = useState<OpportunityAlert[]>([])
  const [totalLeads, setTotalLeads]   = useState(0)
  const [totalHot, setTotalHot]       = useState(0)
  const [totalWarm, setTotalWarm]     = useState(0)
  const [loading, setLoading]         = useState(true)
  // SPRINT 1: estado financeiro
  const [financial, setFinancial]     = useState<FinancialAnalytics['summary'] | null>(null)
  const [comparison, setComparison]   = useState<DashboardComparison | null>(null)
  // SPRINT 3.4: alertas inteligentes + meta MRR
  const [smartAlerts, setSmartAlerts] = useState<SmartAlert[]>([])
  const [mrrGoal, setMrrGoal]         = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const [allRes, hotRes, warmRes, campaignRes, alertsRes, financialRes, comparisonRes, smartRes, settingsRes] = await Promise.all([
          leadsApi.list({ limit: 200 }),
          leadsApi.list({ classification: 'HOT', limit: 5 }),
          leadsApi.list({ classification: 'WARM', limit: 1 }),
          campaignsApi.list({ limit: 10 }),
          alertsApi.list({ isDismissed: false, isRead: false, limit: 5 }),
          analyticsApi.financial().catch(() => null),
          analyticsApi.comparison().catch(() => null),
          // SPRINT 3.4: alertas inteligentes + meta MRR
          alertsApi.smart().catch(() => null),
          settingsApi.get().catch(() => null),
        ])
        setTotalLeads(allRes.data.meta.total)
        setTotalHot(hotRes.data.meta.total)
        setTotalWarm(warmRes.data.meta.total)
        setHotLeads(hotRes.data.data)
        setAllLeads(allRes.data.data)
        setCampaigns(campaignRes.data.data)
        setTopAlerts(alertsRes.data.data)
        if (financialRes?.data?.summary) setFinancial(financialRes.data.summary)
        if (comparisonRes?.data) setComparison(comparisonRes.data)
        if (smartRes?.data) setSmartAlerts(smartRes.data)
        if (settingsRes?.data?.monthlyMrrGoal) setMrrGoal(settingsRes.data.monthlyMrrGoal)
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

  // SPRINT 1: Taxa de conversão real = fechados / total com estágio definido
  const closedCount = stageCounts['closed'] ?? 0
  const activeInPipeline = STAGE_ORDER.filter(s => s !== 'lost').reduce((s, k) => s + (stageCounts[k] ?? 0), 0)
  const conversionPct = activeInPipeline > 0 ? Math.round((closedCount / activeInPipeline) * 100) : 0

  // SPRINT 1: formatação de moeda
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

  return (
    <div className="p-6" style={{ background: '#061422', minHeight: '100%' }}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: '#E8F4F8' }}
          >
            Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>
            Visão geral do seu pipeline —{' '}
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* SPRINT 3.4: Painel de alertas inteligentes */}
      {!loading && smartAlerts.length > 0 && (
        <div
          className="rounded-xl overflow-hidden mb-6"
          style={{ background: '#0B1F30', border: '1px solid rgba(249,115,22,0.25)' }}
        >
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(249,115,22,0.12)' }}>
            <h2 className="font-semibold text-sm" style={{ color: '#E8F4F8' }}>
              ⚡ Alertas Inteligentes
              <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c' }}>
                {smartAlerts.length}
              </span>
            </h2>
            <span className="text-xs" style={{ color: '#7EAFC4' }}>Requer atenção</span>
          </div>
          <div>
            {smartAlerts.slice(0, 6).map((alert, i) => {
              const icons: Record<string, string> = { DEAL_STALLED: '🔄', OVERDUE_INVOICE: '💸', HOT_LEAD_IDLE: '🔥' }
              return (
                <div
                  key={i}
                  className="px-5 py-3 flex items-center gap-3"
                  style={{ borderBottom: i < Math.min(smartAlerts.length, 6) - 1 ? '1px solid rgba(0,200,232,0.06)' : 'none' }}
                >
                  <span className="text-lg shrink-0">{icons[alert.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#E8F4F8' }}>{alert.entityName}</p>
                    <p className="text-xs truncate" style={{ color: '#7EAFC4' }}>{alert.message}</p>
                  </div>
                  <span
                    className="text-xs font-semibold shrink-0 px-2 py-0.5 rounded-full"
                    style={alert.severity === 'high'
                      ? { background: 'rgba(239,68,68,0.15)', color: '#f87171' }
                      : { background: 'rgba(234,179,8,0.15)', color: '#fbbf24' }}
                  >
                    {alert.severity === 'high' ? 'Alta' : 'Média'}
                  </span>
                  <a
                    href={alert.actionUrl}
                    className="text-xs font-semibold shrink-0 px-3 py-1 rounded-lg transition-colors"
                    style={{ background: 'rgba(0,200,232,0.1)', color: '#00C8E8' }}
                  >
                    Ver →
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPICard icon="👥" label="Total de Leads"  value={totalLeads}    sub="cadastrados no CRM"    dotColor="#1A6EFF" loading={loading} delta={comparison?.deltas.leads} />
        <KPICard icon="🔥" label="Leads HOT"       value={totalHot}      sub="prontos para fechar"   dotColor="#FF5050" loading={loading} />
        <KPICard icon="🌤" label="Leads WARM"      value={totalWarm}     sub="em nutrição"            dotColor="#F59E0B" loading={loading} />
        <KPICard icon="❄️" label="COLD"            value={coldLeads}     sub="precisam de atenção"   dotColor="#00C8E8" loading={loading} />
        {/* SPRINT 1: Conversão real */}
        <KPICard icon="🎯" label="Conversão"       value={conversionPct} sub="fechados / pipeline"   dotColor="#10b981" loading={loading} suffix="%" delta={comparison?.deltas.deals ? { ...comparison.deltas.deals, percent: comparison.deltas.deals.value } : undefined} showPercent={false} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Top HOT Leads */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)' }}
        >
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(0,200,232,0.10)' }}
          >
            <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>🔥 Top HOT Leads</h2>
            <a
              href="/leads?classification=HOT"
              className="text-xs hover:underline"
              style={{ color: '#00C8E8' }}
            >
              Ver todos →
            </a>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm" style={{ color: '#7EAFC4' }}>Carregando...</div>
          ) : hotLeads.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: '#7EAFC4' }}>Nenhum lead HOT ainda</div>
          ) : (
            <div>
              {hotLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="px-5 py-3.5 flex items-center gap-3 transition-colors"
                  style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" style={{ color: '#E8F4F8' }}>
                      {lead.businessName}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#7EAFC4' }}>
                      {lead.neighborhood} · {lead.niche}
                    </p>
                    {lead.whatsappAngle && (
                      <p className="text-xs mt-0.5 line-clamp-1 italic" style={{ color: '#5A9AB5' }}>
                        "{lead.whatsappAngle}"
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <ScoreBadge score={lead.score} classification={lead.classification} />
                    {lead.whatsapp && (
                      <a
                        href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                        style={{ background: '#16a34a' }}
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
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)' }}
        >
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(0,200,232,0.10)' }}
          >
            <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>📊 Funil do Pipeline</h2>
            <a
              href="/pipeline"
              className="text-xs hover:underline"
              style={{ color: '#00C8E8' }}
            >
              Abrir kanban →
            </a>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm" style={{ color: '#7EAFC4' }}>Carregando...</div>
          ) : (
            <div className="px-5 py-4 space-y-2.5">
              {STAGE_ORDER.map((stage) => {
                const count   = stageCounts[stage] ?? 0
                const pct     = maxCount > 0 ? (count / maxCount) * 100 : 0
                const isGood  = stage === 'closed'
                const isBad   = stage === 'lost'
                const barColor = isGood ? '#10b981' : isBad ? '#ef4444' : '#00C8E8'
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <span className="text-xs w-24 shrink-0" style={{ color: '#7EAFC4' }}>
                      {STAGE_LABELS[stage]}
                    </span>
                    <div
                      className="flex-1 h-5 rounded-full overflow-hidden"
                      style={{ background: 'rgba(0,200,232,0.08)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(pct, count > 0 ? 4 : 0)}%`,
                          background: barColor,
                          boxShadow: count > 0 ? `0 0 8px ${barColor}55` : 'none',
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-semibold w-6 text-right"
                      style={{ color: isGood ? '#10b981' : isBad ? '#ef4444' : '#A8CCE0' }}
                    >
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* SPRINT 1: Resumo Financeiro — alimentado pelo /analytics/financial */}
      {(financial || loading) && (
        <div
          className="rounded-xl overflow-hidden mb-6"
          style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)' }}
        >
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(0,200,232,0.10)' }}
          >
            <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>💰 Resumo Financeiro</h2>
            <a href="/clients" className="text-xs hover:underline" style={{ color: '#00C8E8' }}>
              Ver clientes →
            </a>
          </div>
          {loading ? (
            <div className="py-6 text-center text-sm" style={{ color: '#7EAFC4' }}>Carregando...</div>
          ) : financial ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-0">
              {[
                { label: 'Receita MRR',   value: fmt(financial.totalRevenue), color: '#10b981', icon: '📈', delta: comparison?.deltas.mrr },
                { label: 'Custo Interno', value: fmt(financial.totalCost),    color: '#f97316', icon: '💸', delta: undefined },
                { label: 'Lucro Líquido', value: fmt(financial.totalProfit),  color: financial.totalProfit >= 0 ? '#10b981' : '#ef4444', icon: '🏦', delta: undefined },
                { label: 'Margem Média',  value: `${financial.avgMargin}%`,   color: financial.avgMargin >= 50 ? '#10b981' : financial.avgMargin >= 20 ? '#f59e0b' : '#ef4444', icon: '📊', delta: undefined },
              ].map((item, i) => (
                <div
                  key={i}
                  className="px-5 py-4 flex items-center gap-3"
                  style={{ borderRight: i < 3 ? '1px solid rgba(0,200,232,0.08)' : 'none' }}
                >
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-lg font-bold" style={{ color: item.color, fontFamily: 'monospace' }}>
                      {item.value}
                    </p>
                    {/* SPRINT 3.2: delta MRR no card Receita */}
                    {item.delta && (
                      <div className="mt-0.5">
                        <MetricDelta value={item.delta.percent} direction={item.delta.direction} />
                      </div>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: '#7EAFC4' }}>{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm" style={{ color: '#7EAFC4' }}>Sem dados financeiros</div>
          )}
          {/* SPRINT 3.4: barra de progresso meta de MRR */}
          {financial && mrrGoal > 0 && !loading && (() => {
            const progress = Math.min((financial.totalRevenue / mrrGoal) * 100, 100)
            const barColor = progress >= 100 ? '#10b981' : progress >= 75 ? '#eab308' : '#00C8E8'
            return (
              <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(0,200,232,0.08)' }}>
                <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: '#7EAFC4' }}>
                  <span>
                    {fmt(financial.totalRevenue)} / Meta {fmt(mrrGoal)}
                  </span>
                  <span className="font-bold" style={{ color: barColor }}>{progress.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,200,232,0.08)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progress}%`, background: barColor, boxShadow: `0 0 8px ${barColor}55` }}
                  />
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Janelas de Oportunidade */}
      {(loading || topAlerts.length > 0) && (
        <div
          className="rounded-xl overflow-hidden mb-6"
          style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)' }}
        >
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(0,200,232,0.10)' }}
          >
            <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>🚨 Janelas de hoje</h2>
            <span className="text-xs" style={{ color: '#7EAFC4' }}>Top alertas de urgência</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm" style={{ color: '#7EAFC4' }}>Carregando...</div>
          ) : (
            <div>
              {topAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="px-5 py-3.5 flex items-center gap-3"
                  style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}
                >
                  <span
                    className="text-sm font-bold shrink-0 w-8"
                    style={{
                      color: alert.urgency >= 9 ? '#ef4444' : alert.urgency >= 7 ? '#f97316' : '#eab308',
                    }}
                  >
                    {alert.urgency}/10
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#E8F4F8' }}>
                      {alert.title}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#7EAFC4' }}>
                      {alert.description}
                    </p>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: '#5A9AB5' }}>
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
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)' }}
        >
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(0,200,232,0.10)' }}
          >
            <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>📣 Campanhas recentes</h2>
            <a
              href="/campaigns"
              className="text-xs hover:underline"
              style={{ color: '#00C8E8' }}
            >
              Ver todas →
            </a>
          </div>
          <div>
            {campaigns.slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="px-5 py-3.5 flex items-center gap-3"
                style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-xl">
                  {c.type === 'WHATSAPP' ? '💬' : c.type === 'EMAIL' ? '📧' : '📣'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#E8F4F8' }}>
                    {c.name}
                  </p>
                  <p className="text-xs" style={{ color: '#7EAFC4' }}>
                    {c._count?.campaignLeads ?? 0} leads · {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                  </p>
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

// ── KPI Card ──────────────────────────────────────────────
function KPICard({ icon, label, value, sub, dotColor, loading, suffix = '', delta, showPercent = true }: {
  icon: string; label: string; value: number; sub: string; dotColor: string; loading: boolean; suffix?: string
  // SPRINT 3.2: delta opcional para comparativo mês anterior
  delta?: { value: number; percent: number; direction: 'up' | 'down' | 'neutral' }
  showPercent?: boolean
}) {
  return (
    <div
      className="rounded-xl p-5 transition-all"
      style={{
        background: '#0B1F30',
        border: '1px solid rgba(0,200,232,0.14)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(0,200,232,0.35)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,200,232,0.10)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(0,200,232,0.14)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <div className="w-2 h-2 rounded-full" style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
      </div>
      <p
        className="text-3xl font-bold"
        style={{ color: '#00C8E8', fontFamily: 'monospace' }}
      >
        {loading ? '—' : `${value}${suffix}`}
      </p>
      {delta && !loading && (
        <div className="mt-0.5">
          <MetricDelta value={showPercent ? delta.percent : delta.value} direction={delta.direction} showPercent={showPercent} />
        </div>
      )}
      <p className="text-sm font-medium mt-1" style={{ color: '#E8F4F8' }}>{label}</p>
      <p className="text-xs mt-0.5" style={{ color: '#7EAFC4' }}>{sub}</p>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho', SCHEDULED: 'Agendada', RUNNING: 'Enviando',
  PAUSED: 'Pausada', COMPLETED: 'Concluída',
}
const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  DRAFT:     { background: 'rgba(100,116,139,0.2)', color: '#94a3b8' },
  SCHEDULED: { background: 'rgba(26,110,255,0.15)', color: '#60a5fa' },
  RUNNING:   { background: 'rgba(234,179,8,0.15)',  color: '#fbbf24' },
  PAUSED:    { background: 'rgba(249,115,22,0.15)', color: '#fb923c' },
  COMPLETED: { background: 'rgba(16,185,129,0.15)', color: '#34d399' },
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? { background: 'rgba(100,116,139,0.2)', color: '#94a3b8' }
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={style}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}
