import { useState, useEffect } from 'react'
import { duplicatesApi, type DuplicateGroup } from '../../services/api'

const CONF_LABEL: Record<string, string> = { certain: 'Certa', possible: 'Possível' }
const CONF_STYLE: Record<string, { bg: string; color: string }> = {
  certain:  { bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
  possible: { bg: 'rgba(234,179,8,0.15)',  color: '#fbbf24' },
}
const CLASS_STYLE: Record<string, { bg: string; color: string }> = {
  HOT:  { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  WARM: { bg: 'rgba(249,115,22,0.15)',  color: '#fb923c' },
  COLD: { bg: 'rgba(26,110,255,0.15)',  color: '#60a5fa' },
}

export default function Duplicates() {
  const [groups, setGroups]   = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [merging, setMerging] = useState<string | null>(null)
  const [keepMap, setKeepMap] = useState<Record<string, string>>({})

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
    const group    = groups[groupIdx]!
    const keepId   = keepMap[groupIdx] ?? group.leads[0]!.id
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
        <h1 className="text-2xl font-bold" style={{ color: '#E8F4F8' }}>Duplicatas de Leads</h1>
        <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>Detecte e una leads duplicados para manter sua base limpa</p>
      </div>

      {/* Resumo */}
      {!loading && (
        <div className="flex gap-3 mb-6">
          <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <span className="font-semibold" style={{ color: '#f87171' }}>{certainCount}</span>
            <span className="ml-1" style={{ color: '#fca5a5' }}>duplicatas certas</span>
          </div>
          <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)' }}>
            <span className="font-semibold" style={{ color: '#fbbf24' }}>{possibleCount}</span>
            <span className="ml-1" style={{ color: '#fde68a' }}>possíveis duplicatas</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: '#7EAFC4' }}>Analisando base de leads...</div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)' }}>
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold" style={{ color: '#E8F4F8' }}>Nenhuma duplicata encontrada</p>
          <p className="text-sm mt-1" style={{ color: '#7EAFC4' }}>Sua base de leads está limpa</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, idx) => {
            const keepId   = keepMap[idx] ?? group.leads[0]!.id
            const confStyle = CONF_STYLE[group.confidence] ?? CONF_STYLE.possible
            return (
              <div
                key={idx}
                className="rounded-xl overflow-hidden"
                style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)' }}
              >
                {/* Header */}
                <div
                  className="px-5 py-3 flex items-center gap-3"
                  style={{ background: '#0A1E30', borderBottom: '1px solid rgba(0,200,232,0.1)' }}
                >
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: confStyle.bg, color: confStyle.color }}
                  >
                    {CONF_LABEL[group.confidence]}
                  </span>
                  <span className="text-sm" style={{ color: '#A8CCE0' }}>{group.reason}</span>
                  <div className="ml-auto">
                    <button
                      onClick={() => handleMerge(idx)}
                      disabled={merging === String(idx)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422' }}
                    >
                      {merging === String(idx) ? 'Mesclando...' : 'Mesclar selecionados'}
                    </button>
                  </div>
                </div>

                {/* Leads */}
                <div>
                  {group.leads.map((lead) => {
                    const isKeep    = lead.id === keepId
                    const clsStyle  = CLASS_STYLE[lead.classification] ?? { bg: 'rgba(100,116,139,0.2)', color: '#94a3b8' }
                    return (
                      <div
                        key={lead.id}
                        className="px-5 py-4 flex items-start gap-4 transition-colors"
                        style={{
                          borderBottom: '1px solid rgba(0,200,232,0.06)',
                          background: isKeep ? 'rgba(0,229,200,0.05)' : 'transparent',
                        }}
                        onMouseEnter={e => { if (!isKeep) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,200,232,0.03)' }}
                        onMouseLeave={e => { if (!isKeep) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        {/* Radio */}
                        <div className="pt-0.5">
                          <input
                            type="radio"
                            name={`keep-${idx}`}
                            checked={isKeep}
                            onChange={() => setKeep(idx, lead.id)}
                            style={{ accentColor: '#00E5C8' }}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-semibold text-sm" style={{ color: '#E8F4F8' }}>{lead.businessName}</p>
                            {isKeep && (
                              <span
                                className="text-xs font-medium px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(0,229,200,0.15)', color: '#00E5C8' }}
                              >
                                Manter este
                              </span>
                            )}
                            <span
                              className="text-xs font-medium px-1.5 py-0.5 rounded"
                              style={{ background: clsStyle.bg, color: clsStyle.color }}
                            >
                              {lead.classification}
                            </span>
                          </div>

                          <p className="text-xs" style={{ color: '#7EAFC4' }}>{lead.name}</p>

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: '#5A9AB5' }}>
                            {lead.phone     && <span>📞 {lead.phone}</span>}
                            {lead.whatsapp  && lead.whatsapp !== lead.phone && <span>💬 {lead.whatsapp}</span>}
                            {lead.email     && <span>✉️ {lead.email}</span>}
                            {lead.neighborhood && <span>📍 {lead.neighborhood}</span>}
                            {lead.niche     && <span>🏷️ {lead.niche}</span>}
                            <span>🎯 Score {lead.score}</span>
                            <span style={{ color: '#3E6A80' }}>
                              Importado {new Date(lead.importedAt).toLocaleDateString('pt-BR')}
                            </span>
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
