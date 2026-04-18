import { useState, useEffect, useCallback } from 'react'
import { adminApi, type AuditLog } from '../../services/api'

function exportCsv(logs: AuditLog[]) {
  const headers = ['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'EntityId', 'IP']
  const rows = logs.map((l) => [
    new Date(l.createdAt).toLocaleString('pt-BR'),
    l.userEmail ?? l.userId ?? '-',
    l.action, l.entity, l.entityId ?? '-', l.ip ?? '-',
  ])
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

const ACTION_STYLE: Record<string, { bg: string; color: string }> = {
  POST:   { bg: 'rgba(26,110,255,0.15)',  color: '#60a5fa' },
  PUT:    { bg: 'rgba(234,179,8,0.15)',   color: '#fbbf24' },
  PATCH:  { bg: 'rgba(249,115,22,0.15)', color: '#fb923c' },
  DELETE: { bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
}

const cardStyle: React.CSSProperties = {
  background: '#0B1F30',
  border: '1px solid rgba(0,200,232,0.14)',
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
}
const inputStyle: React.CSSProperties = {
  background: '#0F2840',
  border: '1px solid rgba(0,200,232,0.18)',
  color: '#E8F4F8',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
}

export default function AuditLogSection() {
  const [logs, setLogs]                 = useState<AuditLog[]>([])
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [loading, setLoading]           = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [filterStart, setFilterStart]   = useState('')
  const [filterEnd, setFilterEnd]       = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await adminApi.auditLog({
        page, limit: 25,
        action:    filterAction || undefined,
        startDate: filterStart  || undefined,
        endDate:   filterEnd    || undefined,
      })
      setLogs(data.data); setTotal(data.meta.total)
    } catch { /* silently ignore */ } finally { setLoading(false) }
  }, [page, filterAction, filterStart, filterEnd])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  async function handleExport() {
    const { data } = await adminApi.auditLog({ action: filterAction || undefined, startDate: filterStart || undefined, endDate: filterEnd || undefined, limit: 1000 })
    exportCsv(data.data)
  }

  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>📋 Log de Auditoria</h2>
          <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>{total} registros</p>
        </div>
        <button onClick={handleExport}
          className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ border: '1px solid rgba(0,200,232,0.2)', color: '#A8CCE0' }}>
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1) }} style={inputStyle}>
          <option value="">Todas as ações</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input type="date" value={filterStart} onChange={(e) => { setFilterStart(e.target.value); setPage(1) }} style={inputStyle} />
        <input type="date" value={filterEnd}   onChange={(e) => { setFilterEnd(e.target.value);   setPage(1) }} style={inputStyle} />
      </div>

      {loading ? (
        <div className="text-sm py-8 text-center" style={{ color: '#7EAFC4' }}>Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="text-sm py-8 text-center" style={{ color: '#7EAFC4' }}>Nenhum registro encontrado</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,200,232,0.1)' }}>
                {['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'IP'].map(h => (
                  <th key={h} className="pb-2 pr-4 text-xs font-medium text-left uppercase tracking-wide" style={{ color: '#7EAFC4' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="transition-colors"
                  style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td className="py-2.5 pr-4 whitespace-nowrap text-xs" style={{ color: '#7EAFC4' }}>
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-2.5 pr-4 max-w-[160px] truncate text-xs" style={{ color: '#A8CCE0' }}>
                    {log.userEmail ?? log.userId ?? <span style={{ color: '#3E6A80' }}>—</span>}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                      style={ACTION_STYLE[log.action] ?? { bg: 'rgba(100,116,139,0.2)', color: '#94a3b8' }}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="font-medium" style={{ color: '#E8F4F8' }}>{log.entity}</span>
                    {log.entityId && <span className="text-xs ml-1" style={{ color: '#3E6A80' }}>/{log.entityId.slice(0, 8)}</span>}
                  </td>
                  <td className="py-2.5 text-xs font-mono" style={{ color: '#5A9AB5' }}>{log.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {total > 25 && (
            <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(0,200,232,0.1)' }}>
              <span className="text-xs" style={{ color: '#7EAFC4' }}>Página {page} de {Math.ceil(total / 25)}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
                  className="text-xs px-3 py-1 rounded disabled:opacity-40"
                  style={{ border: '1px solid rgba(0,200,232,0.18)', background: '#0F2840', color: '#A8CCE0' }}>
                  Anterior
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page * 25 >= total}
                  className="text-xs px-3 py-1 rounded disabled:opacity-40"
                  style={{ border: '1px solid rgba(0,200,232,0.18)', background: '#0F2840', color: '#A8CCE0' }}>
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
