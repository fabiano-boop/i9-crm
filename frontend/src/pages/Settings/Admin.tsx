import { useState, useEffect } from 'react'
import { adminApi, type BackupLog } from '../../services/api'

const cardStyle: React.CSSProperties = {
  background: '#0B1F30',
  border: '1px solid rgba(0,200,232,0.14)',
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
}

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
    <div style={cardStyle}>
      <h2 className="font-semibold mb-4" style={{ color: '#E8F4F8' }}>💾 Backup do Banco de Dados</h2>

      {/* Status último backup */}
      <div
        className="flex items-center justify-between mb-5 p-4 rounded-lg"
        style={{ background: 'rgba(0,200,232,0.05)', border: '1px solid rgba(0,200,232,0.1)' }}
      >
        <div>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#7EAFC4' }}>Último backup</p>
          {loading ? (
            <p className="text-sm" style={{ color: '#7EAFC4' }}>Carregando...</p>
          ) : lastBackup ? (
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: lastBackup.status === 'success' ? '#34d399' : '#f87171' }}
                />
                <span className="text-sm font-medium" style={{ color: '#E8F4F8' }}>
                  {new Date(lastBackup.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#7EAFC4' }}>
                {lastBackup.filename} · {lastBackup.sizeKb} KB ·{' '}
                {lastBackup.triggeredBy === 'auto' ? 'automático' : 'manual'}
              </p>
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#7EAFC4' }}>Nenhum backup registrado</p>
          )}
        </div>

        <button
          onClick={handleTrigger}
          disabled={running}
          className="text-sm font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422' }}
        >
          {running ? (
            <><span className="animate-spin inline-block">⟳</span> Executando...</>
          ) : (
            <>💾 Executar backup</>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 text-sm rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide mb-2" style={{ color: '#7EAFC4' }}>Histórico recente</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,200,232,0.1)' }}>
                  {['Data', 'Arquivo', 'Tamanho', 'Status'].map(h => (
                    <th key={h} className="pb-2 pr-4 text-xs font-medium text-left uppercase tracking-wide" style={{ color: '#7EAFC4' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((log) => (
                  <tr
                    key={log.id}
                    style={{ borderBottom: '1px solid rgba(0,200,232,0.06)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,232,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="py-2 pr-4 text-xs whitespace-nowrap" style={{ color: '#7EAFC4' }}>
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 pr-4 text-xs font-mono" style={{ color: '#A8CCE0' }}>{log.filename}</td>
                    <td className="py-2 pr-4 text-xs" style={{ color: '#7EAFC4' }}>{log.sizeKb} KB</td>
                    <td className="py-2">
                      {log.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>✓ ok</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full cursor-help"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }} title={log.errorMsg ?? ''}>✕ erro</span>
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
