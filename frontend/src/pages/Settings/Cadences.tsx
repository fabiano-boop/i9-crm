import { useState, useEffect } from 'react'
import { cadencesApi, type FollowUpSequence, type FollowUpStep } from '../../services/api'

const CHANNEL_LABELS: Record<string, string> = { whatsapp: 'WhatsApp', email: 'Email' }

const cardStyle: React.CSSProperties = {
  background: '#0B1F30',
  border: '1px solid rgba(0,200,232,0.14)',
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0F2840', border: '1px solid rgba(0,200,232,0.18)',
  color: '#E8F4F8', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none',
}

function StepBadge({ step }: { step: FollowUpStep }) {
  return (
    <div className="flex items-start gap-3 py-2" style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}>
      <span className="text-xs font-medium w-12 shrink-0 pt-0.5" style={{ color: '#5A9AB5' }}>Dia {step.day}</span>
      <span
        className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded"
        style={step.channel === 'whatsapp'
          ? { background: 'rgba(16,185,129,0.15)', color: '#34d399' }
          : { background: 'rgba(26,110,255,0.15)', color: '#60a5fa' }}
      >
        {CHANNEL_LABELS[step.channel]}
      </span>
      <span className="text-xs line-clamp-2" style={{ color: '#A8CCE0' }}>{step.message}</span>
    </div>
  )
}

export default function Cadences() {
  const [sequences, setSequences] = useState<FollowUpSequence[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<FollowUpSequence | null>(null)
  const [error, setError]         = useState('')
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [steps, setSteps]         = useState<FollowUpStep[]>([{ day: 1, channel: 'whatsapp', message: '' }])
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    cadencesApi.listSequences()
      .then(({ data }) => setSequences(data))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  function openNew() {
    setEditing(null); setName(''); setDesc('')
    setSteps([{ day: 1, channel: 'whatsapp', message: '' }])
    setError(''); setShowForm(true)
  }

  function openEdit(seq: FollowUpSequence) {
    setEditing(seq); setName(seq.name); setDesc(seq.description ?? '')
    setSteps([...seq.steps]); setError(''); setShowForm(true)
  }

  function addStep() {
    const lastDay = steps[steps.length - 1]?.day ?? 0
    setSteps([...steps, { day: lastDay + 7, channel: 'whatsapp', message: '' }])
  }

  function removeStep(i: number) { setSteps(steps.filter((_, idx) => idx !== i)) }
  function updateStep(i: number, field: keyof FollowUpStep, value: string | number) {
    setSteps(steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || steps.some((s) => !s.message.trim())) {
      setError('Preencha o nome e a mensagem de todos os steps.'); return
    }
    setSaving(true); setError('')
    try {
      if (editing) {
        const { data } = await cadencesApi.updateSequence(editing.id, { name, description, steps })
        setSequences((prev) => prev.map((s) => s.id === editing.id ? data : s))
      } else {
        const { data } = await cadencesApi.createSequence({ name, description, steps })
        setSequences((prev) => [...prev, data])
      }
      setShowForm(false)
    } catch { setError('Erro ao salvar sequência.') } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Desativar esta sequência?')) return
    await cadencesApi.deleteSequence(id).catch(() => null)
    setSequences((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>🔁 Sequências de Cadência</h2>
          <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>Gerencie as sequências de follow-up automático</p>
        </div>
        <button onClick={openNew}
          className="text-sm font-bold px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422' }}>
          + Nova sequência
        </button>
      </div>

      {loading ? (
        <p className="text-sm py-4 text-center" style={{ color: '#7EAFC4' }}>Carregando...</p>
      ) : sequences.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: '#7EAFC4' }}>Nenhuma sequência criada ainda.</p>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq) => (
            <div
              key={seq.id}
              className="rounded-lg p-4"
              style={{ border: '1px solid rgba(0,200,232,0.12)', background: 'rgba(0,200,232,0.03)' }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-sm" style={{ color: '#E8F4F8' }}>{seq.name}</p>
                  {seq.description && <p className="text-xs" style={{ color: '#7EAFC4' }}>{seq.description}</p>}
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => openEdit(seq)} className="text-xs hover:underline" style={{ color: '#00C8E8' }}>Editar</button>
                  <button onClick={() => handleDelete(seq.id)} className="text-xs hover:underline" style={{ color: '#f87171' }}>Remover</button>
                </div>
              </div>
              <div className="mt-2">
                {seq.steps.map((step, i) => <StepBadge key={i} step={step} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.2)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div className="p-5" style={{ borderBottom: '1px solid rgba(0,200,232,0.1)' }}>
              <h3 className="font-semibold" style={{ color: '#E8F4F8' }}>
                {editing ? 'Editar sequência' : 'Nova sequência'}
              </h3>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#7EAFC4', fontFamily: 'monospace' }}>Nome</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#7EAFC4', fontFamily: 'monospace' }}>Descrição</label>
                <input type="text" value={description} onChange={(e) => setDesc(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs uppercase tracking-widest" style={{ color: '#7EAFC4', fontFamily: 'monospace' }}>Steps</label>
                  <button type="button" onClick={addStep} className="text-xs hover:underline" style={{ color: '#00C8E8' }}>+ Adicionar step</button>
                </div>
                <div className="space-y-3">
                  {steps.map((step, i) => (
                    <div key={i} className="rounded-lg p-3 space-y-2"
                      style={{ border: '1px solid rgba(0,200,232,0.12)', background: 'rgba(0,200,232,0.03)' }}>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs" style={{ color: '#7EAFC4' }}>Dia</span>
                          <input type="number" min={1} value={step.day}
                            onChange={(e) => updateStep(i, 'day', parseInt(e.target.value, 10))}
                            style={{ ...inputStyle, width: 64, padding: '4px 8px', fontSize: 12 }} />
                        </div>
                        <select value={step.channel} onChange={(e) => updateStep(i, 'channel', e.target.value)}
                          style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="email">Email</option>
                        </select>
                        {steps.length > 1 && (
                          <button type="button" onClick={() => removeStep(i)} className="ml-auto text-xs hover:underline" style={{ color: '#f87171' }}>✕</button>
                        )}
                      </div>
                      <textarea value={step.message} onChange={(e) => updateStep(i, 'message', e.target.value)}
                        rows={2} placeholder="Use {{angulo}}, {{nome}}, {{negocio}}, {{nicho}}"
                        style={{ ...inputStyle, resize: 'none', padding: '6px 8px', fontSize: 12 }} />
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs p-2 rounded" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>{error}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422' }}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="text-sm font-medium px-4 py-2 rounded-lg"
                  style={{ border: '1px solid rgba(0,200,232,0.2)', color: '#7EAFC4' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
