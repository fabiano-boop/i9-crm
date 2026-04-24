import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { servicesApi, type Service, type ServiceSalesHistory } from '../../services/api'

const CATEGORY_LABEL: Record<string, string> = {
  site: 'Site', landing_page: 'Landing Page', trafego: 'Tráfego Pago',
  social_media: 'Social Media', criativo: 'Criativo', app: 'Aplicativo', consultoria: 'Consultoria',
}
const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE:  { bg: 'rgba(16,185,129,0.15)',  color: '#34d399',  label: 'Ativo' },
  PAUSED:  { bg: 'rgba(249,115,22,0.15)',  color: '#fb923c',  label: 'Pausado' },
  CHURNED: { bg: 'rgba(239,68,68,0.15)',   color: '#f87171',  label: 'Cancelado' },
}

const cardStyle: React.CSSProperties = {
  background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)', borderRadius: 12,
}
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

type Tab = 'detalhes' | 'historico'

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [service, setService]   = useState<Service | null>(null)
  const [history, setHistory]   = useState<ServiceSalesHistory | null>(null)
  const [tab, setTab]           = useState<Tab>('historico')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      servicesApi.get(id),
      servicesApi.salesHistory(id),
    ])
      .then(([svcRes, histRes]) => {
        setService(svcRes.data)
        setHistory(histRes.data)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="p-6 text-center py-16 text-sm" style={{ background: '#061422', minHeight: '100%', color: '#7EAFC4' }}>
        Carregando...
      </div>
    )
  }
  if (!service) {
    return (
      <div className="p-6 text-center py-16 text-sm" style={{ background: '#061422', minHeight: '100%', color: '#f87171' }}>
        Serviço não encontrado.
      </div>
    )
  }

  return (
    <div className="p-6" style={{ background: '#061422', minHeight: '100%' }}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/services')}
          className="text-sm"
          style={{ color: '#7EAFC4' }}
        >
          ← Serviços
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: '#E8F4F8' }}>{service.name}</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>
            {CATEGORY_LABEL[service.category] ?? service.category}
            {' · '}
            {service.billingType === 'RECURRING' ? '🔁 Recorrente' : '⚡ Avulso'}
          </p>
        </div>
        <span
          className="text-xs font-medium px-3 py-1 rounded-full"
          style={service.isActive
            ? { background: 'rgba(16,185,129,0.15)', color: '#34d399' }
            : { background: 'rgba(100,116,139,0.2)', color: '#94a3b8' }}
        >
          {service.isActive ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid rgba(0,200,232,0.1)' }}>
        {(['detalhes', 'historico'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium transition-all"
            style={{
              color: tab === t ? '#00C8E8' : '#7EAFC4',
              borderBottom: tab === t ? '2px solid #00C8E8' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t === 'detalhes' ? 'Detalhes' : 'Histórico de Vendas'}
          </button>
        ))}
      </div>

      {/* Tab: Detalhes */}
      {tab === 'detalhes' && (
        <div className="space-y-4 max-w-xl">
          <div style={cardStyle} className="p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: '#E8F4F8' }}>Informações</h2>
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              {[
                ['Categoria',    CATEGORY_LABEL[service.category] ?? service.category],
                ['Preço Promo',  fmt(service.promoPrice)],
                ['Preço Normal', fmt(service.normalPrice)],
                ['Cobrança',     service.billingType === 'RECURRING' ? 'Recorrente' : 'Avulso'],
              ].map(([k, v]) => (
                <>
                  <span key={k} style={{ color: '#7EAFC4' }}>{k}</span>
                  <span key={v} className="font-medium" style={{ color: '#E8F4F8' }}>{v}</span>
                </>
              ))}
            </div>
            {service.description && (
              <p className="mt-4 text-sm" style={{ color: '#A8CCE0' }}>{service.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Histórico */}
      {tab === 'historico' && history && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Faturado',    value: fmt(history.totalRevenue),          color: '#10b981' },
              { label: 'Contratos Ativos',  value: String(history.activeContracts),    color: '#00C8E8' },
              { label: 'Total Contratos',   value: String(history.totalContracts),     color: '#A8CCE0' },
              { label: 'Ticket Médio',      value: fmt(history.avgTicket),             color: '#8b5cf6' },
            ].map(item => (
              <div key={item.label} style={cardStyle} className="p-4 flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#7EAFC4' }}>
                  {item.label}
                </span>
                <span className="text-2xl font-bold" style={{ color: item.color, fontFamily: 'monospace' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* Gráfico de barras — receita por mês */}
          <div style={cardStyle} className="p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: '#E8F4F8' }}>
              Receita por Mês (últimos 12 meses)
            </h2>
            {history.monthlyRevenue.every(m => m.revenue === 0) ? (
              <div className="text-center py-10 text-sm" style={{ color: '#7EAFC4' }}>
                Nenhuma fatura paga registrada neste período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={history.monthlyRevenue} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,200,232,0.08)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#7EAFC4' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#7EAFC4' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                    width={50}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: '#0F2840', border: '1px solid rgba(0,200,232,0.2)' }}>
                          <p style={{ color: '#E8F4F8' }}>{label}</p>
                          <p style={{ color: '#10b981' }}>{fmt(payload[0]?.value as number ?? 0)}</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="revenue" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tabela de contratos */}
          <div style={cardStyle} className="overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(0,200,232,0.1)' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#E8F4F8' }}>Contratos</h2>
            </div>
            {history.contracts.length === 0 ? (
              <div className="text-center py-10 text-sm" style={{ color: '#7EAFC4' }}>
                Nenhum cliente vinculado a este serviço ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,200,232,0.08)' }}>
                      {['Cliente', 'Data início', 'Valor/mês', 'Status'].map((h, i) => (
                        <th
                          key={h}
                          className={`px-5 py-3 text-xs font-medium uppercase tracking-wide ${i >= 2 ? 'text-right' : 'text-left'}`}
                          style={{ color: '#7EAFC4' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.contracts.map((c, i) => {
                      const st = STATUS_STYLE[c.status] ?? STATUS_STYLE['CHURNED']
                      return (
                        <tr
                          key={i}
                          style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.04)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td className="px-5 py-3 font-medium" style={{ color: '#E8F4F8' }}>
                            <a href={`/clients/${c.clientId}`} style={{ color: '#00C8E8' }}
                               onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                               onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                              {c.clientName}
                            </a>
                          </td>
                          <td className="px-5 py-3" style={{ color: '#A8CCE0' }}>
                            {new Date(c.startDate).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold" style={{ color: '#10b981', fontFamily: 'monospace' }}>
                            {fmt(c.monthlyValue)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                              {st.label}
                            </span>
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
      )}
    </div>
  )
}
