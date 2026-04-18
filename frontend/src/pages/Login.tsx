import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function Login() {
  const [email, setEmail]         = useState('admin@i9solucoes.com.br')
  const [password, setPassword]   = useState('')
  const [otp, setOtp]             = useState('')
  const [tempToken, setTempToken] = useState('')
  const [step, setStep]           = useState<'credentials' | '2fa'>('credentials')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  const login       = useAuthStore((s) => s.login)
  const validate2FA = useAuthStore((s) => s.validate2FA)
  const navigate    = useNavigate()

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result.requiresTwoFactor) {
        setTempToken(result.tempToken ?? '')
        setStep('2fa')
      } else {
        navigate('/dashboard')
      }
    } catch {
      setError('Email ou senha incorretos')
    } finally {
      setLoading(false)
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await validate2FA(tempToken, otp)
      navigate('/dashboard')
    } catch {
      setError('Código inválido ou expirado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#061422' }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden flex"
        style={{
          border: '1px solid rgba(0,200,232,0.18)',
          minHeight: '520px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* ── Painel esquerdo — Branding ── */}
        <div
          className="hidden md:flex flex-col items-center justify-center gap-5 flex-1 p-10 relative overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #061E32, #0A2A40)' }}
        >
          {/* Glow decorativo */}
          <div
            className="absolute -top-16 -right-16 rounded-full pointer-events-none"
            style={{
              width: 200,
              height: 200,
              background: 'radial-gradient(circle, rgba(0,200,232,0.12), transparent 70%)',
            }}
          />
          <div
            className="absolute -bottom-10 -left-10 rounded-full pointer-events-none"
            style={{
              width: 160,
              height: 160,
              background: 'radial-gradient(circle, rgba(0,229,200,0.07), transparent 70%)',
            }}
          />

          {/* Logo */}
          <img
            src="/logo_i9.png"
            alt="i9 Soluções Digitais"
            className="relative z-10"
            style={{
              width: 200,
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 18px rgba(0,200,232,0.35))',
            }}
          />

          {/* Subtítulo */}
          <span
            className="relative z-10 tracking-widest uppercase text-xs"
            style={{ color: '#7EAFC4', fontFamily: 'monospace', letterSpacing: '0.2em' }}
          >
            CRM Inteligente
          </span>

          {/* Tagline */}
          <p
            className="relative z-10 text-sm text-center leading-relaxed"
            style={{ color: '#7EAFC4', maxWidth: 240 }}
          >
            Gerencie seus leads da{' '}
            <span style={{ color: '#00C8E8', fontWeight: 600 }}>Zona Leste</span>{' '}
            com inteligência. Pipeline, WhatsApp e relatórios em um só lugar.
          </p>
        </div>

        {/* ── Painel direito — Formulário ── */}
        <div
          className="flex flex-col justify-center flex-1 p-8 md:p-10"
          style={{ background: '#0A1E30' }}
        >
          {/* Logo mobile (só aparece em telas pequenas) */}
          <div className="flex flex-col items-center mb-8 md:hidden">
            <img
              src="/logo_i9.png"
              alt="i9"
              style={{ width: 140, filter: 'drop-shadow(0 0 12px rgba(0,200,232,0.3))' }}
            />
          </div>

          {step === 'credentials' ? (
            <>
              <h2 className="text-xl font-bold mb-1" style={{ color: '#E8F4F8' }}>
                Bem-vindo de volta
              </h2>
              <p className="text-sm mb-8" style={{ color: '#7EAFC4' }}>
                Acesse sua conta i9 CRM
              </p>

              <form onSubmit={handleCredentials} className="space-y-5">
                <div>
                  <label
                    className="block text-xs uppercase tracking-widest mb-2"
                    style={{ color: '#7EAFC4', fontFamily: 'monospace' }}
                  >
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
                    style={{
                      background: '#0F2840',
                      border: '1px solid rgba(0,200,232,0.18)',
                      color: '#E8F4F8',
                    }}
                    placeholder="seu@i9solucoes.com.br"
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-xs uppercase tracking-widest mb-2"
                    style={{ color: '#7EAFC4', fontFamily: 'monospace' }}
                  >
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
                    style={{
                      background: '#0F2840',
                      border: '1px solid rgba(0,200,232,0.18)',
                      color: '#E8F4F8',
                    }}
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error && (
                  <div
                    className="text-sm px-4 py-3 rounded-lg"
                    style={{
                      background: 'rgba(255,80,80,0.1)',
                      border: '1px solid rgba(255,80,80,0.3)',
                      color: '#FF8080',
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #00C8E8, #00E5C8)',
                    color: '#061422',
                    boxShadow: loading ? 'none' : '0 4px 16px rgba(0,200,232,0.25)',
                  }}
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center mb-6">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ background: 'rgba(0,200,232,0.12)', border: '1px solid rgba(0,200,232,0.3)' }}
                >
                  <span className="text-xl">🔐</span>
                </div>
                <h2 className="text-lg font-bold mb-1" style={{ color: '#E8F4F8' }}>
                  Verificação 2FA
                </h2>
                <p className="text-sm text-center" style={{ color: '#7EAFC4' }}>
                  Digite o código de 6 dígitos do seu autenticador
                </p>
              </div>

              <form onSubmit={handleOtp} className="space-y-5">
                <div>
                  <label
                    className="block text-xs uppercase tracking-widest mb-2"
                    style={{ color: '#7EAFC4', fontFamily: 'monospace' }}
                  >
                    Código 2FA
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full rounded-lg px-4 py-3 text-center text-2xl font-mono tracking-widest outline-none"
                    style={{
                      background: '#0F2840',
                      border: '1px solid rgba(0,200,232,0.18)',
                      color: '#00C8E8',
                    }}
                    placeholder="000000"
                    autoFocus
                    required
                  />
                </div>

                {error && (
                  <div
                    className="text-sm px-4 py-3 rounded-lg"
                    style={{
                      background: 'rgba(255,80,80,0.1)',
                      border: '1px solid rgba(255,80,80,0.3)',
                      color: '#FF8080',
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #00C8E8, #00E5C8)',
                    color: '#061422',
                  }}
                >
                  {loading ? 'Verificando...' : 'Verificar'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setError('') }}
                  className="w-full text-sm transition-colors py-2"
                  style={{ color: '#7EAFC4' }}
                >
                  ← Voltar
                </button>
              </form>
            </>
          )}

          <p
            className="text-center text-xs mt-8"
            style={{ color: '#3E6A80' }}
          >
            i9 Soluções Digitais — Zona Leste SP
          </p>
        </div>
      </div>
    </div>
  )
}
