import { useEffect, useState } from 'react'
import { metaAdsApi, type MetaAdsMetricsData } from '../services/api'

const inputStyle: React.CSSProperties = {
  background: '#0F2840',
  border: '1px solid rgba(0,200,232,0.18)',
  color: '#E8F4F8',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
}

const DATE_PRESETS = [
  { value: 'last_7d',  label: 'Últimos 7 dias' },
  { value: 'last_30d', label: 'Últimos 30 dias' },
  { value: 'last_90d', label: 'Últimos 90 dias' },
]

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v)
const fmtPct = (v: number) => `${Number(v).toFixed(2)}%`

export default function MetaAdsMetrics() {
  const [data, setData]           = useState<MetaAdsMetricsData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [datePreset, setDatePreset] = useState('last_30d')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await metaAdsApi.metrics(datePreset)
        if (!cancelled) setData(res.data)
      } catch (e: any) {
        if (!cancelled)
          setError(e?.response?.data?.error || 'Erro ao carregar métricas do Meta Ads')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [datePreset])

  return (
    <div
      className="rounded-xl overflow-hidden mb-6"
      style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)' }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(0,200,232,0.10)' }}
      >
        <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>
          📣 Meta Ads — Métricas de Campanhas
        </h2>
        <select
          value={datePreset}
          onChange={e => setDatePreset(e.target.value)}
          style={inputStyle}
        >
          {DATE_PRESETS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="animate-pulse p-5 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl" style={{ background: '#0F2840' }} />
            ))}
          </div>
          <div className="h-40 rounded-xl" style={{ background: '#0F2840' }} />
          <p className="text-center text-xs" style={{ color: '#7EAFC4' }}>Carregando métricas...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="py-10 text-center px-5">
          <p className="text-lg mb-2">⚠️</p>
          <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
          <p className="text-xs mt-1" style={{ color: '#7EAFC4' }}>
            Verifique se META_PAGE_ACCESS_TOKEN e AD_ACCOUNT_ID estão configurados
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data?.campaigns.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-2xl mb-2">📭</p>
          <p className="text-sm" style={{ color: '#7EAFC4' }}>
            Nenhuma campanha encontrada para o período selecionado
          </p>
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && data.campaigns.length > 0 && (
        <>
          {/* KPI totals */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-5 pb-4">
            {[
              { label: 'Investido',  value: fmtBRL(data.totals.spend),                                            icon: '💸', color: '#f97316' },
              { label: 'Impressões', value: fmtNum(data.totals.impressions),                                       icon: '👁',  color: '#00C8E8' },
              { label: 'Cliques',    value: fmtNum(data.totals.clicks),                                            icon: '🖱️', color: '#60a5fa' },
              { label: 'Leads',      value: fmtNum(data.totals.leads),                                             icon: '🎯', color: '#10b981' },
              { label: 'CPL',        value: data.totals.costPerLead > 0 ? fmtBRL(data.totals.costPerLead) : '—',  icon: '💰', color: '#a78bfa' },
            ].map((card, i) => (
              <div
                key={i}
                className="rounded-xl p-4 transition-all"
                style={{ background: '#061422', border: '1px solid rgba(0,200,232,0.10)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(0,200,232,0.30)'
                  ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(0,200,232,0.10)'
                  ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                }}
              >
                <span className="text-lg">{card.icon}</span>
                <p
                  className="text-xl font-bold mt-2"
                  style={{ color: card.color, fontFamily: 'monospace' }}
                >
                  {card.value}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#7EAFC4' }}>{card.label}</p>
              </div>
            ))}
          </div>

          {/* Campaigns table */}
          <div className="px-5 pb-5">
            <div
              className="overflow-x-auto rounded-xl"
              style={{ border: '1px solid rgba(0,200,232,0.10)' }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#061422', borderBottom: '1px solid rgba(0,200,232,0.10)' }}>
                    {['Campanha', 'Investido', 'Impressões', 'Cliques', 'CTR', 'CPC', 'CPM', 'Leads', 'CPL'].map(col => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: '#7EAFC4', whiteSpace: 'nowrap' }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((c, i) => (
                    <tr
                      key={c.campaignId}
                      style={{
                        borderBottom: i < data.campaigns.length - 1
                          ? '1px solid rgba(0,200,232,0.06)'
                          : 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td
                        className="px-4 py-3 font-medium max-w-xs truncate"
                        style={{ color: '#E8F4F8', maxWidth: 220 }}
                        title={c.campaignName}
                      >
                        {c.campaignName}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#f97316' }}>
                        {fmtBRL(c.spend)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#A8CCE0' }}>
                        {fmtNum(c.impressions)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#A8CCE0' }}>
                        {fmtNum(c.clicks)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#60a5fa' }}>
                        {fmtPct(c.ctr)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#A8CCE0' }}>
                        {c.cpc > 0 ? fmtBRL(c.cpc) : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: '#A8CCE0' }}>
                        {c.cpm > 0 ? fmtBRL(c.cpm) : '—'}
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap"
                        style={{ color: c.leads > 0 ? '#10b981' : '#5A9AB5' }}
                      >
                        {c.leads > 0 ? fmtNum(c.leads) : '—'}
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs whitespace-nowrap"
                        style={{ color: c.costPerLead > 0 ? '#a78bfa' : '#5A9AB5' }}
                      >
                        {c.costPerLead > 0 ? fmtBRL(c.costPerLead) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
