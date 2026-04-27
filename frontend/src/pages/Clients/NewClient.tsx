import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as Tabs from '@radix-ui/react-tabs'
import { clientsApi, leadsApi, type CreateClientInput } from '../../services/api'

const BAIRROS_ZONA_LESTE = [
  'Água Rasa','Aricanduva','Artur Alvim','Belém','Brás','Burgo Paulista','Cangaíba','Carrão',
  'Cidade A.E. Carvalho','Cidade Líder','Cidade Tiradentes','Ermelino Matarazzo','Guaianazes',
  'Iguatemi','Itaim Paulista','Itaquera','Jardim Helena','José Bonifácio','Lajeado','Mooca',
  'Parque do Carmo','Parque São Lucas','Penha','Sapopemba','São Lucas','São Mateus',
  'São Miguel Paulista','Tatuapé','Vila Carrão','Vila Curuca','Vila Formosa','Vila Jacuí',
  'Vila Matilde','Vila Prudente','Outro',
]
const NICHOS = [
  { value: 'salao_beleza', label: 'Salão de Beleza / Barbearia' },
  { value: 'restaurante',  label: 'Restaurante / Delivery' },
  { value: 'clinica',      label: 'Clínica Odonto / Médica' },
  { value: 'oficina',      label: 'Oficina Mecânica' },
  { value: 'academia',     label: 'Academia / Escola' },
  { value: 'petshop',      label: 'Pet Shop / Veterinária' },
  { value: 'outro',        label: 'Outro' },
]
const PACOTES = [
  { value: 'start',   label: 'Start',   preco: 750,  precoNormal: 997  },
  { value: 'growth',  label: 'Growth',  preco: 1097, precoNormal: 1497 },
  { value: 'premium', label: 'Premium', preco: 1797, precoNormal: 2497 },
]
const ORIGENS = [
  { value: 'lead',     label: 'Lead captado no CRM' },
  { value: 'referral', label: 'Indicação' },
  { value: 'manual',   label: 'Prospecção direta' },
]

const schema = z.object({
  businessName:  z.string().min(2, 'Nome do negócio obrigatório'),
  ownerName:     z.string().min(2, 'Nome do responsável obrigatório'),
  niche:         z.string().optional(),
  address:       z.string().optional(),
  neighborhood:  z.string().optional(),
  mapsLink:      z.string().url('URL inválida').optional().or(z.literal('')),
  whatsapp:      z.string().min(10, 'WhatsApp obrigatório'),
  email:         z.string().email('Email inválido').optional().or(z.literal('')),
  instagram:     z.string().optional(),
  website:       z.string().url('URL inválida').optional().or(z.literal('')),
  package:       z.enum(['start', 'growth', 'premium']).optional(),
  monthlyValue:  z.coerce.number().positive().optional(),
  startDate:     z.string().optional(),
  origin:        z.enum(['lead', 'referral', 'manual']).default('manual'),
  referredBy:    z.string().optional(),
  leadId:        z.string().optional(),
  notes:         z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0F2840', border: '1px solid rgba(0,200,232,0.18)',
  color: '#E8F4F8', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none',
}
const inputErrStyle: React.CSSProperties = { ...inputStyle, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.06)' }

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#7EAFC4', fontFamily: 'monospace' }}>{children}</label>
}
function Input({ error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div>
      <input {...props} style={error ? inputErrStyle : inputStyle} />
      {error && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  )
}
function Select({ error, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <div>
      <select {...props} style={{ ...inputStyle, cursor: 'pointer' }}>{children}</select>
      {error && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  )
}

export default function NewClient() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('business')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const watchPackage = watch('package')
  const watchOrigin  = watch('origin')

  async function onSubmit(values: FormValues) {
    setSaving(true); setError('')
    try {
      const payload: CreateClientInput = {
        businessName: values.businessName, ownerName: values.ownerName,
        niche: values.niche || null, address: values.address || null,
        neighborhood: values.neighborhood || null, whatsapp: values.whatsapp,
        email: values.email || null, package: values.package || null,
        monthlyValue: values.monthlyValue ?? PACOTES.find(p => p.value === values.package)?.preco ?? null,
        startDate: values.startDate ? new Date(values.startDate).toISOString() : undefined,
        origin: values.origin, leadId: values.leadId || null,
        notes: [values.notes, values.referredBy ? `Indicado por: ${values.referredBy}` : '', values.mapsLink ? `Maps: ${values.mapsLink}` : '', values.instagram ? `Instagram: ${values.instagram}` : '', values.website ? `Site: ${values.website}` : ''].filter(Boolean).join('\n') || null,
      }
      const { data: client } = await clientsApi.create(payload)
      if (values.leadId) await leadsApi.update(values.leadId, { status: 'CLOSED' }).catch(() => null)
      navigate(`/clients/${client.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Erro ao salvar cliente')
    } finally { setSaving(false) }
  }

  const tabClass = (value: string) => ({
    padding: '10px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer', border: 'none', background: 'transparent',
    borderBottom: activeTab === value ? '2px solid #00C8E8' : '2px solid transparent',
    color: activeTab === value ? '#00C8E8' : '#7EAFC4',
  } as React.CSSProperties)

  const tabContent: React.CSSProperties = { background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)', borderRadius: '0 12px 12px 12px', padding: 24 }
  const btnPrimary: React.CSSProperties = { background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422', fontWeight: 700 }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/clients" className="text-sm hover:underline" style={{ color: '#7EAFC4' }}>← Clientes</Link>
        <span style={{ color: '#3E6A80' }}>/</span>
        <h1 className="text-xl font-bold" style={{ color: '#E8F4F8' }}>Novo cliente</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          <div style={{ borderBottom: '1px solid rgba(0,200,232,0.12)', marginBottom: 0 }}>
            <Tabs.List className="flex gap-1 px-1">
              <Tabs.Trigger value="business" style={tabClass('business')}>1. Negócio</Tabs.Trigger>
              <Tabs.Trigger value="contact"  style={tabClass('contact')}>2. Contato</Tabs.Trigger>
              <Tabs.Trigger value="contract" style={tabClass('contract')}>3. Contrato</Tabs.Trigger>
            </Tabs.List>
          </div>

          <Tabs.Content value="business" forceMount style={{ ...tabContent, display: activeTab === 'business' ? 'block' : 'none' }}>
            <div className="space-y-4">
              <div><Label>Nome do negócio *</Label><Input {...register('businessName')} placeholder="Ex: Salão da Ana" error={errors.businessName?.message} /></div>
              <div><Label>Nome do dono / responsável *</Label><Input {...register('ownerName')} placeholder="Nome completo" error={errors.ownerName?.message} /></div>
              <div><Label>Nicho</Label><Select {...register('niche')} error={errors.niche?.message}><option value="">Selecionar nicho...</option>{NICHOS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}</Select></div>
              <div><Label>Bairro</Label><Select {...register('neighborhood')} error={errors.neighborhood?.message}><option value="">Selecionar bairro...</option>{BAIRROS_ZONA_LESTE.map(b => <option key={b} value={b}>{b}</option>)}</Select></div>
              <div><Label>Endereço completo</Label><Input {...register('address')} placeholder="Rua, número, complemento" /></div>
              <div><Label>Link do Google Maps (opcional)</Label><Input {...register('mapsLink')} placeholder="https://maps.google.com/..." error={errors.mapsLink?.message} /></div>
              <div className="flex justify-end pt-2">
                <button type="button" onClick={() => setActiveTab('contact')} className="px-5 py-2 rounded-lg text-sm" style={btnPrimary}>Próximo →</button>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="contact" forceMount style={{ ...tabContent, display: activeTab === 'contact' ? 'block' : 'none' }}>
            <div className="space-y-4">
              <div><Label>WhatsApp *</Label><Input {...register('whatsapp')} placeholder="(11) 98765-4321" error={errors.whatsapp?.message} /></div>
              <div><Label>Email</Label><Input {...register('email')} type="email" placeholder="contato@negocio.com.br" error={errors.email?.message} /></div>
              <div>
                <Label>Instagram</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 text-sm" style={{ background: '#0A1E30', border: '1px solid rgba(0,200,232,0.18)', borderRight: 'none', borderRadius: '8px 0 0 8px', color: '#7EAFC4' }}>@</span>
                  <input {...register('instagram')} placeholder="nomedoperfil" style={{ ...inputStyle, borderRadius: '0 8px 8px 0' }} />
                </div>
              </div>
              <div><Label>Site (URL)</Label><Input {...register('website')} placeholder="https://seunegocio.com.br" error={errors.website?.message} /></div>
              <div className="flex justify-between pt-2">
                <button type="button" onClick={() => setActiveTab('business')} className="text-sm px-4 py-2" style={{ color: '#7EAFC4' }}>← Voltar</button>
                <button type="button" onClick={() => setActiveTab('contract')} className="px-5 py-2 rounded-lg text-sm" style={btnPrimary}>Próximo →</button>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="contract" forceMount style={{ ...tabContent, display: activeTab === 'contract' ? 'block' : 'none' }}>
            <div className="space-y-4">
              <div>
                <Label>Pacote contratado</Label>
                <div className="grid grid-cols-3 gap-3 mt-1">
                  {PACOTES.map(p => (
                    <label key={p.value} className="cursor-pointer rounded-xl p-3 text-center transition-colors"
                      style={{ border: watchPackage === p.value ? '2px solid #00C8E8' : '2px solid rgba(0,200,232,0.15)', background: watchPackage === p.value ? 'rgba(0,200,232,0.08)' : 'transparent' }}>
                      <input type="radio" value={p.value} {...register('package')} className="sr-only" />
                      <p className="font-semibold text-sm" style={{ color: '#E8F4F8' }}>{p.label}</p>
                      <p className="font-bold text-lg mt-0.5" style={{ color: '#00C8E8', fontFamily: 'monospace' }}>R${p.preco}</p>
                      <p className="text-xs" style={{ color: '#7EAFC4' }}>/mês</p>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Valor mensal personalizado</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 text-sm" style={{ background: '#0A1E30', border: '1px solid rgba(0,200,232,0.18)', borderRight: 'none', borderRadius: '8px 0 0 8px', color: '#7EAFC4' }}>R$</span>
                  <input {...register('monthlyValue')} type="number" min="0" step="0.01" placeholder="0.00" style={{ ...inputStyle, borderRadius: '0 8px 8px 0' }} />
                </div>
              </div>
              <div><Label>Data de início</Label><Input {...register('startDate')} type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              <div><Label>Origem</Label><Select {...register('origin')} error={errors.origin?.message}>{ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></div>
              {watchOrigin === 'referral' && <div><Label>Quem indicou?</Label><Input {...register('referredBy')} placeholder="Nome do indicador" /></div>}
              <div>
                <Label>ID do Lead (se veio do CRM)</Label>
                <Input {...register('leadId')} placeholder="Cole o ID do lead..." style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }} />
                <p className="text-xs mt-1" style={{ color: '#5A9AB5' }}>O lead será marcado como FECHADO automaticamente.</p>
              </div>
              <div>
                <Label>Observações</Label>
                <textarea {...register('notes')} rows={3} placeholder="Anotações internas, acordos especiais..." style={{ ...inputStyle, resize: 'none' }} />
              </div>
              {error && <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>{error}</div>}
              <div className="flex justify-between pt-2">
                <button type="button" onClick={() => setActiveTab('contact')} className="text-sm px-4 py-2" style={{ color: '#7EAFC4' }}>← Voltar</button>
                <button type="button" disabled={saving} onClick={handleSubmit(onSubmit)} className="px-6 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60" style={btnPrimary}>
                  {saving ? <><span className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid rgba(6,20,34,0.3)', borderTop: '2px solid #061422' }} />Salvando...</> : '✓ Cadastrar cliente'}
                </button>
              </div>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </form>
    </div>
  )
}
