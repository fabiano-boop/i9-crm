import { useEffect, useState } from 'react'
import { integrationsApi, type AgencyGa4Metrics } from '../services/api'

// ── Ícones por canal de aquisição ─────────────────────────────────────────────
const CHANNEL_ICON: Record<string, string> = {
  'Organic Search':  '🔍',
  'Direct':          '🔗',
  'Organic Social':  '📱',
  'Paid Search':     '💰',
  'Paid Social':     '📣',
  'Referral':        '↩️',
  'Email':           '📧',
  'Unassigned':      '❓',
}

const CHANNEL_COLOR: Record<string, string> = {
  'Organic Search': '#10b981',
  'Direct':         '#00C8E8',
  'Organic Social': '#a78bfa',
  'Paid Search':    '#f97316',
  'Paid Social':    '#f59e0b',
  'Referral':       '#60a5fa',
  'Email':          '#34d399',
}

const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v)
const fmtPct = (v: number) => `${v.toFixed(1)}%`

export default function GA4AgencyMetrics() {
  const [data, setData]       = useState<AgencyGa4Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await integrationsApi.ga4AgencyMetrics()
        if (!cancelled) setData(res.data)
      } catch (e: any) {
        if (!cancelled)
          setError(e?.response?.data?.message || e?.response?.data?.error || 'Erro ao carregar métricas do GA4')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function handleConnect() {
    try {
      const res = await integrationsApi.ga4AgencyAuthUrl()
      window.location.href = res.data.authUrl
    } catch {
      alert('Erro ao gerar URL de autorização GA4')
    }
  }

  const isNotConnected = error?.includes('não conectado')

  return (
    <div
      className="rounded-xl overflow-hidden mb-6"
      style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)' }}
    >
      {/* ── Header ── */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(0,200,232,0.10)' }}
      >
        <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>
          📊 GA4 — Site i9
        </h2>
        {!loading && data && (
          <span className="text-xs" style={{ color: '#7EAFC4' }}>
            Últimos 30 dias · {new Date(data.period.startDate).toLocaleDateString('pt-BR')} –{' '}
            {new Date(data.period.endDate).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="animate-pulse p-5 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl" style={{ background: '#0F2840' }} />
            ))}
          </div>
          <div className="h-40 rounded-xl" style={{ background: '#0F2840' }} />
          <p className="text-center text-xs" style={{ color: '#7EAFC4' }}>Carregando métricas do GA4...</p>
        </div>
      )}

      {/* ── Não conectado ── */}
      {!loading && isNotConnected && (
        <div className="py-10 text-center px-5">
          <p className="text-3xl mb-3">🔌</p>
          <p className="text-sm font-medium mb-1" style={{ color: '#E8F4F8' }}>GA4 da agência não conectado</p>
          <p className="text-xs mb-4" style={{ color: '#7EAFC4' }}>
            Conecte sua conta Google para ver as métricas do site i9
          </p>
          <button
            onClick={handleConnect}
            className="text-sm font-semibold px-5 py-2 rounded-lg transition-colors cursor-pointer"
            style={{ background: 'rgba(0,200,232,0.15)', color: '#00C8E8', border: '1px solid rgba(0,200,232,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.15)')}
          >
            Conectar Google Analytics →
          </button>
        </div>
      )}

      {/* ── Erro genérico ── */}
      {!loading && error && !isNotConnected && (
        <div className="py-8 text-center px-5">
          <p className="text-lg mb-2">⚠️</p>
          <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
          <p className="text-xs mt-1" style={{ color: '#7EAFC4' }}>
            Verifique GA4_AGENCY_PROPERTY_ID e as credenciais OAuth no .env
          </p>
        </div>
      )}

      {/* ── Conteúdo principal ── */}
      {!loading && !error && data && (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-5 pb-4">
            {[
              { label: 'Sessões',         value: fmtNum(data.sessions),       icon: '📈', color: '#00C8E8' },
              { label: 'Usuários',        value: fmtNum(data.users),          icon: '👤', color: '#60a5fa' },
              { label: 'Novos Usuários',  value: fmtNum(data.newUsers),       icon: '✨', color: '#10b981' },
              { label: 'Taxa de Rejeição',value: fmtPct(data.bounceRate),     icon: '↩️', color: data.bounceRate > 60 ? '#ef4444' : data.bounceRate > 40 ? '#f59e0b' : '#10b981' },
              { label: 'Engajamento',     value: fmtPct(data.engagementRate), icon: '⚡', color: data.engagementRate > 60 ? '#10b981' : data.engagementRate > 40 ? '#f59e0b' : '#ef4444' },
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
                <p className="text-xl font-bold mt-2" style={{ color: card.color, fontFamily: 'monospace' }}>
                  {card.value}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#7EAFC4' }}>{card.label}</p>
              </div>
            ))}
          </div>

          {/* Aquisição por canal */}
          {data.channels.length > 0 && (
            <div className="px-5 pb-5">
              <p
                className="text-xs uppercase tracking-widest mb-3"
                style={{ color: '#5A9AB5' }}
              >
                Aquisição por canal
              </p>
              <div className="space-y-2.5">
                {data.channels.map((ch, i) => {
                  const color = CHANNEL_COLOR[ch.channel] ?? '#7EAFC4'
                  const icon  = CHANNEL_ICON[ch.channel]  ?? '🌐'
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm w-5 shrink-0">{icon}</span>
                      <span className="text-xs w-32 shrink-0 truncate" style={{ color: '#A8CCE0' }}>
                        {ch.channel}
                      </span>
                      <div
                        className="flex-1 h-4 rounded-full overflow-hidden"
                        style={{ background: 'rgba(0,200,232,0.08)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(ch.percent, ch.sessions > 0 ? 2 : 0)}%`,
                            background: color,
                            boxShadow: ch.sessions > 0 ? `0 0 6px ${color}55` : 'none',
                          }}
                        />
                      </div>
                      <span
                        className="text-xs font-semibold w-10 text-right shrink-0 font-mono"
                        style={{ color }}
                      >
                        {ch.percent}%
                      </span>
                      <span
                        className="text-xs w-16 text-right shrink-0 font-mono"
                        style={{ color: '#7EAFC4' }}
                      >
                        {fmtNum(ch.sessions)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
