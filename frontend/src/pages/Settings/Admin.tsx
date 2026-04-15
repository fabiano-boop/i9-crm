import { useState, useEffect } from 'react'
import { adminApi, type BackupLog } from '../../services/api'

export default function AdminBackup() {
  const [lastBackup, setLastBackup] = useState<BackupLog | null>(null)
  const [history, setHistory]       = useState<BackupLog[]>([])
  const [loading, setLoading]       = useState(true)
  const [running, setRunning]       = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    adminApi.backupHistory({ limit: 10 })
      .then(({ data }) => {
        setHistory(data.data)
        setLastBackup(data.data[0] ?? null)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  async function handleTrigger() {
    setRunning(true)
    setError('')
    try {
      const { data } = await adminApi.backupTrigger()
      setHistory((prev) => [data, ...prev])
      setLastBackup(data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Erro ao executar backup')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <h2 className="font-semibold text-gray-900 mb-4">💾 Backup do Banco de Dados</h2>

      {/* Status do último backup */}
      <div className="flex items-center justify-between mb-5 p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Último backup</p>
          {loading ? (
            <p className="text-sm text-gray-400">Carregando...</p>
          ) : lastBackup ? (
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${lastBackup.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium text-gray-900">
                  {new Date(lastBackup.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {lastBackup.filename} · {lastBackup.sizeKb} KB ·{' '}
                {lastBackup.triggeredBy === 'auto' ? 'automático' : 'manual'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nenhum backup registrado</p>
          )}
        </div>

        <button
          onClick={handleTrigger}
          disabled={running}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          {running ? (
            <><span className="animate-spin inline-block">⟳</span> Executando...</>
          ) : (
            <>💾 Executar backup</>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Histórico recente</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 pr-4 text-xs font-medium text-gray-400 text-left">Data</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-gray-400 text-left">Arquivo</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-gray-400 text-left">Tamanho</th>
                  <th className="pb-2 text-xs font-medium text-gray-400 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 pr-4 text-gray-700 font-mono text-xs">{log.filename}</td>
                    <td className="py-2 pr-4 text-gray-500 text-xs">{log.sizeKb} KB</td>
                    <td className="py-2">
                      {log.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          ✓ ok
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 cursor-help"
                          title={log.errorMsg ?? ''}
                        >
                          ✕ erro
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
