import { useEffect, useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { leadsApi, cadencesApi, type Lead, type LeadCadence, type FollowUpSequence } from '../services/api'

interface Pitch {
  whatsappMessage: string
  emailSubject: string
  emailBody: string
  callScript: string
}

const STAGES = [
  { id: 'new',         label: 'Novo',        color: 'border-gray-300',   bg: 'bg-gray-50'    },
  { id: 'contacted',   label: 'Contatado',   color: 'border-blue-300',   bg: 'bg-blue-50'    },
  { id: 'replied',     label: 'Respondeu',   color: 'border-green-300',  bg: 'bg-green-50'   },
  { id: 'proposal',    label: 'Proposta',    color: 'border-purple-300', bg: 'bg-purple-50'  },
  { id: 'negotiation', label: 'Negociação',  color: 'border-orange-300', bg: 'bg-orange-50'  },
  { id: 'closed',      label: 'Fechado ✅',  color: 'border-emerald-300',bg: 'bg-emerald-50' },
  { id: 'lost',        label: 'Perdido ❌',  color: 'border-red-300',    bg: 'bg-red-50'     },
]

const CLASS_COLOR: Record<string, string> = {
  HOT: 'bg-red-100 text-red-700',
  WARM: 'bg-yellow-100 text-yellow-700',
  COLD: 'bg-blue-100 text-blue-700',
}
const CLASS_ICON: Record<string, string> = { HOT: '🔥', WARM: '🌤', COLD: '❄️' }

type Board = Record<string, Lead[]>

export default function Pipeline() {
  const [board, setBoard] = useState<Board>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [pitch, setPitch] = useState<Pitch | null>(null)
  const [generatingPitch, setGeneratingPitch] = useState(false)
  const [pitchTab, setPitchTab] = useState<'whatsapp' | 'email' | 'call'>('whatsapp')

  // Cadências
  const [leadCadences, setLeadCadences] = useState<LeadCadence[]>([])
  const [sequences, setSequences] = useState<FollowUpSequence[]>([])
  const [cadenceLoading, setCadenceLoading] = useState(false)
  const [showCadenceModal, setShowCadenceModal] = useState(false)
  const [selectedSeqId, setSelectedSeqId] = useState('')
  const [activeCadenceLeadIds, setActiveCadenceLeadIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // Carrega todos os leads de uma vez (até 200)
        const { data } = await leadsApi.list({ limit: 200 })
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

    // Atualiza UI optimisticamente
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

    // Persiste no backend
    await leadsApi.updateStage(draggableId, dstStage).catch(() => {
      // Reverte se falhar
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
    if (selected) fetchCadences(selected.id)
    else { setLeadCadences([]); setShowCadenceModal(false) }
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-gray-500 text-sm">{totalLeads} leads no pipeline</p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">Carregando pipeline...</div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-3 h-full min-w-max">
              {STAGES.map((stage) => {
                const leads = board[stage.id] || []
                return (
                  <div key={stage.id} className="w-64 flex flex-col">
                    {/* Column header */}
                    <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border-t-2 ${stage.color} ${stage.bg}`}>
                      <span className="text-sm font-semibold text-gray-700">{stage.label}</span>
                      <span className="text-xs bg-white rounded-full px-2 py-0.5 text-gray-500 font-medium">
                        {leads.length}
                      </span>
                    </div>

                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 min-h-32 p-2 rounded-b-lg border border-t-0 ${stage.color} space-y-2 transition-colors ${
                            snapshot.isDraggingOver ? 'bg-blue-50' : stage.bg
                          }`}
                        >
                          {leads.map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(prov, snap) => (
                                <div
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                  {...prov.dragHandleProps}
                                  onClick={() => setSelected(lead)}
                                  className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow ${
                                    snap.isDragging ? 'shadow-lg rotate-1' : ''
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <p className="font-medium text-gray-900 text-sm truncate">{lead.businessName}</p>
                                    {activeCadenceLeadIds.has(lead.id) && (
                                      <span className="shrink-0 text-xs bg-indigo-100 text-indigo-700 font-medium px-1.5 py-0.5 rounded-full">
                                        📅 Cadência
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-400 truncate">{lead.neighborhood}</p>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${CLASS_COLOR[lead.classification]}`}>
                                      {CLASS_ICON[lead.classification]} {lead.score}
                                    </span>
                                    {lead.lastContactAt && (
                                      <span className="text-xs text-gray-400">
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

      {/* Lead detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => { setSelected(null); setPitch(null) }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">{selected.businessName}</h2>
                <p className="text-gray-500 text-sm">{selected.name} · {selected.niche}</p>
              </div>
              <button onClick={() => { setSelected(null); setPitch(null) }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">Bairro</span><p className="font-medium">{selected.neighborhood}</p></div>
                <div><span className="text-gray-400">Score</span>
                  <p className="font-medium">
                    <span className={`px-2 py-0.5 rounded text-xs ${CLASS_COLOR[selected.classification]}`}>
                      {CLASS_ICON[selected.classification]} {selected.score}
                    </span>
                  </p>
                </div>
                {selected.phone && <div><span className="text-gray-400">Telefone</span><p className="font-medium">{selected.phone}</p></div>}
                {selected.email && <div><span className="text-gray-400">Email</span><p className="font-medium text-xs truncate">{selected.email}</p></div>}
                {selected.googleRating && (
                  <div><span className="text-gray-400">Google</span><p className="font-medium">⭐ {selected.googleRating} ({selected.reviewCount} reviews)</p></div>
                )}
                <div><span className="text-gray-400">Urgência</span><p className="font-medium">{selected.urgency}/10</p></div>
              </div>

              {selected.painPoints && (
                <div>
                  <p className="text-gray-400 text-sm mb-1">Dores identificadas</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selected.painPoints}</p>
                </div>
              )}
              {selected.idealService && (
                <div>
                  <p className="text-gray-400 text-sm mb-1">Serviço ideal</p>
                  <p className="text-sm text-gray-700">{selected.idealService}</p>
                </div>
              )}
              {selected.whatsappAngle && (
                <div>
                  <p className="text-gray-400 text-sm mb-1">Ângulo WhatsApp</p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                    <p className="text-sm text-green-800 flex-1 italic">"{selected.whatsappAngle}"</p>
                    <button
                      onClick={() => navigator.clipboard.writeText(selected.whatsappAngle!)}
                      className="text-green-600 hover:text-green-800 shrink-0"
                      title="Copiar"
                    >📋</button>
                  </div>
                </div>
              )}
              {/* Gerar Pitch com IA */}
              <div className="border-t border-gray-100 pt-3">
                <button
                  onClick={() => handleGeneratePitch(selected.id)}
                  disabled={generatingPitch}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition-colors"
                >
                  {generatingPitch ? '⏳ Gerando pitch...' : '✨ Gerar Pitch com IA'}
                </button>
              </div>

              {/* Resultado do Pitch */}
              {pitch && (
                <div className="border border-purple-200 rounded-xl overflow-hidden">
                  <div className="flex border-b border-purple-100 bg-purple-50">
                    {(['whatsapp', 'email', 'call'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setPitchTab(tab)}
                        className={`flex-1 text-xs font-medium py-2 transition-colors ${
                          pitchTab === tab
                            ? 'bg-purple-600 text-white'
                            : 'text-purple-700 hover:bg-purple-100'
                        }`}
                      >
                        {tab === 'whatsapp' ? '💬 WhatsApp' : tab === 'email' ? '📧 Email' : '📞 Ligação'}
                      </button>
                    ))}
                  </div>
                  <div className="p-3 bg-purple-50">
                    {pitchTab === 'whatsapp' && (
                      <div>
                        <p className="text-xs text-purple-600 font-medium mb-1">Mensagem WhatsApp</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{pitch.whatsappMessage}</p>
                        <button
                          onClick={() => navigator.clipboard.writeText(pitch.whatsappMessage)}
                          className="mt-2 text-xs text-purple-600 hover:text-purple-800 font-medium"
                        >📋 Copiar mensagem</button>
                      </div>
                    )}
                    {pitchTab === 'email' && (
                      <div>
                        <p className="text-xs text-purple-600 font-medium mb-1">Assunto: <span className="text-gray-800 font-normal">{pitch.emailSubject}</span></p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap mt-2">{pitch.emailBody}</p>
                        <button
                          onClick={() => navigator.clipboard.writeText(`Assunto: ${pitch.emailSubject}\n\n${pitch.emailBody}`)}
                          className="mt-2 text-xs text-purple-600 hover:text-purple-800 font-medium"
                        >📋 Copiar email</button>
                      </div>
                    )}
                    {pitchTab === 'call' && (
                      <div>
                        <p className="text-xs text-purple-600 font-medium mb-1">Script de ligação</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{pitch.callScript}</p>
                        <button
                          onClick={() => navigator.clipboard.writeText(pitch.callScript)}
                          className="mt-2 text-xs text-purple-600 hover:text-purple-800 font-medium"
                        >📋 Copiar script</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Cadências ───────────────────────────────── */}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">📅 Cadências</p>
                  <button
                    onClick={() => setShowCadenceModal(true)}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-2.5 py-1 rounded-lg transition-colors"
                  >
                    + Iniciar cadência
                  </button>
                </div>

                {cadenceLoading ? (
                  <p className="text-xs text-gray-400">Carregando cadências...</p>
                ) : leadCadences.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Nenhuma cadência ativa</p>
                ) : (
                  <div className="space-y-2">
                    {leadCadences.map((c) => {
                      const seq = sequences.find((s) => s.id === c.sequenceId)
                      const steps = (seq?.steps ?? []) as Array<{ day: number; channel: string; message: string }>
                      const statusColor: Record<string, string> = {
                        active: 'bg-green-100 text-green-700',
                        paused: 'bg-yellow-100 text-yellow-700',
                        completed: 'bg-gray-100 text-gray-500',
                        cancelled: 'bg-red-100 text-red-500',
                      }
                      return (
                        <div key={c.id} className="bg-gray-50 rounded-lg p-3 text-xs space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-800 truncate">{seq?.name ?? 'Sequência'}</span>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded font-medium ${statusColor[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                              {c.status}
                            </span>
                          </div>

                          {/* Steps progress */}
                          {steps.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {steps.map((_, i) => (
                                <div
                                  key={i}
                                  className={`h-1.5 flex-1 rounded-full ${
                                    i < c.currentStep ? 'bg-indigo-500' :
                                    i === c.currentStep && c.status === 'active' ? 'bg-indigo-300 animate-pulse' :
                                    'bg-gray-200'
                                  }`}
                                />
                              ))}
                            </div>
                          )}

                          <p className="text-gray-400">
                            Step {c.currentStep + 1}/{steps.length}
                            {c.nextActionAt && c.status === 'active' && (
                              <> · Próximo: {new Date(c.nextActionAt).toLocaleDateString('pt-BR')}</>
                            )}
                            {c.pauseReason && <> · Motivo: {c.pauseReason}</>}
                          </p>

                          {/* Actions */}
                          {c.status === 'active' && (
                            <button
                              onClick={() => handlePauseCadence(c.id)}
                              className="text-yellow-600 hover:text-yellow-800 font-medium"
                            >⏸ Pausar</button>
                          )}
                          {c.status === 'paused' && (
                            <div className="flex gap-3">
                              <button onClick={() => handleResumeCadence(c.id)} className="text-green-600 hover:text-green-800 font-medium">▶ Retomar</button>
                              <button onClick={() => handleCancelCadence(c.id)} className="text-red-500 hover:text-red-700 font-medium">✕ Cancelar</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Modal iniciar cadência */}
              {showCadenceModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">Iniciar cadência</h3>
                    <p className="text-sm text-gray-500 mb-4">{selected?.businessName}</p>

                    <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                      {sequences.map((seq) => {
                        const steps = (seq.steps ?? []) as Array<{ day: number; channel: string }>
                        return (
                          <label
                            key={seq.id}
                            className={`block border rounded-xl p-3 cursor-pointer transition-colors ${
                              selectedSeqId === seq.id
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-gray-200 hover:border-indigo-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="seq"
                              value={seq.id}
                              className="sr-only"
                              checked={selectedSeqId === seq.id}
                              onChange={() => setSelectedSeqId(seq.id)}
                            />
                            <p className="font-medium text-sm text-gray-900">{seq.name}</p>
                            {seq.description && <p className="text-xs text-gray-500 mt-0.5">{seq.description}</p>}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {steps.map((s, i) => (
                                <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${
                                  s.channel === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                }`}>
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
                        className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleStartCadence}
                        disabled={!selectedSeqId}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 rounded-xl transition-colors"
                      >
                        Iniciar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {selected.whatsapp && (
                <a
                  href={`https://wa.me/55${selected.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 rounded-xl transition-colors"
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
