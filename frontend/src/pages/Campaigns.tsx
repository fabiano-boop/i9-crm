import { useEffect, useRef, useState } from 'react'
import { campaignsApi, leadsApi, type Campaign, type Lead } from '../services/api'

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Rascunho', SCHEDULED: 'Agendada', RUNNING: 'Enviando', PAUSED: 'Pausada', COMPLETED: 'Concluída' }
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DRAFT:     { bg: 'rgba(100,116,139,0.2)', color: '#94a3b8' },
  SCHEDULED: { bg: 'rgba(26,110,255,0.15)', color: '#60a5fa' },
  RUNNING:   { bg: 'rgba(234,179,8,0.15)',  color: '#fbbf24' },
  PAUSED:    { bg: 'rgba(249,115,22,0.15)', color: '#fb923c' },
  COMPLETED: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
}
const TYPE_ICON: Record<string, string> = { WHATSAPP: '💬', EMAIL: '📧', BOTH: '📣' }
const CLASS_COLOR: Record<string, string> = { HOT: '#f87171', WARM: '#fbbf24', COLD: '#60a5fa' }

type View = 'list' | 'new'
const WIZARD_STEPS = ['Configuração', 'Mensagem', 'Leads', 'Revisão']
const VARIABLES = ['{{nome}}', '{{negocio}}', '{{bairro}}', '{{angulo}}']

type WizardForm = { name: string; type: string; subject: string; description: string; bodyText: string }
const INITIAL_FORM: WizardForm = { name: '', type: 'WHATSAPP', subject: '', description: '', bodyText: '' }

function applyVariables(template: string, lead: Lead): string {
  return template
    .replace(/\{\{nome\}\}/g, lead.name ?? '')
    .replace(/\{\{negocio\}\}/g, lead.businessName ?? '')
    .replace(/\{\{bairro\}\}/g, lead.neighborhood ?? '')
    .replace(/\{\{angulo\}\}/g, lead.whatsappAngle ?? '[ângulo]')
}

const inputStyle: React.CSSProperties = { background: '#0F2840', border: '1px solid rgba(0,200,232,0.18)', color: '#E8F4F8', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none', width: '100%' }
const cardStyle: React.CSSProperties = { background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)', borderRadius: 12 }

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
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors"
                style={{
                  background: isCompleted ? '#00C8E8' : isActive ? 'transparent' : 'transparent',
                  borderColor: isCompleted ? '#00C8E8' : isActive ? '#00C8E8' : 'rgba(0,200,232,0.2)',
                  color: isCompleted ? '#061422' : isActive ? '#00C8E8' : '#3E6A80',
                }}
              >
                {isCompleted ? '✓' : stepNum}
              </div>
              <span className="text-xs mt-1 font-medium whitespace-nowrap" style={{ color: isActive ? '#00C8E8' : isCompleted ? '#00E5C8' : '#3E6A80' }}>
                {label}
              </span>
            </div>
            {idx < WIZARD_STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-1 mb-5 transition-colors" style={{ background: stepNum < current ? '#00C8E8' : 'rgba(0,200,232,0.15)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ProgressBar({ step }: { step: number }) {
  const pct = Math.round((step / WIZARD_STEPS.length) * 100)
  return (
    <div className="w-full rounded-full h-1.5 mt-2" style={{ background: 'rgba(0,200,232,0.1)' }}>
      <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #00C8E8, #00E5C8)' }} />
    </div>
  )
}

function Step1({ form, setForm }: { form: WizardForm; setForm: React.Dispatch<React.SetStateAction<WizardForm>> }) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#7EAFC4', fontFamily: 'monospace' }}>Nome da campanha *</label>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Ex: Oferta Janeiro — Salões da Zona Leste" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#7EAFC4', fontFamily: 'monospace' }}>Canal *</label>
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={{ ...inputStyle }}>
            <option value="WHATSAPP">💬 WhatsApp</option>
            <option value="EMAIL">📧 Email</option>
            <option value="BOTH">📣 Ambos</option>
          </select>
        </div>
        {(form.type === 'EMAIL' || form.type === 'BOTH') && (
          <div>
            <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#7EAFC4', fontFamily: 'monospace' }}>Assunto do email</label>
            <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} style={inputStyle} placeholder="Assunto do email" />
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#7EAFC4', fontFamily: 'monospace' }}>Descrição (opcional)</label>
        <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2}
          style={{ ...inputStyle, resize: 'none' }} placeholder="Descreva o objetivo desta campanha..." />
      </div>
    </div>
  )
}

function Step2({ form, setForm }: { form: WizardForm; setForm: React.Dispatch<React.SetStateAction<WizardForm>> }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  function insertVariable(variable: string) {
    const el = textareaRef.current
    if (!el) { setForm((f) => ({ ...f, bodyText: f.bodyText + variable })); return }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const newValue = el.value.slice(0, start) + variable + el.value.slice(end)
    setForm((f) => ({ ...f, bodyText: newValue }))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + variable.length, start + variable.length) })
  }
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#7EAFC4', fontFamily: 'monospace' }}>Mensagem *</label>
        <p className="text-xs mb-2" style={{ color: '#5A9AB5' }}>
          Variáveis:{' '}
          {['{{nome}}', '{{negocio}}', '{{bairro}}', '{{angulo}}'].map(v => (
            <code key={v} className="px-1 rounded mx-0.5" style={{ background: 'rgba(0,200,232,0.1)', color: '#00C8E8', fontFamily: 'monospace' }}>{v}</code>
          ))}
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {VARIABLES.map((v) => (
            <button key={v} type="button" onClick={() => insertVariable(v)}
              className="text-xs px-2 py-1 rounded-md transition-colors font-mono"
              style={{ border: '1px solid rgba(0,200,232,0.3)', color: '#00C8E8', background: 'rgba(0,200,232,0.06)' }}>
              + {v}
            </button>
          ))}
        </div>
        <textarea ref={textareaRef} value={form.bodyText} onChange={(e) => setForm((f) => ({ ...f, bodyText: e.target.value }))}
          rows={6} style={{ ...inputStyle, resize: 'none', fontFamily: 'monospace' }}
          placeholder={'Olá {{nome}}! Vi que o {{negocio}} no {{bairro}}...\n\n{{angulo}}'} />
        <p className="text-xs mt-1" style={{ color: '#5A9AB5' }}>{form.bodyText.length} caracteres</p>
      </div>
    </div>
  )
}

function Step3({ selectedLeadIds, setSelectedLeadIds }: { selectedLeadIds: string[]; setSelectedLeadIds: React.Dispatch<React.SetStateAction<string[]>> }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState<string>('ALL')

  useEffect(() => { fetchLeads() }, [classFilter]) // eslint-disable-line

  async function fetchLeads() {
    setLoadingLeads(true)
    try {
      const params: Record<string, unknown> = { limit: 100 }
      if (classFilter !== 'ALL') params.classification = classFilter
      const { data } = await leadsApi.list(params)
      setLeads(data.data)
    } finally { setLoadingLeads(false) }
  }

  const filtered = leads.filter((l) => {
    if (!search) return true
    const q = search.toLowerCase()
    return l.name?.toLowerCase().includes(q) || l.businessName?.toLowerCase().includes(q) || l.neighborhood?.toLowerCase().includes(q)
  })

  function toggleLead(id: string) { setSelectedLeadIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Buscar por nome, negócio ou bairro..." />
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
          <option value="ALL">Todos</option>
          <option value="HOT">🔥 HOT</option>
          <option value="WARM">⚡ WARM</option>
          <option value="COLD">❄️ COLD</option>
        </select>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: '#A8CCE0' }}>{selectedLeadIds.length} leads selecionados</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setSelectedLeadIds(filtered.map((l) => l.id))} className="text-xs hover:underline" style={{ color: '#00C8E8' }}>Selecionar todos</button>
          <span style={{ color: '#3E6A80' }}>|</span>
          <button type="button" onClick={() => setSelectedLeadIds([])} className="text-xs hover:underline" style={{ color: '#7EAFC4' }}>Limpar</button>
        </div>
      </div>
      <div className="rounded-lg overflow-y-auto max-h-64" style={{ border: '1px solid rgba(0,200,232,0.14)', background: '#0A1E30' }}>
        {loadingLeads ? (
          <div className="text-center py-8 text-sm" style={{ color: '#7EAFC4' }}>Carregando leads...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: '#7EAFC4' }}>Nenhum lead encontrado</div>
        ) : (
          <div>
            {filtered.map((lead) => (
              <label key={lead.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <input type="checkbox" checked={selectedLeadIds.includes(lead.id)} onChange={() => toggleLead(lead.id)} className="rounded" style={{ accentColor: '#00C8E8' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#E8F4F8' }}>{lead.businessName}</p>
                  <p className="text-xs" style={{ color: '#7EAFC4' }}>
                    {lead.neighborhood} · <span style={{ color: CLASS_COLOR[lead.classification] ?? '#A8CCE0' }}>{lead.classification}</span> · score {lead.score}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs" style={{ color: '#5A9AB5' }}>Mostrando {filtered.length} de {leads.length} leads carregados</p>
    </div>
  )
}

function Step4({ form, selectedLeadIds, allLeads }: { form: WizardForm; selectedLeadIds: string[]; allLeads: Lead[] }) {
  const firstLead = allLeads.find((l) => selectedLeadIds.includes(l.id)) ?? null
  const preview = firstLead ? applyVariables(form.bodyText, firstLead) : form.bodyText
  return (
    <div className="space-y-5">
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,200,232,0.04)', border: '1px solid rgba(0,200,232,0.12)' }}>
        <h4 className="text-sm font-semibold" style={{ color: '#E8F4F8' }}>Resumo</h4>
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
          <div><span style={{ color: '#7EAFC4' }}>Nome:</span> <span className="font-medium" style={{ color: '#E8F4F8' }}>{form.name || '—'}</span></div>
          <div><span style={{ color: '#7EAFC4' }}>Canal:</span> <span className="font-medium" style={{ color: '#E8F4F8' }}>{TYPE_ICON[form.type]} {form.type}</span></div>
          {form.subject && <div className="col-span-2"><span style={{ color: '#7EAFC4' }}>Assunto:</span> <span className="font-medium" style={{ color: '#E8F4F8' }}>{form.subject}</span></div>}
          <div><span style={{ color: '#7EAFC4' }}>Leads:</span> <span className="font-medium" style={{ color: '#E8F4F8' }}>{selectedLeadIds.length} selecionados</span></div>
        </div>
        <div>
          <p className="text-sm mb-1" style={{ color: '#7EAFC4' }}>Mensagem (prévia):</p>
          <p className="text-sm rounded-lg p-3 whitespace-pre-wrap line-clamp-4" style={{ background: '#0F2840', border: '1px solid rgba(0,200,232,0.1)', color: '#A8CCE0' }}>
            {form.bodyText.slice(0, 200)}{form.bodyText.length > 200 ? '…' : ''}
          </p>
        </div>
      </div>
      {firstLead && (
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: '#E8F4F8' }}>
            Preview para <span style={{ color: '#00C8E8' }}>{firstLead.businessName}</span>:
          </p>
          <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#A7F3D0' }}>{preview}</p>
          </div>
        </div>
      )}
      {selectedLeadIds.length === 0 && (
        <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#fbbf24' }}>
          Nenhum lead selecionado. A campanha será criada sem leads — você poderá adicionar depois.
        </div>
      )}
    </div>
  )
}

function CampaignWizard({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<WizardForm>(INITIAL_FORM)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { leadsApi.list({ limit: 200 }).then(({ data }) => setAllLeads(data.data)).catch(() => {}) }, [])

  function canProceed() {
    if (step === 1) return form.name.trim().length > 0
    if (step === 2) return form.bodyText.trim().length > 0
    return true
  }

  async function handleCreate() {
    setSaving(true)
    try {
      const payload = { name: form.name, type: form.type as Campaign['type'], bodyText: form.bodyText, subject: form.subject || undefined, description: form.description || undefined }
      const { data: created } = await campaignsApi.create(payload)
      if (selectedLeadIds.length > 0) await campaignsApi.addLeads(created.id, selectedLeadIds)
      onDone()
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl p-6 max-w-2xl w-full" style={cardStyle}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-lg" style={{ color: '#E8F4F8' }}>Nova Campanha</h2>
        <span className="text-xs" style={{ color: '#7EAFC4' }}>Passo {step} de {WIZARD_STEPS.length}</span>
      </div>
      <ProgressBar step={step} />
      <div className="mt-6 mb-2"><StepIndicator current={step} /></div>
      {step === 1 && <Step1 form={form} setForm={setForm} />}
      {step === 2 && <Step2 form={form} setForm={setForm} />}
      {step === 3 && <Step3 selectedLeadIds={selectedLeadIds} setSelectedLeadIds={setSelectedLeadIds} />}
      {step === 4 && <Step4 form={form} selectedLeadIds={selectedLeadIds} allLeads={allLeads} />}
      <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid rgba(0,200,232,0.1)' }}>
        <div>
          {step > 1
            ? <button type="button" onClick={() => setStep((s) => s - 1)} className="text-sm px-4 py-2 rounded-lg transition-colors" style={{ border: '1px solid rgba(0,200,232,0.2)', color: '#7EAFC4' }}>← Anterior</button>
            : <button type="button" onClick={onCancel} className="text-sm px-4 py-2" style={{ color: '#7EAFC4' }}>Cancelar</button>}
        </div>
        <div>
          {step < WIZARD_STEPS.length
            ? <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canProceed()} className="text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422', fontWeight: 700 }}>Próximo →</button>
            : <button type="button" onClick={handleCreate} disabled={saving} className="text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #10b981, #00E5C8)', color: '#061422', fontWeight: 700 }}>{saving ? 'Criando...' : '✓ Criar campanha'}</button>}
        </div>
      </div>
    </div>
  )
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('list')
  const [selected, setSelected] = useState<Campaign | null>(null)
  const [showAddLeads, setShowAddLeads] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])

  useEffect(() => { fetchCampaigns() }, [])

  async function fetchCampaigns() {
    setLoading(true)
    try { const { data } = await campaignsApi.list({ limit: 50 }); setCampaigns(data.data) } finally { setLoading(false) }
  }

  async function handleSend(id: string) {
    if (!confirm('Iniciar disparo da campanha?')) return
    await campaignsApi.send(id); await fetchCampaigns()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta campanha?')) return
    await campaignsApi.delete(id); await fetchCampaigns()
  }

  async function openAddLeads(campaign: Campaign) {
    setSelected(campaign); setSelectedLeadIds([])
    const { data } = await leadsApi.list({ limit: 100 }); setLeads(data.data); setShowAddLeads(true)
  }

  async function handleAddLeads() {
    if (!selected || selectedLeadIds.length === 0) return
    await campaignsApi.addLeads(selected.id, selectedLeadIds); setShowAddLeads(false); await fetchCampaigns()
  }

  function toggleLead(id: string) { setSelectedLeadIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#E8F4F8' }}>Campanhas</h1>
          <p className="text-sm" style={{ color: '#7EAFC4' }}>{campaigns.length} campanhas criadas</p>
        </div>
        {view === 'list'
          ? <button onClick={() => setView('new')} className="text-sm font-bold px-4 py-2 rounded-lg transition-colors" style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422' }}>+ Nova campanha</button>
          : <button onClick={() => setView('list')} className="text-sm" style={{ color: '#7EAFC4' }}>← Voltar</button>}
      </div>

      {view === 'new' && <CampaignWizard onDone={async () => { setView('list'); await fetchCampaigns() }} onCancel={() => setView('list')} />}

      {view === 'list' && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-16 text-sm" style={{ color: '#7EAFC4' }}>Carregando campanhas...</div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl" style={cardStyle}>
              <span className="text-4xl mb-3">📣</span>
              <p className="font-medium" style={{ color: '#E8F4F8' }}>Nenhuma campanha criada</p>
              <p className="text-sm mt-1" style={{ color: '#7EAFC4' }}>Crie sua primeira campanha para começar</p>
            </div>
          ) : (
            campaigns.map((c) => (
              <div key={c.id} className="rounded-xl p-5 flex items-center gap-4 transition-colors" style={cardStyle}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,200,232,0.3)')}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,200,232,0.14)')}>
                <span className="text-2xl">{TYPE_ICON[c.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: '#E8F4F8' }}>{c.name}</p>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={STATUS_STYLE[c.status] ?? { background: 'transparent', color: '#94a3b8' }}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#7EAFC4' }}>
                    {c._count?.campaignLeads ?? 0} leads · Criada por {c.createdBy?.name} · {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                  {c.bodyText && <p className="text-sm mt-1 line-clamp-1" style={{ color: '#5A9AB5' }}>{c.bodyText.slice(0, 100)}...</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openAddLeads(c)} className="text-xs px-3 py-1.5 rounded-lg transition-colors" style={{ border: '1px solid rgba(0,200,232,0.2)', color: '#A8CCE0' }}>+ Leads</button>
                  {(c.status === 'DRAFT' || c.status === 'PAUSED') && (
                    <button onClick={() => handleSend(c.id)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399' }}>▶ Enviar</button>
                  )}
                  {c.status === 'RUNNING' && (
                    <button onClick={() => campaignsApi.pause(c.id).then(fetchCampaigns)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.4)', color: '#fb923c' }}>⏸ Pausar</button>
                  )}
                  {c.status === 'DRAFT' && (
                    <button onClick={() => handleDelete(c.id)} className="text-xs px-2 py-1.5" style={{ color: '#f87171' }}>🗑</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showAddLeads && selected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setShowAddLeads(false)}>
          <div className="rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col" style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.2)' }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,200,232,0.12)' }}>
              <h3 className="font-semibold" style={{ color: '#E8F4F8' }}>Adicionar leads à "{selected.name}"</h3>
              <button onClick={() => setShowAddLeads(false)} className="text-xl" style={{ color: '#7EAFC4' }}>×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-sm mb-3" style={{ color: '#7EAFC4' }}>{selectedLeadIds.length} selecionados</p>
              <div className="space-y-2">
                {leads.map((lead) => (
                  <label key={lead.id} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <input type="checkbox" checked={selectedLeadIds.includes(lead.id)} onChange={() => toggleLead(lead.id)} className="rounded" style={{ accentColor: '#00C8E8' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#E8F4F8' }}>{lead.businessName}</p>
                      <p className="text-xs" style={{ color: '#7EAFC4' }}>{lead.neighborhood} · {lead.classification} {lead.score}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(0,200,232,0.1)' }}>
              <button onClick={handleAddLeads} disabled={selectedLeadIds.length === 0}
                className="flex-1 text-sm font-bold py-2 rounded-lg disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422' }}>
                Adicionar {selectedLeadIds.length} leads
              </button>
              <button onClick={() => setShowAddLeads(false)} className="px-4 py-2 text-sm" style={{ color: '#7EAFC4' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
