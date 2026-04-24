import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { clientsApi, reportsApi, type Client, type WeeklyReport } from '../../services/api'

const PACKAGE_INFO: Record<string, { label: string; bg: string; color: string }> = {
  start:   { label: 'Start',   bg: 'rgba(100,116,139,0.2)', color: '#94a3b8' },
  growth:  { label: 'Growth',  bg: 'rgba(26,110,255,0.15)', color: '#60a5fa' },
  premium: { label: 'Premium', bg: 'rgba(139,92,246,0.15)', color: '#c084fc' },
}
const STATUS_INFO: Record<string, { label: string; dot: string }> = {
  active:    { label: 'Ativo',     dot: '#34d399' },
  paused:    { label: 'Pausado',   dot: '#fbbf24' },
  cancelled: { label: 'Cancelado', dot: '#f87171' },
}
const NICHE_LABELS: Record<string, string> = {
  salao_beleza: '✂️ Salão', restaurante: '🍽️ Restaurante', clinica: '🏥 Clínica',
  oficina: '🔧 Oficina', academia: '💪 Academia', petshop: '🐾 Pet Shop', outro: '🏢 Outro',
}

function fmtDate(s: string | null | undefined) { if (!s) return '—'; return new Date(s).toLocaleDateString('pt-BR') }
function fmtMoney(v: number | null | undefined) { if (v == null) return '—'; return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) }
function readRate(r: WeeklyReport) { if (!r.messagesSent) return '0%'; return ((r.messagesRead / r.messagesSent) * 100).toFixed(1) + '%' }

const cardStyle: React.CSSProperties = { background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)', borderRadius: 12 }
const inputStyle: React.CSSProperties = { background: '#0F2840', border: '1px solid rgba(0,200,232,0.18)', color: '#E8F4F8', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none', width: '100%', resize: 'none' }

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [client, setClient]           = useState<Client | null>(null)
  const [reports, setReports]         = useState<WeeklyReport[]>([])
  const [loading, setLoading]         = useState(true)
  const [generating, setGenerating]   = useState(false)
  const [sending, setSending]         = useState<string | null>(null)
  const [notes, setNotes]             = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [feedback, setFeedback]       = useState('')

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [clientRes, reportsRes] = await Promise.all([clientsApi.get(id), clientsApi.listReports(id, { limit: 20 })])
      setClient(clientRes.data); setNotes(clientRes.data.notes ?? ''); setReports(reportsRes.data.reports)
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { void loadData() }, [loadData])

  async function handleGenerate() {
    if (!id) return; setGenerating(true); setFeedback('')
    try { await clientsApi.generateReport(id); setFeedback('✅ Relatório enfileirado!'); setTimeout(() => void loadData(), 5000) }
    catch { setFeedback('❌ Erro ao gerar relatório') } finally { setGenerating(false) }
  }

  async function handleSend(reportId: string) {
    setSending(reportId); setFeedback('')
    try {
      const token = localStorage.getItem('accessToken') ?? ''
      const res = await fetch(`${import.meta.env.PROD ? 'https://i9-crm-production.up.railway.app/api' : '/api'}/reports/${reportId}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channels: ['email', 'whatsapp'] }),
      })
      if (res.ok) { setFeedback('✅ Relatório enviado!'); void loadData() }
      else setFeedback('❌ Erro ao enviar relatório')
    } finally { setSending(null); setTimeout(() => setFeedback(''), 5000) }
  }

  async function handleSaveNotes() {
    if (!id) return; setSavingNotes(true)
    try { await clientsApi.update(id, { notes }); setFeedback('✅ Notas salvas'); setTimeout(() => setFeedback(''), 3000) }
    finally { setSavingNotes(false) }
  }

  async function handleStatusChange(status: 'active' | 'paused' | 'cancelled') {
    if (!id) return
    if (status === 'cancelled' && !confirm('Confirmar cancelamento do cliente?')) return
    await clientsApi.patchStatus(id, status); void loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" style={{ color: '#7EAFC4' }}>
        <span className="w-6 h-6 rounded-full animate-spin mr-3" style={{ border: '2px solid rgba(0,200,232,0.2)', borderTop: '2px solid #00C8E8' }} />
        Carregando...
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-24" style={{ color: '#7EAFC4' }}>
        <p>Cliente não encontrado</p>
        <Link to="/clients" className="mt-3 text-sm hover:underline" style={{ color: '#00C8E8' }}>← Voltar</Link>
      </div>
    )
  }

  const pkg = client.package ? PACKAGE_INFO[client.package] : null
  const statusInfo = STATUS_INFO[client.status]
  const totalMessages = reports.reduce((s, r) => s + r.messagesSent, 0)
  const totalReplies  = reports.reduce((s, r) => s + r.repliesReceived, 0)
  const totalAppts    = reports.reduce((s, r) => s + r.appointmentsSet, 0)
  const avgReadRate   = reports.length > 0
    ? reports.reduce((s, r) => s + (r.messagesSent > 0 ? r.messagesRead / r.messagesSent : 0), 0) / reports.length * 100 : 0
  const monthsSince = client.startDate ? Math.max(1, Math.round((Date.now() - new Date(client.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))) : 1
  const ltv = (client.monthlyValue ?? 0) * monthsSince

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm" style={{ color: '#7EAFC4' }}>
        <Link to="/clients" className="hover:underline" style={{ color: '#7EAFC4' }}>Clientes</Link>
        <span>/</span>
        <span className="font-medium" style={{ color: '#E8F4F8' }}>{client.businessName}</span>
      </div>

      {feedback && (
        <div className="rounded-lg px-4 py-3 text-sm"
          style={feedback.startsWith('✅')
            ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }
            : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {feedback}
        </div>
      )}

      {/* Header card */}
      <div style={{ ...cardStyle, padding: 24 }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'rgba(0,229,200,0.12)' }}>
              {NICHE_LABELS[client.niche ?? '']?.split(' ')[0] ?? '🏢'}
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#E8F4F8' }}>{client.businessName}</h1>
              <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>
                {client.ownerName}{client.neighborhood && ` · ${client.neighborhood}`}{client.niche && ` · ${NICHE_LABELS[client.niche] ?? client.niche}`}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {statusInfo && (
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#A8CCE0' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: statusInfo.dot }} />{statusInfo.label}
                  </span>
                )}
                {pkg && <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: pkg.bg, color: pkg.color }}>{pkg.label}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleGenerate} disabled={generating}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422', fontWeight: 700 }}>
              {generating ? <span className="w-3.5 h-3.5 rounded-full animate-spin" style={{ border: '2px solid rgba(6,20,34,0.3)', borderTop: '2px solid #061422' }} /> : '📊'}
              Gerar relatório
            </button>
            <button onClick={() => navigate(`/clients/${id}/edit`)} className="px-4 py-2 rounded-lg text-sm"
              style={{ border: '1px solid rgba(0,200,232,0.2)', color: '#A8CCE0' }}>Editar</button>
            <div className="relative group">
              <button className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ border: '1px solid rgba(0,200,232,0.2)', color: '#7EAFC4' }}>⋮</button>
              <div className="absolute right-0 top-10 rounded-xl py-1 w-44 z-10 hidden group-hover:block"
                style={{ background: '#0F2840', border: '1px solid rgba(0,200,232,0.2)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                {client.status !== 'active'    && <button onClick={() => handleStatusChange('active')}    className="w-full text-left px-4 py-2 text-sm" style={{ color: '#34d399' }}>Ativar</button>}
                {client.status !== 'paused'    && <button onClick={() => handleStatusChange('paused')}    className="w-full text-left px-4 py-2 text-sm" style={{ color: '#fbbf24' }}>Pausar</button>}
                {client.status !== 'cancelled' && <button onClick={() => handleStatusChange('cancelled')} className="w-full text-left px-4 py-2 text-sm" style={{ color: '#f87171' }}>Cancelar</button>}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5" style={{ borderTop: '1px solid rgba(0,200,232,0.1)' }}>
          {[
            { label: 'Valor mensal', value: fmtMoney(client.monthlyValue), color: '#00C8E8' },
            { label: 'Cliente desde', value: fmtDate(client.startDate), color: '#E8F4F8' },
            { label: 'LTV estimado', value: fmtMoney(ltv), color: '#00E5C8' },
            { label: 'Relatórios', value: String(client.totalReports ?? reports.length), color: '#E8F4F8' },
          ].map(kpi => (
            <div key={kpi.label}>
              <p className="text-xs uppercase tracking-wide" style={{ color: '#7EAFC4' }}>{kpi.label}</p>
              <p className="font-bold mt-0.5" style={{ color: kpi.color, fontFamily: 'monospace' }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,200,232,0.08)' }}>
          {client.whatsapp && (
            <a href={`https://wa.me/55${client.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm hover:underline" style={{ color: '#34d399' }}>
              💬 {client.whatsapp}
            </a>
          )}
          {client.email && (
            <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-sm hover:underline" style={{ color: '#60a5fa' }}>✉️ {client.email}</a>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Mensagens enviadas',    value: totalMessages.toLocaleString('pt-BR') },
          { label: 'Taxa de leitura (média)', value: avgReadRate.toFixed(1) + '%' },
          { label: 'Respostas recebidas',   value: totalReplies.toLocaleString('pt-BR') },
          { label: 'Agendamentos',          value: totalAppts.toLocaleString('pt-BR') },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...cardStyle, padding: 16 }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: '#7EAFC4' }}>{kpi.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: '#00E5C8', fontFamily: 'monospace' }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Relatórios */}
        <div className="lg:col-span-2 rounded-xl" style={cardStyle}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,200,232,0.1)' }}>
            <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>Relatórios semanais</h2>
            <button onClick={handleGenerate} disabled={generating} className="text-xs hover:underline disabled:opacity-50" style={{ color: '#00C8E8' }}>
              {generating ? 'Gerando...' : '+ Gerar agora'}
            </button>
          </div>
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: '#7EAFC4' }}>
              <span className="text-3xl mb-2">📊</span>
              <p className="text-sm">Nenhum relatório ainda</p>
              <button onClick={handleGenerate} className="mt-3 text-sm hover:underline" style={{ color: '#00C8E8' }}>Gerar primeiro relatório</button>
            </div>
          ) : (
            <div>
              {reports.map(report => (
                <div key={report.id} className="px-5 py-4 flex items-center justify-between transition-colors" style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: report.sentViaEmail || report.sentViaWhatsApp ? '#34d399' : '#fbbf24' }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#E8F4F8' }}>Semana de {fmtDate(report.weekStart)} a {fmtDate(report.weekEnd)}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#7EAFC4' }}>{report.messagesSent} msgs · {readRate(report)} leitura · {report.repliesReceived} respostas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {report.sentViaEmail || report.sentViaWhatsApp
                      ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Enviado</span>
                      : <button onClick={() => handleSend(report.id)} disabled={sending === report.id} className="text-xs hover:underline disabled:opacity-50" style={{ color: '#00C8E8' }}>
                          {sending === report.id ? 'Enviando...' : 'Enviar'}
                        </button>}
                    <a href={reportsApi.pdfUrl(report.id)} target="_blank" rel="noreferrer" className="text-xs hover:underline" style={{ color: '#7EAFC4' }}>PDF</a>
                    <a href={reportsApi.previewUrl(report.id)} target="_blank" rel="noreferrer" className="text-xs hover:underline" style={{ color: '#7EAFC4' }}>Preview</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notas */}
        <div className="rounded-xl flex flex-col" style={cardStyle}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(0,200,232,0.1)' }}>
            <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>Notas internas</h2>
          </div>
          <div className="flex-1 p-4 flex flex-col gap-3">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={8}
              placeholder="Anotações sobre o cliente, acordos, histórico de conversas..."
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={handleSaveNotes} disabled={savingNotes}
              className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422', fontWeight: 700 }}>
              {savingNotes ? 'Salvando...' : 'Salvar notas'}
            </button>
          </div>
          <div className="px-5 py-4 space-y-2" style={{ borderTop: '1px solid rgba(0,200,232,0.1)' }}>
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#7EAFC4' }}>Contrato</p>
            {[
              { label: 'Pacote', value: pkg ? pkg.label : '—', color: '#E8F4F8' },
              { label: 'Valor',  value: fmtMoney(client.monthlyValue), color: '#00E5C8' },
              { label: 'Início', value: fmtDate(client.startDate), color: '#E8F4F8' },
              { label: 'Origem', value: client.origin, color: '#E8F4F8' },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-sm">
                <span style={{ color: '#7EAFC4' }}>{r.label}</span>
                <span className="font-medium capitalize" style={{ color: r.color }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
