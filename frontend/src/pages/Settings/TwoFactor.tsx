import { useState, useEffect } from 'react'
import { twoFaApi } from '../../services/api'

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
  padding: '10px 16px',
  fontSize: 14,
  outline: 'none',
  width: '100%',
}

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
    setLoading(true); setError('')
    try {
      const { data } = await twoFaApi.setup()
      setQrCode(data.qrCode); setSecret(data.secret); setStep('setup')
    } catch { setError('Erro ao gerar QR Code') } finally { setLoading(false) }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      await twoFaApi.verify(otp)
      setEnabled(true); setStep('idle'); setOtp('')
    } catch { setError('Código inválido. Tente novamente.') } finally { setLoading(false) }
  }

  async function handleDisable() {
    if (!confirm('Deseja desativar o 2FA? Sua conta ficará menos segura.')) return
    setLoading(true); setError('')
    try { await twoFaApi.disable(); setEnabled(false) }
    catch { setError('Erro ao desativar 2FA') } finally { setLoading(false) }
  }

  if (enabled === null) return null

  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold" style={{ color: '#E8F4F8' }}>🔐 Autenticação em Dois Fatores</h2>
          <p className="text-sm mt-0.5" style={{ color: '#7EAFC4' }}>Adiciona uma camada extra de segurança ao seu login</p>
        </div>
        {enabled && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#34d399' }} />
            Ativo
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 text-sm rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {!enabled && step === 'idle' && (
        <button
          onClick={handleSetup}
          disabled={loading}
          className="text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #00C8E8, #00E5C8)', color: '#061422' }}
        >
          {loading ? 'Gerando...' : 'Ativar 2FA'}
        </button>
      )}

      {step === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: '#A8CCE0' }}>
            1. Escaneie o QR Code com seu app autenticador (Google Authenticator, Authy etc.)
          </p>
          <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48 rounded-lg"
            style={{ border: '2px solid rgba(0,200,232,0.3)' }} />
          <details className="text-xs" style={{ color: '#7EAFC4' }}>
            <summary className="cursor-pointer select-none">Chave manual</summary>
            <code className="block mt-1 font-mono break-all p-2 rounded" style={{ background: 'rgba(0,200,232,0.06)', color: '#00C8E8' }}>{secret}</code>
          </details>
          <p className="text-sm" style={{ color: '#A8CCE0' }}>2. Digite o código gerado para confirmar:</p>
          <form onSubmit={handleVerify} className="flex items-center gap-3">
            <input
              type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
              value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              style={{ ...inputStyle, width: 128, textAlign: 'center', fontSize: 20, fontFamily: 'monospace', letterSpacing: '0.2em', color: '#00C8E8' }}
              autoFocus
            />
            <button type="submit" disabled={loading || otp.length < 6}
              className="text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
              style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399' }}>
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>
            <button type="button" onClick={() => { setStep('idle'); setError('') }}
              className="text-sm transition-colors" style={{ color: '#7EAFC4' }}>
              Cancelar
            </button>
          </form>
        </div>
      )}

      {enabled && (
        <button onClick={handleDisable} disabled={loading}
          className="text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {loading ? 'Desativando...' : 'Desativar 2FA'}
        </button>
      )}
    </div>
  )
}
