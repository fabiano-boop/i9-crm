import { useState, useEffect } from 'react'
import { sheetsApi, settingsApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import TwoFactor from './Settings/TwoFactor'
import AuditLogSection from './Settings/AuditLog'
import AdminBackup from './Settings/Admin'
import Cadences from './Settings/Cadences'
import AgentSettings from './Settings/AgentSettings'

interface SyncResult {
  rowsImported?: number
  rowsUpdated?: number
  status?: string
  message?: string
}

const card: React.CSSProperties = {
  background: '#0B1F30',
  border: '1px solid rgba(0,200,232,0.14)',
  borderRadius: 12,
  padding: '20px',
  marginBottom: 16,
}

export default function Settings() {
  const user = useAuthStore((s) => s.user)
  const [syncing, setSyncing]       = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError]   = useState<string | null>(null)

  // SPRINT 3.4: meta mensal de MRR
  const [mrrGoal, setMrrGoal]       = useState<number>(0)
  const [mrrGoalInput, setMrrGoalInput] = useState<string>('0')
  const [savingGoal, setSavingGoal] = useState(false)
  const [goalSaved, setGoalSaved]   = useState(false)

  useEffect(() => {
    settingsApi.get().then(({ data }) => {
      setMrrGoal(data.monthlyMrrGoal)
      setMrrGoalInput(String(data.monthlyMrrGoal))
    }).catch(() => null)
  }, [])

  async function handleSaveGoal() {
    const val = parseFloat(mrrGoalInput.replace(',', '.'))
    if (isNaN(val) || val < 0) return
    setSavingGoal(true)
    try {
      await settingsApi.setMrrGoal(val)
      setMrrGoal(val)
      setGoalSaved(true)
      setTimeout(() => setGoalSaved(false), 3000)
    } catch { /* ignore */ }
    finally { setSavingGoal(false) }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)
    try {
      const { data } = await sheetsApi.sync()
      setSyncResult(data as SyncResult)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setSyncError(msg || 'Erro ao sincronizar. Verifique as configurações do Google Sheets.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#E8F4F8' }}>Configurações</h1>
        <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>Gerencie integrações e preferências do sistema</p>
      </div>

      {/* SPRINT 3.4: Meta mensal de MRR */}
      <div style={card}>
        <h2 className="font-semibold mb-1" style={{ color: '#E8F4F8' }}>🎯 Meta de MRR Mensal</h2>
        <p className="text-sm mb-4" style={{ color: '#7EAFC4' }}>
          Define a meta de receita recorrente mensal exibida no Dashboard como barra de progresso.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" style={{ color: '#7EAFC4', fontSize: 14 }}>
            <span>R$</span>
            <input
              type="number"
              min={0}
              step={100}
              value={mrrGoalInput}
              onChange={(e) => setMrrGoalInput(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm font-semibold w-36 outline-none"
              style={{ background: 'rgba(0,200,232,0.06)', border: '1px solid rgba(0,200,232,0.2)', color: '#E8F4F8' }}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveGoal()}
            />
          </div>
          <button
            onClick={handleSaveGoal}
            disabled={savingGoal}
            className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422' }}
          >
            {savingGoal ? 'Salvando...' : 'Salvar'}
          </button>
          {goalSaved && <span className="text-sm" style={{ color: '#10b981' }}>✅ Salvo!</span>}
        </div>
        {mrrGoal > 0 && (
          <p className="text-xs mt-3" style={{ color: '#7EAFC4' }}>
            Meta atual: R${mrrGoal.toLocaleString('pt-BR')}
          </p>
        )}
      </div>

      {/* Perfil */}
      <div style={card}>
        <h2 className="font-semibold mb-4" style={{ color: '#E8F4F8' }}>👤 Perfil</h2>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
            style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422' }}
          >
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="font-semibold" style={{ color: '#E8F4F8' }}>{user?.name}</p>
            <p className="text-sm" style={{ color: '#7EAFC4' }}>{user?.email}</p>
            <span
              className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={user?.role === 'ADMIN'
                ? { background: 'rgba(139,92,246,0.2)', color: '#c084fc' }
                : { background: 'rgba(100,116,139,0.2)', color: '#94a3b8' }}
            >
              {user?.role === 'ADMIN' ? 'Administrador' : 'Agente'}
            </span>
          </div>
        </div>
      </div>

      {/* Google Sheets */}
      <div style={card}>
        <h2 className="font-semibold mb-1" style={{ color: '#E8F4F8' }}>📊 Sincronização Google Sheets</h2>
        <p className="text-sm mb-4" style={{ color: '#7EAFC4' }}>
          Importa leads da planilha i9 Cowork para o CRM. Execute manualmente ou aguarde a sincronização automática diária às 07h00.
        </p>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-sm font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422', fontWeight: 700 }}
        >
          {syncing ? <><span className="animate-spin">⟳</span> Sincronizando...</> : <><span>🔄</span> Sincronizar agora</>}
        </button>
        {syncResult && (
          <div className="mt-4 p-4 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <p className="text-sm font-semibold" style={{ color: '#34d399' }}>✅ Sincronização concluída!</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div style={{ color: '#34d399' }}>Importados: <strong>{syncResult.rowsImported ?? 0}</strong></div>
              <div style={{ color: '#34d399' }}>Atualizados: <strong>{syncResult.rowsUpdated ?? 0}</strong></div>
            </div>
          </div>
        )}
        {syncError && (
          <div className="mt-4 p-4 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-sm font-semibold" style={{ color: '#f87171' }}>❌ Erro na sincronização</p>
            <p className="text-sm mt-1" style={{ color: '#fca5a5' }}>{syncError}</p>
          </div>
        )}
      </div>

      {/* Integrações */}
      <div style={card}>
        <h2 className="font-semibold mb-4" style={{ color: '#E8F4F8' }}>🔌 Integrações</h2>
        <div className="space-y-3">
          <IntegrationRow icon="🤖" name="Claude AI (Anthropic)" description="Scoring inteligente e geração de pitch para leads" envKey="ANTHROPIC_API_KEY" />
          <IntegrationRow icon="💬" name="Evolution API (WhatsApp)" description="Disparo de campanhas via WhatsApp Business" envKey="EVOLUTION_API_URL" />
          <IntegrationRow icon="📧" name="Resend (Email)" description="Envio de campanhas por email com tracking" envKey="RESEND_API_KEY" />
          <IntegrationRow icon="📊" name="Google Sheets" description="Importação de leads da planilha Cowork" envKey="GOOGLE_SHEETS_ID" />
        </div>
      </div>

      <AgentSettings />
      <TwoFactor />
      <Cadences />

      {user?.role === 'ADMIN' && (
        <>
          <AuditLogSection />
          <AdminBackup />
        </>
      )}

      {/* Sistema */}
      <div style={card}>
        <h2 className="font-semibold mb-4" style={{ color: '#E8F4F8' }}>ℹ️ Sistema</h2>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          {[
            ['Versão', 'i9 CRM v1.0.0'],
            ['Ambiente', 'Desenvolvimento'],
            ['Backend', 'localhost:3000'],
            ['Banco de dados', 'PostgreSQL (Supabase)'],
          ].map(([k, v]) => (
            <>
              <span key={k} style={{ color: '#7EAFC4' }}>{k}</span>
              <span key={v} className="font-medium" style={{ color: '#E8F4F8' }}>{v}</span>
            </>
          ))}
        </div>
      </div>
    </div>
  )
}

function IntegrationRow({ icon, name, description, envKey }: {
  icon: string; name: string; description: string; envKey: string
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg transition-colors"
      style={{ border: '1px solid rgba(0,200,232,0.1)', background: 'rgba(0,200,232,0.03)' }}
    >
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: '#E8F4F8' }}>{name}</p>
        <p className="text-xs truncate" style={{ color: '#7EAFC4' }}>{description}</p>
      </div>
      <div className="shrink-0">
        <span
          className="text-xs font-mono px-2 py-0.5 rounded"
          style={{ background: 'rgba(0,200,232,0.08)', color: '#00C8E8' }}
        >
          {envKey}
        </span>
      </div>
    </div>
  )
}
