import { useState, useEffect } from 'react'
import { duplicatesApi, type DuplicateGroup } from '../../services/api'

const CONF_LABEL: Record<string, string> = { certain: 'Certa', possible: 'Possível' }
const CONF_COLOR: Record<string, string> = {
  certain:  'bg-red-100 text-red-700',
  possible: 'bg-yellow-100 text-yellow-700',
}
const CLASS_COLOR: Record<string, string> = {
  HOT:  'bg-red-100 text-red-700',
  WARM: 'bg-orange-100 text-orange-700',
  COLD: 'bg-blue-100 text-blue-700',
}

export default function Duplicates() {
  const [groups, setGroups]     = useState<DuplicateGroup[]>([])
  const [loading, setLoading]   = useState(true)
  const [merging, setMerging]   = useState<string | null>(null) // groupIdx
  const [keepMap, setKeepMap]   = useState<Record<string, string>>({}) // groupIdx → leadId

  useEffect(() => {
    duplicatesApi.list()
      .then(({ data }) => setGroups(data.groups))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  function setKeep(groupIdx: number, leadId: string) {
    setKeepMap((prev) => ({ ...prev, [groupIdx]: leadId }))
  }

  async function handleMerge(groupIdx: number) {
    const group   = groups[groupIdx]!
    const keepId  = keepMap[groupIdx] ?? group.leads[0]!.id
    const mergeIds = group.leads.map((l) => l.id).filter((id) => id !== keepId)

    if (!confirm(`Mesclar ${mergeIds.length} lead(s) em "${group.leads.find((l) => l.id === keepId)?.businessName}"? Esta ação não pode ser desfeita.`)) return

    setMerging(String(groupIdx))
    try {
      await duplicatesApi.merge(keepId, mergeIds)
      setGroups((prev) => prev.filter((_, i) => i !== groupIdx))
    } catch {
      alert('Erro ao realizar merge. Tente novamente.')
    } finally {
      setMerging(null)
    }
  }

  const certainCount  = groups.filter((g) => g.confidence === 'certain').length
  const possibleCount = groups.filter((g) => g.confidence === 'possible').length

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Duplicatas de Leads</h1>
        <p className="text-gray-500 text-sm mt-0.5">Detecte e una leads duplicados para manter sua base limpa</p>
      </div>

      {/* Resumo */}
      {!loading && (
        <div className="flex gap-3 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
            <span className="font-semibold text-red-700">{certainCount}</span>
            <span className="text-red-600 ml-1">duplicatas certas</span>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm">
            <span className="font-semibold text-yellow-700">{possibleCount}</span>
            <span className="text-yellow-600 ml-1">possíveis duplicatas</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-400">Analisando base de leads...</div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-gray-900">Nenhuma duplicata encontrada</p>
          <p className="text-sm text-gray-500 mt-1">Sua base de leads está limpa</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, idx) => {
            const keepId = keepMap[idx] ?? group.leads[0]!.id
            return (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 bg-gray-50">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CONF_COLOR[group.confidence]}`}>
                    {CONF_LABEL[group.confidence]}
                  </span>
                  <span className="text-sm text-gray-600">{group.reason}</span>
                  <div className="ml-auto">
                    <button
                      onClick={() => handleMerge(idx)}
                      disabled={merging === String(idx)}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {merging === String(idx) ? 'Mesclando...' : 'Mesclar selecionados'}
                    </button>
                  </div>
                </div>

                {/* Leads */}
                <div className="divide-y divide-gray-50">
                  {group.leads.map((lead) => {
                    const isKeep = lead.id === keepId
                    return (
                      <div
                        key={lead.id}
                        className={`px-5 py-4 flex items-start gap-4 transition-colors ${isKeep ? 'bg-green-50' : ''}`}
                      >
                        {/* Radio keep */}
                        <div className="pt-0.5">
                          <input
                            type="radio"
                            name={`keep-${idx}`}
                            checked={isKeep}
                            onChange={() => setKeep(idx, lead.id)}
                            className="accent-green-600"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900 text-sm">{lead.businessName}</p>
                            {isKeep && (
                              <span className="text-xs bg-green-100 text-green-700 font-medium px-1.5 py-0.5 rounded">Manter este</span>
                            )}
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${CLASS_COLOR[lead.classification]}`}>
                              {lead.classification}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{lead.name}</p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                            {lead.phone     && <span>📞 {lead.phone}</span>}
                            {lead.whatsapp  && lead.whatsapp !== lead.phone && <span>💬 {lead.whatsapp}</span>}
                            {lead.email     && <span>✉️ {lead.email}</span>}
                            {lead.neighborhood && <span>📍 {lead.neighborhood}</span>}
                            {lead.niche     && <span>🏷️ {lead.niche}</span>}
                            <span>🎯 Score {lead.score}</span>
                            <span className="text-gray-300">Importado {new Date(lead.importedAt).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
