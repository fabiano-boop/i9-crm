import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { leadsApi, cadencesApi, type Lead, type LeadCadence, type FollowUpSequence } from '../services/api'

interface Pitch {
  whatsappMessage: string
  emailSubject: string
  emailBody: string
  callScript: string
}

const STAGES = [
  { id: 'new',         label: 'Novo',        borderColor: '#3E6A80',   accent: 'rgba(62,106,128,0.15)'   },
  { id: 'contacted',   label: 'Contatado',   borderColor: '#1A6EFF',   accent: 'rgba(26,110,255,0.12)'   },
  { id: 'replied',     label: 'Respondeu',   borderColor: '#10b981',   accent: 'rgba(16,185,129,0.12)'   },
  { id: 'proposal',    label: 'Proposta',    borderColor: '#8b5cf6',   accent: 'rgba(139,92,246,0.12)'   },
  { id: 'negotiation', label: 'Negociação',  borderColor: '#f97316',   accent: 'rgba(249,115,22,0.12)'   },
  { id: 'closed',      label: 'Fechado ✅',  borderColor: '#00E5C8',   accent: 'rgba(0,229,200,0.12)'    },
  { id: 'lost',        label: 'Perdido ❌',  borderColor: '#ef4444',   accent: 'rgba(239,68,68,0.10)'    },
]

const CLASS_STYLE: Record<string, { bg: string; color: string }> = {
  HOT:  { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  WARM: { bg: 'rgba(234,179,8,0.15)',   color: '#fbbf24' },
  COLD: { bg: 'rgba(26,110,255,0.15)',  color: '#60a5fa' },
}
const CLASS_ICON: Record<string, string> = { HOT: '🔥', WARM: '🌤', COLD: '❄️' }

type Board = Record<string, Lead[]>

export default function Pipeline() {
  const navigate = useNavigate()
  const [board, setBoard] = useState<Board>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [pitch, setPitch] = useState<Pitch | null>(null)
  const [generatingPitch, setGeneratingPitch] = useState(false)
  const [pitchTab, setPitchTab] = useState<'whatsapp' | 'email' | 'call'>('whatsapp')
  const [leadCadences, setLeadCadences] = useState<LeadCadence[]>([])
  const [sequences, setSequences] = useState<FollowUpSequence[]>([])
  const [cadenceLoading, setCadenceLoading] = useState(false)
  const [showCadenceModal, setShowCadenceModal] = useState(false)
  const [selectedSeqId, setSelectedSeqId] = useState('')
  const [activeCadenceLeadIds, setActiveCadenceLeadIds] = useState<Set<string>>(new Set())

  // ── conversão ──────────────────────────────────────────────────────────────
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)

  async function handleConvert() {
    if (!selected) return
    setConverting(true)
    setConvertError(null)
    try {
      const { data } = await leadsApi.convert(selected.id)
      // Remove lead do board
      setBoard((prev) => {
        const next = { ...prev }
        next['closed'] = (next['closed'] || []).filter((l) => l.id !== selected.id)
        return next
      })
      setSelected(null)
      navigate(`/clients/${data.client.id}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao converter lead'
      setConvertError(msg)
    } finally {
      setConverting(false)
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data } = await leadsApi.list({ limit: 9999 })
        const grouped: Board = {}
        STAGES.forEach((s) => { grouped[s.id] = [] })
        data.data.forEach((lead) => {
          const stage = lead.pipelineStage || 'new'
          if (!grouped[stage]) grouped[stage] = []
          grouped[stage].push(lead)
        })
        setBoard(grouped)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result
    if (!destination || destination.droppableId === source.droppableId) return
    const srcStage = source.droppableId
    const dstStage = destination.droppableId
    setBoard((prev) => {
      const next = { ...prev }
      const srcList = [...(next[srcStage] || [])]
      const dstList = [...(next[dstStage] || [])]
      const [moved] = srcList.splice(source.index, 1)
      dstList.splice(destination.index, 0, { ...moved, pipelineStage: dstStage })
      next[srcStage] = srcList
      next[dstStage] = dstList
      return next
    })
    await leadsApi.updateStage(draggableId, dstStage).catch(() => {
      setBoard((prev) => {
        const next = { ...prev }
        const dstList = [...(next[dstStage] || [])]
        const srcList = [...(next[srcStage] || [])]
        const idx = dstList.findIndex((l) => l.id === draggableId)
        if (idx !== -1) {
          const [moved] = dstList.splice(idx, 1)
          srcList.splice(source.index, 0, { ...moved, pipelineStage: srcStage })
          next[dstStage] = dstList
          next[srcStage] = srcList
        }
        return next
      })
    })
  }

  const fetchCadences = useCallback(async (leadId: string) => {
    setCadenceLoading(true)
    try {
      const [cadRes, seqRes] = await Promise.all([
        cadencesApi.listLeadCadences(leadId),
        cadencesApi.listSequences(),
      ])
      setLeadCadences(cadRes.data)
      setSequences(seqRes.data)
      const hasActive = cadRes.data.some((c) => c.status === 'active')
      setActiveCadenceLeadIds((prev) => {
        const next = new Set(prev)
        if (hasActive) next.add(leadId)
        else next.delete(leadId)
        return next
      })
    } catch {
      setLeadCadences([])
    } finally {
      setCadenceLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selected) {
      fetchCadences(selected.id)
      setConvertError(null)
    } else {
      setLeadCadences([])
      setShowCadenceModal(false)
    }
  }, [selected, fetchCadences])

  async function handleStartCadence() {
    if (!selected || !selectedSeqId) return
    try {
      await cadencesApi.startCadence(selected.id, selectedSeqId)
      setShowCadenceModal(false)
      setSelectedSeqId('')
      await fetchCadences(selected.id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao iniciar cadência'
      alert(msg)
    }
  }

  async function handlePauseCadence(cid: string) {
    if (!selected) return
    await cadencesApi.pauseCadence(selected.id, cid, 'manual')
    await fetchCadences(selected.id)
  }

  async function handleResumeCadence(cid: string) {
    if (!selected) return
    await cadencesApi.resumeCadence(selected.id, cid)
    await fetchCadences(selected.id)
  }

  async function handleCancelCadence(cid: string) {
    if (!selected || !confirm('Cancelar esta cadência?')) return
    await cadencesApi.cancelCadence(selected.id, cid)
    await fetchCadences(selected.id)
  }

  async function handleGeneratePitch(leadId: string) {
    setGeneratingPitch(true)
    setPitch(null)
    try {
      const { data } = await leadsApi.generatePitch(leadId)
      setPitch(data)
      setPitchTab('whatsapp')
    } catch {
      alert('Erro ao gerar pitch. Verifique se a ANTHROPIC_API_KEY está configurada.')
    } finally {
      setGeneratingPitch(false)
    }
  }

  const totalLeads = Object.values(board).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div className="flex flex-col h-full" style={{ background: '#061422' }}>
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between shrink-0"
        style={{ borderBottom: '1px solid rgba(0,200,232,0.12)', background: '#0A1E30' }}
      >
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#E8F4F8' }}>Pipeline</h1>
          <p className="text-sm" style={{ color: '#7EAFC4' }}>{totalLeads} leads no pipeline</p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: '#7EAFC4' }}>
          Carregando pipeline...
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4" style={{ display: 'flex', height: 'calc(100vh - 160px)' }}>
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-3 h-full min-w-max">
              {STAGES.map((stage) => {
                const leads = board[stage.id] || []
                return (
                  <div key={stage.id} className="flex flex-col shrink-0" style={{ minWidth: '280px', maxWidth: '300px' }}>
                    <div
                      className="flex items-center justify-between px-3 py-2 rounded-t-lg"
                      style={{
                        borderTop: `2px solid ${stage.borderColor}`,
                        borderLeft: `1px solid ${stage.borderColor}`,
                        borderRight: `1px solid ${stage.borderColor}`,
                        background: stage.accent,
                      }}
                    >
                      <span className="text-sm font-semibold" style={{ color: '#E8F4F8' }}>{stage.label}</span>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(0,0,0,0.3)', color: '#A8CCE0' }}
                      >
                        {leads.length}
                      </span>
                    </div>
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="flex-1 min-h-32 p-2 rounded-b-lg space-y-2 transition-colors"
                          style={{
                            border: `1px solid ${stage.borderColor}`,
                            borderTop: 'none',
                            background: snapshot.isDraggingOver ? 'rgba(0,200,232,0.06)' : '#0A1E30',
                            overflowY: 'auto',
                            paddingBottom: '16px',
                          }}
                        >
                          {leads.map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(prov, snap) => (
                                <div
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                  {...prov.dragHandleProps}
                                  onClick={() => setSelected(lead)}
                                  className="rounded-lg p-3 cursor-pointer transition-all"
                                  style={{
                                    background: snap.isDragging ? '#142E44' : '#0B1F30',
                                    border: '1px solid rgba(0,200,232,0.16)',
                                    boxShadow: snap.isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
                                    transform: snap.isDragging ? 'rotate(1deg)' : 'none',
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-1 mb-1">
                                    <p className="font-medium text-sm truncate" style={{ color: '#E8F4F8' }}>
                                      {lead.businessName}
                                    </p>
                                    {activeCadenceLeadIds.has(lead.id) && (
                                      <span
                                        className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full"
                                        style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
                                      >
                                        📅
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs truncate" style={{ color: '#7EAFC4' }}>{lead.neighborhood}</p>
                                  <div className="flex items-center justify-between mt-2">
                                    <span
                                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                                      style={CLASS_STYLE[lead.classification] ?? { bg: 'transparent', color: '#7EAFC4' }}
                                    >
                                      {CLASS_ICON[lead.classification]} {lead.score}
                                    </span>
                                    {lead.lastContactAt && (
                                      <span className="text-xs" style={{ color: '#3E6A80' }}>
                                        {new Date(lead.lastContactAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </DragDropContext>
        </div>
      )}

      {/* Modal lead detail */}
      {selected && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => { setSelected(null); setPitch(null) }}
        >
          <div
            className="rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.2)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(0,200,232,0.12)' }}
            >
              <div>
                <h2 className="font-bold text-lg" style={{ color: '#E8F4F8' }}>{selected.businessName}</h2>
                <p className="text-sm" style={{ color: '#7EAFC4' }}>{selected.name} · {selected.niche}</p>
              </div>
              <button
                onClick={() => { setSelected(null); setPitch(null) }}
                className="text-xl leading-none"
                style={{ color: '#7EAFC4' }}
              >×</button>
            </div>

            <div className="px-6 py-4 space-y-4">

              {/* ── BOTÃO CONVERTER → CLIENTE (só na coluna Fechado) ── */}
              {selected.pipelineStage === 'closed' && selected.status !== 'CLOSED' && (
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'rgba(0,229,200,0.08)', border: '1px solid rgba(0,229,200,0.3)' }}
                >
                  <p className="text-sm font-semibold mb-1" style={{ color: '#00E5C8' }}>
                    🎉 Lead na coluna Fechado
                  </p>
                  <p className="text-xs mb-3" style={{ color: '#7EAFC4' }}>
                    Converta em cliente para mover para a carteira ativa e gerar relatórios.
                  </p>
                  {convertError && (
                    <p className="text-xs mb-2" style={{ color: '#f87171' }}>{convertError}</p>
                  )}
                  <button
                    onClick={handleConvert}
                    disabled={converting}
                    className="w-full font-bold py-2.5 rounded-xl transition-all disabled:opacity-60"
                    style={{
                      background: 'linear-gradient(135deg, #00C8E8, #00E5C8)',
                      color: '#061422',
                      border: 'none',
                    }}
                  >
                    {converting ? '⏳ Convertendo...' : '⭐ Converter → Cliente'}
                  </button>
                </div>
              )}

              {/* Dados do lead */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span style={{ color: '#7EAFC4' }}>Bairro</span>
                  <p className="font-medium" style={{ color: '#E8F4F8' }}>{selected.neighborhood}</p>
                </div>
                <div>
                  <span style={{ color: '#7EAFC4' }}>Score</span>
                  <p className="font-medium mt-0.5">
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={CLASS_STYLE[selected.classification] ?? { background: 'transparent', color: '#7EAFC4' }}
                    >
                      {CLASS_ICON[selected.classification]} {selected.score}
                    </span>
                  </p>
                </div>
                {selected.phone && (
                  <div>
                    <span style={{ color: '#7EAFC4' }}>Telefone</span>
                    <p className="font-medium" style={{ color: '#E8F4F8' }}>{selected.phone}</p>
                  </div>
                )}
                {selected.email && (
                  <div>
                    <span style={{ color: '#7EAFC4' }}>Email</span>
                    <p className="font-medium text-xs truncate" style={{ color: '#E8F4F8' }}>{selected.email}</p>
                  </div>
                )}
                {selected.googleRating && (
                  <div>
                    <span style={{ color: '#7EAFC4' }}>Google</span>
                    <p className="font-medium" style={{ color: '#E8F4F8' }}>⭐ {selected.googleRating} ({selected.reviewCount} reviews)</p>
                  </div>
                )}
                <div>
                  <span style={{ color: '#7EAFC4' }}>Urgência</span>
                  <p className="font-medium" style={{ color: '#E8F4F8' }}>{selected.urgency}/10</p>
                </div>
              </div>

              {selected.painPoints && (
                <div>
                  <p className="text-sm mb-1" style={{ color: '#7EAFC4' }}>Dores identificadas</p>
                  <p
                    className="text-sm rounded-lg p-3"
                    style={{ color: '#A8CCE0', background: 'rgba(0,200,232,0.06)', border: '1px solid rgba(0,200,232,0.1)' }}
                  >
                    {selected.painPoints}
                  </p>
                </div>
              )}
              {selected.idealService && (
                <div>
                  <p className="text-sm mb-1" style={{ color: '#7EAFC4' }}>Serviço ideal</p>
                  <p className="text-sm" style={{ color: '#A8CCE0' }}>{selected.idealService}</p>
                </div>
              )}
              {selected.whatsappAngle && (
                <div>
                  <p className="text-sm mb-1" style={{ color: '#7EAFC4' }}>Ângulo WhatsApp</p>
                  <div
                    className="rounded-lg p-3 flex items-start gap-2"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
                  >
                    <p className="text-sm flex-1 italic" style={{ color: '#34d399' }}>"{selected.whatsappAngle}"</p>
                    <button onClick={() => navigator.clipboard.writeText(selected.whatsappAngle!)} style={{ color: '#34d399' }}>📋</button>
                  </div>
                </div>
              )}

              {/* Gerar Pitch */}
              <div style={{ borderTop: '1px solid rgba(0,200,232,0.1)', paddingTop: 12 }}>
                <button
                  onClick={() => handleGeneratePitch(selected.id)}
                  disabled={generatingPitch}
                  className="w-full flex items-center justify-center gap-2 font-medium py-2.5 rounded-xl transition-colors disabled:opacity-60"
                  style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#c084fc' }}
                >
                  {generatingPitch ? '⏳ Gerando pitch...' : '✨ Gerar Pitch com IA'}
                </button>
              </div>

              {pitch && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(139,92,246,0.3)' }}>
                  <div className="flex" style={{ borderBottom: '1px solid rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.1)' }}>
                    {(['whatsapp', 'email', 'call'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setPitchTab(tab)}
                        className="flex-1 text-xs font-medium py-2 transition-colors"
                        style={{
                          background: pitchTab === tab ? 'rgba(139,92,246,0.4)' : 'transparent',
                          color: pitchTab === tab ? '#e9d5ff' : '#c084fc',
                        }}
                      >
                        {tab === 'whatsapp' ? '💬 WhatsApp' : tab === 'email' ? '📧 Email' : '📞 Ligação'}
                      </button>
                    ))}
                  </div>
                  <div className="p-3" style={{ background: 'rgba(139,92,246,0.06)' }}>
                    {pitchTab === 'whatsapp' && (
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: '#c084fc' }}>Mensagem WhatsApp</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: '#E8F4F8' }}>{pitch.whatsappMessage}</p>
                        <button onClick={() => navigator.clipboard.writeText(pitch.whatsappMessage)} className="mt-2 text-xs font-medium" style={{ color: '#c084fc' }}>📋 Copiar</button>
                      </div>
                    )}
                    {pitchTab === 'email' && (
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: '#c084fc' }}>Assunto: <span style={{ color: '#E8F4F8', fontWeight: 400 }}>{pitch.emailSubject}</span></p>
                        <p className="text-sm whitespace-pre-wrap mt-2" style={{ color: '#E8F4F8' }}>{pitch.emailBody}</p>
                        <button onClick={() => navigator.clipboard.writeText(`Assunto: ${pitch.emailSubject}\n\n${pitch.emailBody}`)} className="mt-2 text-xs font-medium" style={{ color: '#c084fc' }}>📋 Copiar</button>
                      </div>
                    )}
                    {pitchTab === 'call' && (
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: '#c084fc' }}>Script de ligação</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: '#E8F4F8' }}>{pitch.callScript}</p>
                        <button onClick={() => navigator.clipboard.writeText(pitch.callScript)} className="mt-2 text-xs font-medium" style={{ color: '#c084fc' }}>📋 Copiar</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cadências */}
              <div style={{ borderTop: '1px solid rgba(0,200,232,0.1)', paddingTop: 12 }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold" style={{ color: '#E8F4F8' }}>📅 Cadências</p>
                  <button
                    onClick={() => setShowCadenceModal(true)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                    style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
                  >
                    + Iniciar cadência
                  </button>
                </div>
                {cadenceLoading ? (
                  <p className="text-xs" style={{ color: '#7EAFC4' }}>Carregando cadências...</p>
                ) : leadCadences.length === 0 ? (
                  <p className="text-xs italic" style={{ color: '#3E6A80' }}>Nenhuma cadência ativa</p>
                ) : (
                  <div className="space-y-2">
                    {leadCadences.map((c) => {
                      const seq = sequences.find((s) => s.id === c.sequenceId)
                      const steps = (seq?.steps ?? []) as Array<{ day: number; channel: string; message: string }>
                      const statusStyle: Record<string, { bg: string; color: string }> = {
                        active:    { bg: 'rgba(16,185,129,0.15)',  color: '#34d399' },
                        paused:    { bg: 'rgba(234,179,8,0.15)',   color: '#fbbf24' },
                        completed: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
                        cancelled: { bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
                      }
                      return (
                        <div
                          key={c.id}
                          className="rounded-lg p-3 text-xs space-y-1.5"
                          style={{ background: 'rgba(0,200,232,0.05)', border: '1px solid rgba(0,200,232,0.1)' }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate" style={{ color: '#E8F4F8' }}>{seq?.name ?? 'Sequência'}</span>
                            <span
                              className="shrink-0 px-1.5 py-0.5 rounded font-medium"
                              style={statusStyle[c.status] ?? { bg: 'transparent', color: '#94a3b8' }}
                            >
                              {c.status}
                            </span>
                          </div>
                          {steps.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {steps.map((_, i) => (
                                <div
                                  key={i}
                                  className="h-1.5 flex-1 rounded-full"
                                  style={{
                                    background: i < c.currentStep ? '#6366f1'
                                      : i === c.currentStep && c.status === 'active' ? 'rgba(99,102,241,0.5)'
                                      : 'rgba(255,255,255,0.1)',
                                  }}
                                />
                              ))}
                            </div>
                          )}
                          <p style={{ color: '#7EAFC4' }}>
                            Step {c.currentStep + 1}/{steps.length}
                            {c.nextActionAt && c.status === 'active' && <> · Próximo: {new Date(c.nextActionAt).toLocaleDateString('pt-BR')}</>}
                            {c.pauseReason && <> · {c.pauseReason}</>}
                          </p>
                          {c.status === 'active' && (
                            <button onClick={() => handlePauseCadence(c.id)} className="font-medium" style={{ color: '#fbbf24' }}>⏸ Pausar</button>
                          )}
                          {c.status === 'paused' && (
                            <div className="flex gap-3">
                              <button onClick={() => handleResumeCadence(c.id)} className="font-medium" style={{ color: '#34d399' }}>▶ Retomar</button>
                              <button onClick={() => handleCancelCadence(c.id)} className="font-medium" style={{ color: '#f87171' }}>✕ Cancelar</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Modal cadência */}
              {showCadenceModal && (
                <div className="fixed inset-0 flex items-center justify-center z-[60] p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
                  <div
                    className="rounded-2xl w-full max-w-md p-6"
                    style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.2)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="font-bold text-lg mb-1" style={{ color: '#E8F4F8' }}>Iniciar cadência</h3>
                    <p className="text-sm mb-4" style={{ color: '#7EAFC4' }}>{selected?.businessName}</p>
                    <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                      {sequences.map((seq) => {
                        const steps = (seq.steps ?? []) as Array<{ day: number; channel: string }>
                        return (
                          <label
                            key={seq.id}
                            className="block rounded-xl p-3 cursor-pointer transition-colors"
                            style={{
                              border: selectedSeqId === seq.id ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(0,200,232,0.14)',
                              background: selectedSeqId === seq.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                            }}
                          >
                            <input type="radio" name="seq" value={seq.id} className="sr-only" checked={selectedSeqId === seq.id} onChange={() => setSelectedSeqId(seq.id)} />
                            <p className="font-medium text-sm" style={{ color: '#E8F4F8' }}>{seq.name}</p>
                            {seq.description && <p className="text-xs mt-0.5" style={{ color: '#7EAFC4' }}>{seq.description}</p>}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {steps.map((s, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={s.channel === 'whatsapp' ? { background: 'rgba(16,185,129,0.15)', color: '#34d399' } : { background: 'rgba(26,110,255,0.15)', color: '#60a5fa' }}
                                >
                                  Dia {s.day}
                                </span>
                              ))}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowCadenceModal(false); setSelectedSeqId('') }}
                        className="flex-1 font-medium py-2 rounded-xl"
                        style={{ border: '1px solid rgba(0,200,232,0.2)', color: '#7EAFC4' }}
                      >Cancelar</button>
                      <button
                        onClick={handleStartCadence}
                        disabled={!selectedSeqId}
                        className="flex-1 font-medium py-2 rounded-xl disabled:opacity-50"
                        style={{ background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.5)', color: '#a5b4fc' }}
                      >Iniciar</button>
                    </div>
                  </div>
                </div>
              )}

              {selected.whatsapp && (
                <a
                  href={`https://wa.me/55${selected.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full font-medium py-2.5 rounded-xl transition-colors"
                  style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399' }}
                >
                  💬 Abrir WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}