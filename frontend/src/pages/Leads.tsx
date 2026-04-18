import { useEffect, useState, useCallback } from 'react'
import { leadsApi, type Lead, type LeadsParams } from '../services/api'
import ScoreBadge from '../components/shared/ScoreBadge'

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Novo', CONTACTED: 'Contatado', REPLIED: 'Respondeu',
  PROPOSAL: 'Proposta', NEGOTIATION: 'Negociação', CLOSED: 'Fechado', LOST: 'Perdido',
}

const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  NEW:         { background: 'rgba(100,116,139,0.2)', color: '#94a3b8' },
  CONTACTED:   { background: 'rgba(26,110,255,0.15)', color: '#60a5fa' },
  REPLIED:     { background: 'rgba(16,185,129,0.15)', color: '#34d399' },
  PROPOSAL:    { background: 'rgba(168,85,247,0.15)', color: '#c084fc' },
  NEGOTIATION: { background: 'rgba(249,115,22,0.15)', color: '#fb923c' },
  CLOSED:      { background: 'rgba(16,185,129,0.20)', color: '#10b981' },
  LOST:        { background: 'rgba(239,68,68,0.15)',  color: '#f87171' },
}

const inputStyle: React.CSSProperties = {
  background:   '#0F2840',
  border:       '1px solid rgba(0,200,232,0.18)',
  color:        '#E8F4F8',
  borderRadius: 8,
  padding:      '8px 12px',
  fontSize:     14,
  outline:      'none',
}

export default function Leads() {
  const [leads, setLeads]                   = useState<Lead[]>([])
  const [total, setTotal]                   = useState(0)
  const [page, setPage]                     = useState(1)
  const [search, setSearch]                 = useState('')
  const [classification, setClassification] = useState('')
  const [status, setStatus]                 = useState('')
  const [showClosed, setShowClosed]         = useState(false)  // ← NOVO
  const [loading, setLoading]               = useState(true)
  const [copied, setCopied]                 = useState<string | null>(null)

  const limit = 20

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params: LeadsParams = { page, limit }
      if (search)         params.search         = search
      if (classification) params.classification = classification

      // Se status filtrado manualmente, usa ele; senão filtra CLOSED por padrão
      if (status) {
        params.status = status
      } else if (!showClosed) {
        // Busca todos exceto CLOSED — backend suporta status como filtro único,
        // então buscamos sem filtro de status e filtramos no cliente
        // (alternativa: passar excludeStatus se o backend suportar)
      }

      const { data } = await leadsApi.list(params)

      // Filtro client-side para excluir CLOSED quando showClosed = false
      const filtered = (!status && !showClosed)
        ? { ...data, data: data.data.filter((l: Lead) => l.status !== 'CLOSED') }
        : data

      setLeads(filtered.data)
      setTotal(filtered.meta?.total ?? filtered.data.length)
    } finally {
      setLoading(false)
    }
  }, [page, search, classification, status, showClosed])

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => { setPage(1) }, [search, classification, status, showClosed])

  function copyAngle(lead: Lead) {
    if (!lead.whatsappAngle) return
    navigator.clipboard.writeText(lead.whatsappAngle)
    setCopied(lead.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6" style={{ background: '#061422', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#E8F4F8' }}>Leads</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>{total} leads{!showClosed && ' ativos'}</p>
        </div>

        {/* Toggle mostrar convertidos */}
        <button
          onClick={() => setShowClosed(v => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
          style={{
            background: showClosed ? 'rgba(0,200,232,0.15)' : 'rgba(0,200,232,0.06)',
            border:     `1px solid ${showClosed ? 'rgba(0,200,232,0.5)' : 'rgba(0,200,232,0.18)'}`,
            color:      showClosed ? '#00C8E8' : '#7EAFC4',
          }}
        >
          {showClosed ? '👁 Mostrando todos' : '🔒 Ocultar convertidos'}
        </button>
      </div>

      {/* Filtros */}
      <div
        className="rounded-xl p-4 mb-4 flex flex-wrap gap-3"
        style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)' }}
      >
        <input
          type="text"
          placeholder="Buscar por nome, negócio, bairro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48"
          style={inputStyle}
        />
        <select
          value={classification}
          onChange={(e) => setClassification(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="">Todas as classificações</option>
          <option value="HOT">🔥 HOT</option>
          <option value="WARM">🌤 WARM</option>
          <option value="COLD">❄️ COLD</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm" style={{ color: '#7EAFC4' }}>
            Carregando leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: '#7EAFC4' }}>
            <span className="text-4xl mb-3">🔍</span>
            <p className="text-sm">Nenhum lead encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,200,232,0.12)', background: '#0A1E30' }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: '#7EAFC4' }}>Negócio / Nicho</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: '#7EAFC4' }}>Bairro</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: '#7EAFC4' }}>Score</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: '#7EAFC4' }}>Status</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: '#7EAFC4' }}>Ângulo WhatsApp</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: '#7EAFC4' }}>Contato</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="transition-colors"
                    style={{
                      borderBottom: '1px solid rgba(0,200,232,0.06)',
                      opacity: lead.status === 'CLOSED' ? 0.6 : 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: '#E8F4F8' }}>{lead.businessName}</p>
                      <p className="text-xs" style={{ color: '#7EAFC4' }}>{lead.name} · {lead.niche}</p>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#A8CCE0' }}>{lead.neighborhood}</td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={lead.score} classification={lead.classification} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-medium px-2 py-1 rounded-full"
                        style={STATUS_STYLES[lead.status] ?? { background: 'rgba(100,116,139,0.2)', color: '#94a3b8' }}
                      >
                        {STATUS_LABELS[lead.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {lead.whatsappAngle ? (
                        <div className="flex items-start gap-2">
                          <p className="text-xs line-clamp-2 flex-1" style={{ color: '#A8CCE0' }}>
                            {lead.whatsappAngle}
                          </p>
                          <button
                            onClick={() => copyAngle(lead)}
                            title="Copiar ângulo"
                            className="shrink-0 transition-colors"
                            style={{ color: copied === lead.id ? '#00E5C8' : '#3E6A80' }}
                          >
                            {copied === lead.id ? '✅' : '📋'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: '#3E6A80' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {lead.whatsapp && (
                          <a
                            href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs hover:underline"
                            style={{ color: '#34d399' }}
                          >
                            WhatsApp
                          </a>
                        )}
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            className="text-xs hover:underline truncate max-w-32 block"
                            style={{ color: '#60a5fa' }}
                          >
                            {lead.email}
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid rgba(0,200,232,0.10)', background: '#0A1E30' }}
          >
            <p className="text-sm" style={{ color: '#7EAFC4' }}>
              Página {page} de {totalPages} ({total} leads)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-40"
                style={{ background: '#0F2840', border: '1px solid rgba(0,200,232,0.18)', color: '#A8CCE0' }}
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-40"
                style={{ background: '#0F2840', border: '1px solid rgba(0,200,232,0.18)', color: '#A8CCE0' }}
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
