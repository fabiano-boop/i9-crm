import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clientsApi, type Client } from '../../services/api'

const PACKAGE_LABELS: Record<string, string> = { basico: 'Básico', pro: 'Pro', premium: 'Premium' }
const PACKAGE_STYLES: Record<string, { bg: string; color: string }> = {
  basico:  { bg: 'rgba(100,116,139,0.2)', color: '#94a3b8' },
  pro:     { bg: 'rgba(26,110,255,0.15)', color: '#60a5fa' },
  premium: { bg: 'rgba(139,92,246,0.15)', color: '#c084fc' },
}
const STATUS_LABELS: Record<string, string> = { active: 'Ativo', paused: 'Pausado', cancelled: 'Cancelado' }
const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  active:    { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  paused:    { bg: 'rgba(234,179,8,0.15)',  color: '#fbbf24' },
  cancelled: { bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
}
const NICHE_LABELS: Record<string, string> = {
  salao_beleza: 'Salão de Beleza', restaurante: 'Restaurante', clinica: 'Clínica',
  oficina: 'Oficina', academia: 'Academia', petshop: 'Pet Shop', outro: 'Outro',
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR')
}

const inputStyle: React.CSSProperties = {
  background: '#0F2840', border: '1px solid rgba(0,200,232,0.18)', color: '#E8F4F8',
  borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none', cursor: 'pointer',
}

export default function ClientList() {
  const navigate = useNavigate()
  const [clients, setClients]               = useState<Client[]>([])
  const [total, setTotal]                   = useState(0)
  const [page, setPage]                     = useState(1)
  const [statusFilter, setStatusFilter]     = useState('active')
  const [nicheFilter, setNicheFilter]       = useState('')
  const [loading, setLoading]               = useState(true)
  const [generating, setGenerating]         = useState<string | null>(null)
  const [success, setSuccess]               = useState('')
  const limit = 20

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await clientsApi.list({ page, limit, status: statusFilter || undefined, niche: nicheFilter || undefined })
      setClients(data.clients); setTotal(data.total)
    } finally { setLoading(false) }
  }, [page, statusFilter, nicheFilter])

  useEffect(() => { void fetchClients() }, [fetchClients])
  useEffect(() => { setPage(1) }, [statusFilter, nicheFilter])

  async function handleGenerate(clientId: string) {
    setGenerating(clientId)
    try {
      await clientsApi.generateReport(clientId)
      setSuccess('Relatório enfileirado com sucesso!')
      setTimeout(() => setSuccess(''), 4000)
    } catch { /* silencioso */ } finally { setGenerating(null) }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#E8F4F8' }}>Clientes</h1>
          <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>{total} clientes cadastrados</p>
        </div>
        <Link to="/clients/new" className="text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422' }}>
          + Novo cliente
        </Link>
      </div>

      {success && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
          {success}
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl p-4 mb-4 flex flex-wrap gap-3" style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)' }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle}>
          <option value="">Todos os status</option>
          <option value="active">✅ Ativos</option>
          <option value="paused">⏸ Pausados</option>
          <option value="cancelled">❌ Cancelados</option>
        </select>
        <select value={nicheFilter} onChange={e => setNicheFilter(e.target.value)} style={inputStyle}>
          <option value="">Todos os nichos</option>
          {Object.entries(NICHE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#0B1F30', border: '1px solid rgba(0,200,232,0.14)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm" style={{ color: '#7EAFC4' }}>
            <span className="w-5 h-5 rounded-full animate-spin mr-2" style={{ border: '2px solid rgba(0,200,232,0.2)', borderTop: '2px solid #00C8E8' }} />
            Carregando...
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: '#7EAFC4' }}>
            <span className="text-4xl mb-3">🏢</span>
            <p className="font-medium" style={{ color: '#E8F4F8' }}>Nenhum cliente encontrado</p>
            <Link to="/clients/new" className="mt-3 text-sm hover:underline" style={{ color: '#00C8E8' }}>Cadastrar primeiro cliente</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#0A1E30', borderBottom: '1px solid rgba(0,200,232,0.12)' }}>
                  {['Negócio / Nicho', 'Bairro', 'Pacote', 'Valor', 'Início', 'Status', 'Último relatório', 'Ações'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: '#7EAFC4' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map(client => {
                  const lastReport = client.weeklyReports?.[0]
                  return (
                    <tr key={client.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: '#E8F4F8' }}>{client.businessName}</p>
                        <p className="text-xs" style={{ color: '#7EAFC4' }}>{client.niche ? (NICHE_LABELS[client.niche] ?? client.niche) : '—'} · {client.ownerName}</p>
                      </td>
                      <td className="px-4 py-3" style={{ color: '#A8CCE0' }}>{client.neighborhood ?? '—'}</td>
                      <td className="px-4 py-3">
                        {client.package
                          ? <span className="text-xs font-medium px-2 py-1 rounded-full" style={PACKAGE_STYLES[client.package] ?? { background: 'transparent', color: '#94a3b8' }}>{PACKAGE_LABELS[client.package] ?? client.package}</span>
                          : <span className="text-xs" style={{ color: '#3E6A80' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: '#00C8E8', fontFamily: 'monospace' }}>{fmtMoney(client.monthlyValue)}</td>
                      <td className="px-4 py-3" style={{ color: '#A8CCE0' }}>{fmtDate(client.startDate)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-1 rounded-full" style={STATUS_STYLES[client.status] ?? { background: 'transparent', color: '#94a3b8' }}>
                          {STATUS_LABELS[client.status] ?? client.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#7EAFC4' }}>
                        {lastReport ? (
                          <span>
                            {fmtDate(lastReport.weekStart)}
                            {lastReport.sentViaEmail || lastReport.sentViaWhatsApp
                              ? <span className="ml-1" style={{ color: '#34d399' }}>✓ enviado</span>
                              : <span className="ml-1" style={{ color: '#fbbf24' }}>pendente</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => navigate(`/clients/${client.id}`)} className="text-xs hover:underline" style={{ color: '#00C8E8' }}>Ver</button>
                          <button onClick={() => handleGenerate(client.id)} disabled={generating === client.id} className="text-xs hover:underline disabled:opacity-50" style={{ color: '#34d399' }}>
                            {generating === client.id ? '...' : 'Relatório'}
                          </button>
                          <button onClick={() => navigate(`/clients/${client.id}/edit`)} className="text-xs hover:underline" style={{ color: '#7EAFC4' }}>Editar</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid rgba(0,200,232,0.1)', background: '#0A1E30' }}>
            <p className="text-sm" style={{ color: '#7EAFC4' }}>Página {page} de {totalPages} ({total} clientes)</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg disabled:opacity-40"
                style={{ background: '#0F2840', border: '1px solid rgba(0,200,232,0.18)', color: '#A8CCE0' }}>← Anterior</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg disabled:opacity-40"
                style={{ background: '#0F2840', border: '1px solid rgba(0,200,232,0.18)', color: '#A8CCE0' }}>Próxima →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
