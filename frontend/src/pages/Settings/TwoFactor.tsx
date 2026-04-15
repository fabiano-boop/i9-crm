import { useState, useEffect } from 'react'
import { twoFaApi } from '../../services/api'

export default function TwoFactor() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [step, setStep]       = useState<'idle' | 'setup'>('idle')
  const [qrCode, setQrCode]   = useState('')
  const [secret, setSecret]   = useState('')
  const [otp, setOtp]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    twoFaApi.status()
      .then(({ data }) => setEnabled(data.enabled))
      .catch(() => setEnabled(false))
  }, [])

  async function handleSetup() {
    setLoading(true)
    setError('')
    try {
      const { data } = await twoFaApi.setup()
      setQrCode(data.qrCode)
      setSecret(data.secret)
      setStep('setup')
    } catch {
      setError('Erro ao gerar QR Code')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await twoFaApi.verify(otp)
      setEnabled(true)
      setStep('idle')
      setOtp('')
    } catch {
      setError('Código inválido. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisable() {
    if (!confirm('Deseja desativar o 2FA? Sua conta ficará menos segura.')) return
    setLoading(true)
    setError('')
    try {
      await twoFaApi.disable()
      setEnabled(false)
    } catch {
      setError('Erro ao desativar 2FA')
    } finally {
      setLoading(false)
    }
  }

  if (enabled === null) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">🔐 Autenticação em Dois Fatores</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Adiciona uma camada extra de segurança ao seu login
          </p>
        </div>
        {enabled && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Ativo
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {!enabled && step === 'idle' && (
        <button
          onClick={handleSetup}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {loading ? 'Gerando...' : 'Ativar 2FA'}
        </button>
      )}

      {step === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            1. Escaneie o QR Code com seu app autenticador (Google Authenticator, Authy etc.)
          </p>
          <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48 border rounded-lg" />
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer select-none">Chave manual</summary>
            <code className="block mt-1 font-mono break-all bg-gray-50 p-2 rounded">{secret}</code>
          </details>
          <p className="text-sm text-gray-600">2. Digite o código gerado para confirmar:</p>
          <form onSubmit={handleVerify} className="flex items-center gap-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono w-32 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('idle'); setError('') }}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancelar
            </button>
          </form>
        </div>
      )}

      {enabled && (
        <button
          onClick={handleDisable}
          disabled={loading}
          className="border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {loading ? 'Desativando...' : 'Desativar 2FA'}
        </button>
      )}
    </div>
  )
}
