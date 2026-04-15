import { useState, useEffect } from 'react'
import { cadencesApi, type FollowUpSequence, type FollowUpStep } from '../../services/api'

const CHANNEL_LABELS: Record<string, string> = { whatsapp: 'WhatsApp', email: 'Email' }

function StepBadge({ step }: { step: FollowUpStep }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs font-medium text-gray-400 w-12 shrink-0 pt-0.5">Dia {step.day}</span>
      <span className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
        step.channel === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
      }`}>
        {CHANNEL_LABELS[step.channel]}
      </span>
      <span className="text-xs text-gray-600 line-clamp-2">{step.message}</span>
    </div>
  )
}

export default function Cadences() {
  const [sequences, setSequences] = useState<FollowUpSequence[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<FollowUpSequence | null>(null)
  const [error, setError]         = useState('')

  // Form state
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [steps, setSteps]         = useState<FollowUpStep[]>([
    { day: 1, channel: 'whatsapp', message: '' },
  ])
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    cadencesApi.listSequences()
      .then(({ data }) => setSequences(data))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  function openNew() {
    setEditing(null)
    setName('')
    setDesc('')
    setSteps([{ day: 1, channel: 'whatsapp', message: '' }])
    setError('')
    setShowForm(true)
  }

  function openEdit(seq: FollowUpSequence) {
    setEditing(seq)
    setName(seq.name)
    setDesc(seq.description ?? '')
    setSteps([...seq.steps])
    setError('')
    setShowForm(true)
  }

  function addStep() {
    const lastDay = steps[steps.length - 1]?.day ?? 0
    setSteps([...steps, { day: lastDay + 7, channel: 'whatsapp', message: '' }])
  }

  function removeStep(i: number) {
    setSteps(steps.filter((_, idx) => idx !== i))
  }

  function updateStep(i: number, field: keyof FollowUpStep, value: string | number) {
    setSteps(steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || steps.some((s) => !s.message.trim())) {
      setError('Preencha o nome e a mensagem de todos os steps.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        const { data } = await cadencesApi.updateSequence(editing.id, { name, description, steps })
        setSequences((prev) => prev.map((s) => s.id === editing.id ? data : s))
      } else {
        const { data } = await cadencesApi.createSequence({ name, description, steps })
        setSequences((prev) => [...prev, data])
      }
      setShowForm(false)
    } catch {
      setError('Erro ao salvar sequência.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Desativar esta sequência?')) return
    await cadencesApi.deleteSequence(id).catch(() => null)
    setSequences((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">🔁 Sequências de Cadência</h2>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie as sequências de follow-up automático</p>
        </div>
        <button
          onClick={openNew}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          + Nova sequência
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4 text-center">Carregando...</p>
      ) : sequences.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Nenhuma sequência criada ainda.</p>
      ) : (
        <div className="space-y-3">
          {sequences.map((seq) => (
            <div key={seq.id} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{seq.name}</p>
                  {seq.description && <p className="text-xs text-gray-400">{seq.description}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(seq)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(seq.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remover
                  </button>
                </div>
              </div>
              <div className="mt-2">
                {seq.steps.map((step, i) => <StepBadge key={i} step={step} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de formulário */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                {editing ? 'Editar sequência' : 'Nova sequência'}
              </h3>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">Steps</label>
                  <button type="button" onClick={addStep} className="text-xs text-blue-600 hover:underline">
                    + Adicionar step
                  </button>
                </div>
                <div className="space-y-3">
                  {steps.map((step, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">Dia</span>
                          <input
                            type="number"
                            min={1}
                            value={step.day}
                            onChange={(e) => updateStep(i, 'day', parseInt(e.target.value, 10))}
                            className="w-16 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <select
                          value={step.channel}
                          onChange={(e) => updateStep(i, 'channel', e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="whatsapp">WhatsApp</option>
                          <option value="email">Email</option>
                        </select>
                        {steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStep(i)}
                            className="ml-auto text-xs text-red-400 hover:text-red-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <textarea
                        value={step.message}
                        onChange={(e) => updateStep(i, 'message', e.target.value)}
                        rows={2}
                        placeholder="Use {{angulo}}, {{nome}}, {{negocio}}, {{nicho}}"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">{error}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
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
