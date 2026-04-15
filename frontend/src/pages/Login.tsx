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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <span className="text-white text-2xl font-bold">i9</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">i9 CRM</h1>
          <p className="text-gray-500 text-sm mt-1">Gestão de Leads e Campanhas</p>
        </div>

        {step === 'credentials' ? (
          <form onSubmit={handleCredentials} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtp} className="space-y-4">
            <div className="text-center mb-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
                <span className="text-blue-600 text-xl">🔐</span>
              </div>
              <p className="text-sm text-gray-600">
                Digite o código de 6 dígitos do seu autenticador
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código 2FA</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-center tracking-widest text-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="000000"
                autoFocus
                required
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('credentials'); setError('') }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Voltar
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          i9 Soluções Digitais — Zona Leste SP
        </p>
      </div>
    </div>
  )
}
