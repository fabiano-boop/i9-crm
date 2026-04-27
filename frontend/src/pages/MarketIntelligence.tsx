import { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { clientsApi, leadsApi, type ClientsOverview, type MrrProjection } from '../services/api'

const SEGMENTOS = [
  { key: 'salao_beleza', label: 'Salão de Beleza', color: '#f472b6', potencial: 85, ticket: 397, prioridade: 'alta'  },
  { key: 'restaurante',  label: 'Restaurante',     color: '#fb923c', potencial: 80, ticket: 547, prioridade: 'alta'  },
  { key: 'clinica',      label: 'Clínica',         color: '#60a5fa', potencial: 55, ticket: 697, prioridade: 'media' },
  { key: 'oficina',      label: 'Oficina',         color: '#a78bfa', potencial: 50, ticket: 397, prioridade: 'media' },
  { key: 'academia',     label: 'Academia',        color: '#34d399', potencial: 45, ticket: 397, prioridade: 'media' },
  { key: 'petshop',      label: 'Pet Shop',        color: '#fbbf24', potencial: 40, ticket: 347, prioridade: 'oport' },
]

const PRIORIDADE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  alta:  { bg: 'rgba(239,68,68,0.15)',  color: '#f87171', label: 'Alta' },
  media: { bg: 'rgba(234,179,8,0.15)',  color: '#fbbf24', label: 'Média' },
  oport: { bg: 'rgba(26,110,255,0.15)', color: '#60a5fa', label: 'Oportunidade' },
}

const EMPRESAS_REFERENCIA = [
  { nome: 'Salão da Deise',      bairro: 'Tatuapé',      nicho: 'Salão',   potencial: '🔥 HOT' },
  { nome: 'Pizzaria do Kaká',    bairro: 'Penha',        nicho: 'Rest.',   potencial: '🔥 HOT' },
  { nome: 'Auto Center Silva',   bairro: 'Itaquera',     nicho: 'Oficina', potencial: '🌤 WARM' },
  { nome: 'Clínica OdontoLeste', bairro: 'São Mateus',   nicho: 'Clínica', potencial: '🌤 WARM' },
  { nome: 'Academia Força Total', bairro: 'Guaianazes', nicho: 'Academia', potencial: '🌤 WARM' },
  { nome: 'Pet Prime',           bairro: 'Vila Matilde', nicho: 'Pet Shop', potencial: '🌤 WARM' },
  { nome: 'Restaurante Sabores', bairro: 'Ermelino',     nicho: 'Rest.',   potencial: '🔥 HOT' },
  { nome: 'Barbearia Kings',     bairro: 'Carrão',       nicho: 'Salão',   potencial: '🔥 HOT' },
  { nome: 'Clínica Bem Estar',   bairro: 'Sapopemba',    nicho: 'Clínica', potencial: '🌤 WARM' },
  { nome: 'Dog & Cat Petshop',   bairro: 'Cidade Líder', nicho: 'Pet Shop', potencial: '❄️ COLD' },
]

function calcProjection(hotLeads: number, warmLeads: number) {
  const fromHot  = Math.round(hotLeads  * 0.30)
  const fromWarm = Math.round(warmLeads * 0.10)
  const total = fromHot + fromWarm
  return { total, mrr: total * 1097 }
}

const cardStyle: React.CSSProperties = {
  background: '#0B1F30',
  border: '1px solid rgba(0,200,232,0.14)',
  borderRadius: 12,
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-sm" style={{ background: '#0F2840', border: '1px solid rgba(0,200,232,0.2)' }}>
      {label && <p className="font-medium mb-1" style={{ color: '#E8F4F8' }}>{label}</p>}
      {payload.map((p, i) => <p key={i} style={{ color: '#A8CCE0' }}>{p.name}: <span className="font-semibold">{p.value}</span></p>)}
    </div>
  )
}

export default function MarketIntelligence() {
  const [overview, setOverview]         = useState<ClientsOverview | null>(null)
  const [projection, setProjection]     = useState<MrrProjection | null>(null)
  const [leadCounts, setLeadCounts]     = useState({ hot: 0, warm: 0, cold: 0 })
  const [leadsByNiche, setLeadsByNiche] = useState<{ name: string; value: number; color: string }[]>([])
  const [showEmpresas, setShowEmpresas] = useState(false)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [overviewRes, projRes, leadsRes] = await Promise.allSettled([
          clientsApi.overview(), clientsApi.mrrProjection(), leadsApi.list({ limit: 5000 }),
        ])
        if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data)
        if (projRes.status === 'fulfilled')     setProjection(projRes.value.data)
        if (leadsRes.status === 'fulfilled') {
          const leads = leadsRes.value.data.data
          const hot  = leads.filter(l => l.classification === 'HOT').length
          const warm = leads.filter(l => l.classification === 'WARM').length
          const cold = leads.filter(l => l.classification === 'COLD').length
          setLeadCounts({ hot, warm, cold })
          const nicheMap: Record<string, number> = {}
          leads.forEach(l => { const k = l.niche?.toLowerCase() ?? 'outro'; nicheMap[k] = (nicheMap[k] ?? 0) + 1 })
          const NICHE_COLOR_MAP: Record<string, string> = {
            alimentacao: '#fb923c', alimentação: '#fb923c', restaurante: '#fb923c',
            pet: '#fbbf24', petshop: '#fbbf24',
            automotivo: '#a78bfa', oficina: '#a78bfa',
            beleza: '#f472b6', salao: '#f472b6', salão: '#f472b6',
            saude: '#60a5fa', saúde: '#60a5fa', clinica: '#60a5fa', clínica: '#60a5fa',
            estetica: '#34d399', estética: '#34d399', academia: '#34d399',
          }
          const niched = Object.entries(nicheMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key, val]) => {
            return { name: key, value: val, color: NICHE_COLOR_MAP[key.toLowerCase()] ?? '#94a3b8' }
          })
          setLeadsByNiche(niched)
        }
      } finally { setLoading(false) }
    }
    void load()
  }, [])

  const convProj = calcProjection(leadCounts.hot, leadCounts.warm)
  const mrrChartData = [
    ...(projection?.history    ?? []).map(h => ({ label: h.label, mrr: h.mrr,           type: 'real' })),
    ...(projection?.projection ?? []).map(p => ({ label: p.label, mrr: p.projectedMrr,  type: 'proj' })),
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" style={{ color: '#7EAFC4' }}>
        <span className="w-6 h-6 rounded-full animate-spin mr-3"
          style={{ border: '2px solid rgba(0,200,232,0.2)', borderTop: '2px solid #00C8E8' }} />
        Carregando inteligência de mercado...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#E8F4F8' }}>Inteligência de Mercado</h1>
        <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>Zona Leste de São Paulo — análise de oportunidades</p>
      </div>

      {/* TAM KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'PMEs na Zona Leste', value: '~80 mil',    sub: 'potencial total',            accent: '#00C8E8' },
          { label: 'TAM estimado',       value: 'R$ 24M/ano', sub: 'mercado endereçável',        accent: '#00E5C8' },
          { label: 'Ticket médio i9',    value: 'R$ 1.097/mês', sub: 'pacote Growth (promo)',     accent: '#00C8E8' },
          { label: 'ROI médio do cliente', value: '8–15×',   sub: 'retorno sobre investimento', accent: '#fbbf24' },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...cardStyle, padding: 16 }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: '#7EAFC4' }}>{kpi.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: kpi.accent, fontFamily: 'monospace' }}>{kpi.value}</p>
            <p className="text-xs mt-0.5" style={{ color: '#5A9AB5' }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* CRM KPIs */}
      {overview && (
        <div style={{ ...cardStyle, padding: 20 }}>
          <h2 className="font-semibold mb-4" style={{ color: '#E8F4F8' }}>Clientes ativos no CRM</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { label: 'Clientes ativos', value: String(overview.totalActive),  accent: '#E8F4F8' },
              { label: 'MRR atual',       value: overview.totalMRR.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }), accent: '#00E5C8' },
              { label: 'Novos este mês',  value: String(overview.newThisMonth), accent: '#00C8E8' },
              { label: 'Churn este mês',  value: String(overview.churnThisMonth), accent: overview.churnThisMonth > 0 ? '#f87171' : '#E8F4F8' },
            ].map(k => (
              <div key={k.label}>
                <p className="text-xs uppercase tracking-wide" style={{ color: '#7EAFC4' }}>{k.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: k.accent, fontFamily: 'monospace' }}>{k.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads por nicho */}
        <div style={{ ...cardStyle, padding: 20 }}>
          <h2 className="font-semibold mb-4" style={{ color: '#E8F4F8' }}>Leads por nicho</h2>
          {leadsByNiche.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={leadsByNiche} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                    {leadsByNiche.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} formatter={(val: number) => [`${val} leads`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {leadsByNiche.map(entry => (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                      <span style={{ color: '#A8CCE0' }}>{entry.name}</span>
                    </div>
                    <span className="font-medium" style={{ color: '#E8F4F8', fontFamily: 'monospace' }}>{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-center py-8" style={{ color: '#7EAFC4' }}>Nenhum lead cadastrado</p>
          )}
        </div>

        {/* Potencial por segmento */}
        <div style={{ ...cardStyle, padding: 20 }}>
          <h2 className="font-semibold mb-4" style={{ color: '#E8F4F8' }}>Potencial de conversão por nicho</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={SEGMENTOS} layout="vertical" margin={{ left: 0, right: 16 }}>
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#7EAFC4' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11, fill: '#7EAFC4' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} formatter={(val: number) => [`${val}%`, 'Conversão']} />
              <Bar dataKey="potencial" radius={4}>
                {SEGMENTOS.map(s => <Cell key={s.key} fill={s.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Projeção MRR */}
      {projection && (
        <div style={{ ...cardStyle, padding: 20 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>Projeção de MRR — 6 meses</h2>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(0,200,232,0.1)', color: '#7EAFC4' }}>
              crescimento médio: {projection.avgGrowthRate}%/mês
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={mrrChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,200,232,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7EAFC4' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `R$${((v as number) / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#7EAFC4' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} formatter={(v: number) => [v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }), 'MRR']} />
              <Legend formatter={(v) => <span style={{ color: '#A8CCE0', fontSize: 12 }}>{v}</span>} />
              <Line dataKey="mrr" stroke="#00C8E8" strokeWidth={2.5} name="MRR"
                dot={(props: { cx: number; cy: number; payload: { type: string } }) => (
                  <circle cx={props.cx} cy={props.cy} r={4}
                    fill={props.payload.type === 'proj' ? '#061422' : '#00C8E8'}
                    stroke="#00C8E8" strokeWidth={2}
                  />
                )}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Janela de oportunidade */}
      <div className="rounded-xl p-6" style={{ background: 'linear-gradient(135deg, rgba(0,200,232,0.15), rgba(0,229,200,0.1))', border: '1px solid rgba(0,200,232,0.3)' }}>
        <h2 className="font-bold text-lg mb-1" style={{ color: '#E8F4F8' }}>Janela de oportunidade atual</h2>
        <p className="text-sm mb-4" style={{ color: '#7EAFC4' }}>
          Com {leadCounts.hot} leads HOT e {leadCounts.warm} WARM no pipeline
        </p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Conversão realista (HOT 30%)', value: `${convProj.total} clientes` },
            { label: 'MRR potencial', value: convProj.mrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) },
            { label: 'ARR potencial', value: (convProj.mrr * 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) },
          ].map(k => (
            <div key={k.label} className="rounded-lg p-4" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#7EAFC4' }}>{k.label}</p>
              <p className="text-2xl font-bold" style={{ color: '#00E5C8', fontFamily: 'monospace' }}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Segmentos tabela */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(0,200,232,0.1)' }}>
          <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>Segmentos por prioridade — Zona Leste</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#0A1E30', borderBottom: '1px solid rgba(0,200,232,0.1)' }}>
                {['Segmento', 'Prioridade', 'Potencial conv.', 'Ticket médio', 'Dor principal'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: '#7EAFC4' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SEGMENTOS.map(seg => {
                const pri = PRIORIDADE_STYLE[seg.prioridade]
                return (
                  <tr key={seg.key} style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: seg.color }} />
                        <span className="font-medium" style={{ color: '#E8F4F8' }}>{seg.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: pri.bg, color: pri.color }}>
                        {pri.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full w-24" style={{ background: 'rgba(0,200,232,0.1)' }}>
                          <div className="h-full rounded-full" style={{ width: `${seg.potencial}%`, background: seg.color }} />
                        </div>
                        <span className="font-medium" style={{ color: '#E8F4F8', fontFamily: 'monospace' }}>{seg.potencial}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#00C8E8', fontFamily: 'monospace' }}>R$ {seg.ticket}/mês</td>
                    <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: '#7EAFC4' }}>
                      {{ salao_beleza: 'No-show de 20-30%, confirmações manuais', restaurante: 'Pedidos caóticos pelo WhatsApp', clinica: 'Recepcionista sobrecarregada', oficina: 'Para trabalho para responder', academia: 'Matrículas por mensagem', petshop: 'Agendamento manual, sem lembretes' }[seg.key]}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empresas de referência */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div
          className="px-5 py-4 flex items-center justify-between cursor-pointer transition-colors"
          style={{ borderBottom: showEmpresas ? '1px solid rgba(0,200,232,0.1)' : 'none' }}
          onClick={() => setShowEmpresas(v => !v)}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.03)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>10 empresas referência da Zona Leste</h2>
          <span style={{ color: '#7EAFC4' }}>{showEmpresas ? '▲' : '▼'}</span>
        </div>
        {showEmpresas && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#0A1E30', borderBottom: '1px solid rgba(0,200,232,0.1)' }}>
                  {['Nome', 'Bairro', 'Nicho', 'Potencial'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: '#7EAFC4' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EMPRESAS_REFERENCIA.map(emp => (
                  <tr key={emp.nome} style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-4 py-3 font-medium" style={{ color: '#E8F4F8' }}>{emp.nome}</td>
                    <td className="px-4 py-3" style={{ color: '#A8CCE0' }}>{emp.bairro}</td>
                    <td className="px-4 py-3" style={{ color: '#7EAFC4' }}>{emp.nicho}</td>
                    <td className="px-4 py-3">{emp.potencial}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
