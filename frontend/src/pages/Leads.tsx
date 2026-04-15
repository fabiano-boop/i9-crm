import { useEffect, useState, useCallback } from 'react'
import { leadsApi, type Lead, type LeadsParams } from '../services/api'
import ScoreBadge from '../components/shared/ScoreBadge'

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Novo', CONTACTED: 'Contatado', REPLIED: 'Respondeu',
  PROPOSAL: 'Proposta', NEGOTIATION: 'Negociação', CLOSED: 'Fechado', LOST: 'Perdido',
}

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-600',
  CONTACTED: 'bg-blue-100 text-blue-700',
  REPLIED: 'bg-green-100 text-green-700',
  PROPOSAL: 'bg-purple-100 text-purple-700',
  NEGOTIATION: 'bg-orange-100 text-orange-700',
  CLOSED: 'bg-emerald-100 text-emerald-700',
  LOST: 'bg-red-100 text-red-600',
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [classification, setClassification] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  const limit = 20

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params: LeadsParams = { page, limit }
      if (search) params.search = search
      if (classification) params.classification = classification
      if (status) params.status = status
      const { data } = await leadsApi.list(params)
      setLeads(data.data)
      setTotal(data.meta.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, classification, status])

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => { setPage(1) }, [search, classification, status])

  function copyAngle(lead: Lead) {
    if (!lead.whatsappAngle) return
    navigator.clipboard.writeText(lead.whatsappAngle)
    setCopied(lead.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} leads cadastrados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por nome, negócio, bairro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={classification}
          onChange={(e) => setClassification(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas as classificações</option>
          <option value="HOT">🔥 HOT</option>
          <option value="WARM">🌤 WARM</option>
          <option value="COLD">❄️ COLD</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">Carregando leads...</div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <span className="text-4xl mb-3">🔍</span>
            <p>Nenhum lead encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Negócio / Nicho</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Bairro</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ângulo WhatsApp</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Contato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{lead.businessName}</p>
                      <p className="text-gray-400 text-xs">{lead.name} · {lead.niche}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{lead.neighborhood}</td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={lead.score} classification={lead.classification} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[lead.status]}`}>
                        {STATUS_LABELS[lead.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {lead.whatsappAngle ? (
                        <div className="flex items-start gap-2">
                          <p className="text-gray-600 text-xs line-clamp-2 flex-1">{lead.whatsappAngle}</p>
                          <button
                            onClick={() => copyAngle(lead)}
                            title="Copiar ângulo"
                            className="text-gray-400 hover:text-blue-600 transition-colors shrink-0"
                          >
                            {copied === lead.id ? '✅' : '📋'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {lead.whatsapp && (
                          <a
                            href={`https://wa.me/55${lead.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-green-600 hover:underline"
                          >
                            WhatsApp
                          </a>
                        )}
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} className="text-xs text-blue-600 hover:underline truncate max-w-32 block">
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">Página {page} de {totalPages} ({total} leads)</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100"
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
