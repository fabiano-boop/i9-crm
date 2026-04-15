import { useState, useEffect, useCallback } from 'react'
import { adminApi, type AuditLog } from '../../services/api'

function exportCsv(logs: AuditLog[]) {
  const headers = ['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'EntityId', 'IP']
  const rows = logs.map((l) => [
    new Date(l.createdAt).toLocaleString('pt-BR'),
    l.userEmail ?? l.userId ?? '-',
    l.action,
    l.entity,
    l.entityId ?? '-',
    l.ip ?? '-',
  ])
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const ACTION_COLORS: Record<string, string> = {
  POST:   'bg-blue-100 text-blue-700',
  PUT:    'bg-yellow-100 text-yellow-700',
  PATCH:  'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
}

export default function AuditLogSection() {
  const [logs, setLogs]               = useState<AuditLog[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [loading, setLoading]         = useState(true)
  const [filterAction, setFilterAction] = useState('')
  const [filterStart, setFilterStart]   = useState('')
  const [filterEnd, setFilterEnd]       = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await adminApi.auditLog({
        page,
        limit: 25,
        action:    filterAction || undefined,
        startDate: filterStart  || undefined,
        endDate:   filterEnd    || undefined,
      })
      setLogs(data.data)
      setTotal(data.meta.total)
    } catch {
      // silently ignore — user sees empty table
    } finally {
      setLoading(false)
    }
  }, [page, filterAction, filterStart, filterEnd])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  async function handleExport() {
    const { data } = await adminApi.auditLog({
      action:    filterAction || undefined,
      startDate: filterStart  || undefined,
      endDate:   filterEnd    || undefined,
      limit: 1000,
    })
    exportCsv(data.data)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">📋 Log de Auditoria</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} registros</p>
        </div>
        <button
          onClick={handleExport}
          className="border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas as ações</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input
          type="date"
          value={filterStart}
          onChange={(e) => { setFilterStart(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={filterEnd}
          onChange={(e) => { setFilterEnd(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">Nenhum registro encontrado</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="pb-2 pr-4 text-xs font-medium text-gray-400 uppercase tracking-wide">Data/Hora</th>
                <th className="pb-2 pr-4 text-xs font-medium text-gray-400 uppercase tracking-wide">Usuário</th>
                <th className="pb-2 pr-4 text-xs font-medium text-gray-400 uppercase tracking-wide">Ação</th>
                <th className="pb-2 pr-4 text-xs font-medium text-gray-400 uppercase tracking-wide">Entidade</th>
                <th className="pb-2 text-xs font-medium text-gray-400 uppercase tracking-wide">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-700 max-w-[160px] truncate">
                    {log.userEmail ?? log.userId ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-700">
                    <span className="font-medium">{log.entity}</span>
                    {log.entityId && (
                      <span className="text-gray-400 text-xs ml-1">/{log.entityId.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="py-2.5 text-gray-400 text-xs font-mono">{log.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginação */}
          {total > 25 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                Página {page} de {Math.ceil(total / 25)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                  className="text-xs px-3 py-1 border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 25 >= total}
                  className="text-xs px-3 py-1 border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
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
