import { useState } from 'react'
import { sheetsApi } from '../services/api'
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

export default function Settings() {
  const user = useAuthStore((s) => s.user)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

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
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 text-sm mt-0.5">Gerencie integrações e preferências do sistema</p>
      </div>

      {/* Perfil */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">👤 Perfil</h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              user?.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {user?.role === 'ADMIN' ? 'Administrador' : 'Agente'}
            </span>
          </div>
        </div>
      </div>

      {/* Google Sheets */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="font-semibold text-gray-900 mb-1">📊 Sincronização Google Sheets</h2>
        <p className="text-sm text-gray-500 mb-4">
          Importa leads da planilha i9 Cowork para o CRM. Execute manualmente ou aguarde a sincronização automática diária às 07h00.
        </p>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
        >
          {syncing ? (
            <><span className="animate-spin">⟳</span> Sincronizando...</>
          ) : (
            <><span>🔄</span> Sincronizar agora</>
          )}
        </button>

        {syncResult && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-semibold text-green-800">✅ Sincronização concluída!</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-green-700">
              <div>
                <span className="text-green-500">Importados:</span>
                <strong className="ml-1">{syncResult.rowsImported ?? 0}</strong>
              </div>
              <div>
                <span className="text-green-500">Atualizados:</span>
                <strong className="ml-1">{syncResult.rowsUpdated ?? 0}</strong>
              </div>
            </div>
          </div>
        )}

        {syncError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-semibold text-red-800">❌ Erro na sincronização</p>
            <p className="text-sm text-red-700 mt-1">{syncError}</p>
          </div>
        )}
      </div>

      {/* Integrações */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="font-semibold text-gray-900 mb-4">🔌 Integrações</h2>
        <div className="space-y-3">
          <IntegrationRow
            icon="🤖"
            name="Claude AI (Anthropic)"
            description="Scoring inteligente e geração de pitch para leads"
            envKey="ANTHROPIC_API_KEY"
          />
          <IntegrationRow
            icon="💬"
            name="Evolution API (WhatsApp)"
            description="Disparo de campanhas via WhatsApp Business"
            envKey="EVOLUTION_API_URL"
          />
          <IntegrationRow
            icon="📧"
            name="Resend (Email)"
            description="Envio de campanhas por email com tracking"
            envKey="RESEND_API_KEY"
          />
          <IntegrationRow
            icon="📊"
            name="Google Sheets"
            description="Importação de leads da planilha Cowork"
            envKey="GOOGLE_SHEETS_ID"
          />
        </div>
      </div>

      {/* Agente Maya */}
      <AgentSettings />

      {/* 2FA */}
      <TwoFactor />

      {/* Cadências */}
      <Cadences />

      {/* Seções apenas ADMIN */}
      {user?.role === 'ADMIN' && (
        <>
          <AuditLogSection />
          <AdminBackup />
        </>
      )}

      {/* Informações do sistema */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">ℹ️ Sistema</h2>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-500">Versão</span>
          <span className="text-gray-900 font-medium">i9 CRM v1.0.0</span>
          <span className="text-gray-500">Ambiente</span>
          <span className="text-gray-900 font-medium">Desenvolvimento</span>
          <span className="text-gray-500">Backend</span>
          <span className="text-gray-900 font-medium">localhost:3000</span>
          <span className="text-gray-500">Banco de dados</span>
          <span className="text-gray-900 font-medium">PostgreSQL (Supabase)</span>
        </div>
      </div>
    </div>
  )
}

function IntegrationRow({ icon, name, description, envKey }: {
  icon: string
  name: string
  description: string
  envKey: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{name}</p>
        <p className="text-xs text-gray-400 truncate">{description}</p>
      </div>
      <div className="shrink-0">
        <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
          {envKey}
        </span>
      </div>
    </div>
  )
}
