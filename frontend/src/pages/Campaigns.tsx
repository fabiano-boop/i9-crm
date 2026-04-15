import { useEffect, useRef, useState } from 'react'
import { campaignsApi, leadsApi, type Campaign, type Lead } from '../services/api'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho', SCHEDULED: 'Agendada', RUNNING: 'Enviando',
  PAUSED: 'Pausada', COMPLETED: 'Concluída',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  RUNNING: 'bg-yellow-100 text-yellow-700',
  PAUSED: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
}
const TYPE_ICON: Record<string, string> = { WHATSAPP: '💬', EMAIL: '📧', BOTH: '📣' }

const CLASS_COLOR: Record<string, string> = {
  HOT: 'text-red-600 font-semibold',
  WARM: 'text-yellow-600 font-semibold',
  COLD: 'text-blue-600 font-semibold',
}

type View = 'list' | 'new' | 'detail'

const WIZARD_STEPS = ['Configuração', 'Mensagem', 'Leads', 'Revisão']

const VARIABLES = ['{{nome}}', '{{negocio}}', '{{bairro}}', '{{angulo}}']

type WizardForm = {
  name: string
  type: string
  subject: string
  description: string
  bodyText: string
}

const INITIAL_FORM: WizardForm = {
  name: '',
  type: 'WHATSAPP',
  subject: '',
  description: '',
  bodyText: '',
}

function applyVariables(template: string, lead: Lead): string {
  return template
    .replace(/\{\{nome\}\}/g, lead.name ?? '')
    .replace(/\{\{negocio\}\}/g, lead.businessName ?? '')
    .replace(/\{\{bairro\}\}/g, lead.neighborhood ?? '')
    .replace(/\{\{angulo\}\}/g, lead.whatsappAngle ?? '[ângulo]')
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {WIZARD_STEPS.map((label, idx) => {
        const stepNum = idx + 1
        const isCompleted = stepNum < current
        const isActive = stepNum === current
        return (
          <div key={stepNum} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors
                  ${isCompleted ? 'bg-blue-600 border-blue-600 text-white' : ''}
                  ${isActive ? 'bg-white border-blue-600 text-blue-600' : ''}
                  ${!isCompleted && !isActive ? 'bg-white border-gray-300 text-gray-400' : ''}
                `}
              >
                {isCompleted ? '✓' : stepNum}
              </div>
              <span className={`text-xs mt-1 font-medium whitespace-nowrap
                ${isActive ? 'text-blue-600' : isCompleted ? 'text-blue-500' : 'text-gray-400'}
              `}>
                {label}
              </span>
            </div>
            {idx < WIZARD_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 transition-colors ${stepNum < current ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Progress bar (linear) ────────────────────────────────────────────────────
function ProgressBar({ step }: { step: number }) {
  const pct = Math.round((step / WIZARD_STEPS.length) * 100)
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
      <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Step 1: Configuração ──────────────────────────────────────────────────────
function Step1({
  form, setForm,
}: {
  form: WizardForm
  setForm: React.Dispatch<React.SetStateAction<WizardForm>>
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome da campanha <span className="text-red-500">*</span></label>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ex: Oferta Janeiro — Salões da Zona Leste"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Canal <span className="text-red-500">*</span></label>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="WHATSAPP">💬 WhatsApp</option>
            <option value="EMAIL">📧 Email</option>
            <option value="BOTH">📣 Ambos</option>
          </select>
        </div>
        {(form.type === 'EMAIL' || form.type === 'BOTH') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assunto do email</label>
            <input
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Assunto do email"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição <span className="text-gray-400 font-normal">(opcional)</span></label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Descreva o objetivo desta campanha..."
        />
      </div>
    </div>
  )
}

// ─── Step 2: Mensagem ──────────────────────────────────────────────────────────
function Step2({
  form, setForm,
}: {
  form: WizardForm
  setForm: React.Dispatch<React.SetStateAction<WizardForm>>
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function insertVariable(variable: string) {
    const el = textareaRef.current
    if (!el) {
      setForm((f) => ({ ...f, bodyText: f.bodyText + variable }))
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const newValue = el.value.slice(0, start) + variable + el.value.slice(end)
    setForm((f) => ({ ...f, bodyText: newValue }))
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + variable.length, start + variable.length)
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mensagem <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Variáveis disponíveis: <code className="bg-gray-100 px-1 rounded">{'{{nome}}'}</code>{' '}
          <code className="bg-gray-100 px-1 rounded">{'{{negocio}}'}</code>{' '}
          <code className="bg-gray-100 px-1 rounded">{'{{bairro}}'}</code>{' '}
          <code className="bg-gray-100 px-1 rounded">{'{{angulo}}'}</code>
        </p>

        <div className="flex flex-wrap gap-2 mb-2">
          {VARIABLES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVariable(v)}
              className="text-xs border border-blue-300 text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors font-mono"
            >
              + {v}
            </button>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          value={form.bodyText}
          onChange={(e) => setForm((f) => ({ ...f, bodyText: e.target.value }))}
          rows={6}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
          placeholder={'Olá {{nome}}! Vi que o {{negocio}} no {{bairro}}...\n\n{{angulo}}'}
        />
        <p className="text-xs text-gray-400 mt-1">{form.bodyText.length} caracteres</p>
      </div>
    </div>
  )
}

// ─── Step 3: Selecionar Leads ─────────────────────────────────────────────────
function Step3({
  selectedLeadIds,
  setSelectedLeadIds,
}: {
  selectedLeadIds: string[]
  setSelectedLeadIds: React.Dispatch<React.SetStateAction<string[]>>
}) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState<string>('ALL')

  useEffect(() => {
    fetchLeads()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classFilter])

  async function fetchLeads() {
    setLoadingLeads(true)
    try {
      const params: Record<string, unknown> = { limit: 100 }
      if (classFilter !== 'ALL') params.classification = classFilter
      const { data } = await leadsApi.list(params)
      setLeads(data.data)
    } finally {
      setLoadingLeads(false)
    }
  }

  const filtered = leads.filter((l) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.name?.toLowerCase().includes(q) ||
      l.businessName?.toLowerCase().includes(q) ||
      l.neighborhood?.toLowerCase().includes(q)
    )
  })

  function toggleLead(id: string) {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function selectAll() {
    setSelectedLeadIds(filtered.map((l) => l.id))
  }

  function clearAll() {
    setSelectedLeadIds([])
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar por nome, negócio ou bairro..."
        />
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Todos</option>
          <option value="HOT">🔥 HOT</option>
          <option value="WARM">⚡ WARM</option>
          <option value="COLD">❄️ COLD</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 font-medium">
          {selectedLeadIds.length} leads selecionados
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-blue-600 hover:underline"
          >
            Selecionar todos
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-gray-500 hover:underline"
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-64">
        {loadingLeads ? (
          <div className="text-center py-8 text-gray-400 text-sm">Carregando leads...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Nenhum lead encontrado</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((lead) => (
              <label
                key={lead.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedLeadIds.includes(lead.id)}
                  onChange={() => toggleLead(lead.id)}
                  className="rounded accent-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{lead.businessName}</p>
                  <p className="text-xs text-gray-400">
                    {lead.neighborhood}{' '}·{' '}
                    <span className={CLASS_COLOR[lead.classification] ?? ''}>
                      {lead.classification}
                    </span>
                    {' '}· score {lead.score}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">
        Mostrando {filtered.length} de {leads.length} leads carregados
      </p>
    </div>
  )
}

// ─── Step 4: Revisão ──────────────────────────────────────────────────────────
function Step4({
  form,
  selectedLeadIds,
  allLeads,
}: {
  form: WizardForm
  selectedLeadIds: string[]
  allLeads: Lead[]
}) {
  const firstLead = allLeads.find((l) => selectedLeadIds.includes(l.id)) ?? null
  const preview = firstLead ? applyVariables(form.bodyText, firstLead) : form.bodyText

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">Resumo</h4>
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
          <div>
            <span className="text-gray-500">Nome:</span>{' '}
            <span className="font-medium text-gray-900">{form.name || '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">Canal:</span>{' '}
            <span className="font-medium text-gray-900">{TYPE_ICON[form.type]} {form.type}</span>
          </div>
          {form.subject && (
            <div className="col-span-2">
              <span className="text-gray-500">Assunto:</span>{' '}
              <span className="font-medium text-gray-900">{form.subject}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500">Leads:</span>{' '}
            <span className="font-medium text-gray-900">{selectedLeadIds.length} selecionados</span>
          </div>
        </div>

        <div>
          <p className="text-gray-500 text-sm mb-1">Mensagem (prévia):</p>
          <p className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg p-3 whitespace-pre-wrap line-clamp-4">
            {form.bodyText.slice(0, 200)}{form.bodyText.length > 200 ? '…' : ''}
          </p>
        </div>
      </div>

      {/* Personalized preview */}
      {firstLead && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">
            Preview personalizado para <span className="text-blue-600">{firstLead.businessName}</span>:
          </p>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{preview}</p>
          </div>
        </div>
      )}

      {selectedLeadIds.length === 0 && (
        <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          Nenhum lead selecionado. A campanha será criada sem leads — você poderá adicionar depois.
        </div>
      )}
    </div>
  )
}

// ─── Campaign Wizard ───────────────────────────────────────────────────────────
function CampaignWizard({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<WizardForm>(INITIAL_FORM)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [saving, setSaving] = useState(false)

  // Pre-load leads for Step4 preview
  useEffect(() => {
    leadsApi.list({ limit: 200 }).then(({ data }) => setAllLeads(data.data)).catch(() => {})
  }, [])

  const step1Valid = form.name.trim().length > 0
  const step2Valid = form.bodyText.trim().length > 0
  // Step 3 and 4 always allow proceeding

  function canProceed() {
    if (step === 1) return step1Valid
    if (step === 2) return step2Valid
    return true
  }

  async function handleCreate() {
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        type: form.type as Campaign['type'],
        bodyText: form.bodyText,
        subject: form.subject || undefined,
        description: form.description || undefined,
      }
      const { data: created } = await campaignsApi.create(payload)
      if (selectedLeadIds.length > 0) {
        await campaignsApi.addLeads(created.id, selectedLeadIds)
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl w-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-gray-900 text-lg">Nova Campanha</h2>
        <span className="text-xs text-gray-400">Passo {step} de {WIZARD_STEPS.length}</span>
      </div>

      <ProgressBar step={step} />

      <div className="mt-6 mb-2">
        <StepIndicator current={step} />
      </div>

      {/* Step content */}
      {step === 1 && <Step1 form={form} setForm={setForm} />}
      {step === 2 && <Step2 form={form} setForm={setForm} />}
      {step === 3 && (
        <Step3
          selectedLeadIds={selectedLeadIds}
          setSelectedLeadIds={setSelectedLeadIds}
        />
      )}
      {step === 4 && (
        <Step4
          form={form}
          selectedLeadIds={selectedLeadIds}
          allLeads={allLeads}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
        <div>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              ← Anterior
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2"
            >
              Cancelar
            </button>
          )}
        </div>

        <div>
          {step < WIZARD_STEPS.length ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              Próximo →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Criando...' : '✓ Criar campanha'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('list')
  const [selected, setSelected] = useState<Campaign | null>(null)

  // Add leads modal (existing campaign)
  const [showAddLeads, setShowAddLeads] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])

  useEffect(() => { fetchCampaigns() }, [])

  async function fetchCampaigns() {
    setLoading(true)
    try {
      const { data } = await campaignsApi.list({ limit: 50 })
      setCampaigns(data.data)
    } finally {
      setLoading(false)
    }
  }

  async function handleSend(id: string) {
    if (!confirm('Iniciar disparo da campanha?')) return
    await campaignsApi.send(id)
    await fetchCampaigns()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta campanha?')) return
    await campaignsApi.delete(id)
    await fetchCampaigns()
  }

  async function openAddLeads(campaign: Campaign) {
    setSelected(campaign)
    setSelectedLeadIds([])
    const { data } = await leadsApi.list({ limit: 100 })
    setLeads(data.data)
    setShowAddLeads(true)
  }

  async function handleAddLeads() {
    if (!selected || selectedLeadIds.length === 0) return
    await campaignsApi.addLeads(selected.id, selectedLeadIds)
    setShowAddLeads(false)
    await fetchCampaigns()
  }

  function toggleLead(id: string) {
    setSelectedLeadIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  async function handleWizardDone() {
    setView('list')
    await fetchCampaigns()
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="text-gray-500 text-sm">{campaigns.length} campanhas criadas</p>
        </div>
        {view === 'list' && (
          <button
            onClick={() => setView('new')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nova campanha
          </button>
        )}
        {view !== 'list' && (
          <button
            onClick={() => setView('list')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Voltar
          </button>
        )}
      </div>

      {/* Wizard: Nova campanha */}
      {view === 'new' && (
        <CampaignWizard
          onDone={handleWizardDone}
          onCancel={() => setView('list')}
        />
      )}

      {/* Lista de campanhas */}
      {view === 'list' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-16 text-gray-400">Carregando campanhas...</div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
              <span className="text-4xl mb-3">📣</span>
              <p className="font-medium">Nenhuma campanha criada</p>
              <p className="text-sm mt-1">Crie sua primeira campanha para começar</p>
            </div>
          ) : (
            campaigns.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                <span className="text-2xl">{TYPE_ICON[c.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c._count?.campaignLeads ?? 0} leads · Criada por {c.createdBy?.name} · {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                  {c.bodyText && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">{c.bodyText.slice(0, 100)}...</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openAddLeads(c)}
                    className="text-xs border border-gray-300 hover:border-blue-400 hover:text-blue-600 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    + Leads
                  </button>
                  {(c.status === 'DRAFT' || c.status === 'PAUSED') && (
                    <button
                      onClick={() => handleSend(c.id)}
                      className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ▶ Enviar
                    </button>
                  )}
                  {c.status === 'RUNNING' && (
                    <button
                      onClick={() => campaignsApi.pause(c.id).then(fetchCampaigns)}
                      className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ⏸ Pausar
                    </button>
                  )}
                  {c.status === 'DRAFT' && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 transition-colors"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: adicionar leads (existing campaign) */}
      {showAddLeads && selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddLeads(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Adicionar leads à "{selected.name}"</h3>
              <button onClick={() => setShowAddLeads(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-sm text-gray-500 mb-3">{selectedLeadIds.length} selecionados</p>
              <div className="space-y-2">
                {leads.map((lead) => (
                  <label key={lead.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead.id)}
                      onChange={() => toggleLead(lead.id)}
                      className="rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{lead.businessName}</p>
                      <p className="text-xs text-gray-400">{lead.neighborhood} · {lead.classification} {lead.score}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 border-t flex gap-3">
              <button
                onClick={handleAddLeads}
                disabled={selectedLeadIds.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg"
              >
                Adicionar {selectedLeadIds.length} leads
              </button>
              <button onClick={() => setShowAddLeads(false)} className="px-4 py-2 text-sm text-gray-500">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
