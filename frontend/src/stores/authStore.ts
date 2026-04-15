import { create } from 'zustand'
import { authApi, type User, type LoginResponse } from '../services/api'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ requiresTwoFactor: boolean; tempToken?: string }>
  validate2FA: (tempToken: string, token: string) => Promise<void>
  logout: () => Promise<void>
  loadUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const { data } = await authApi.login(email, password)
    const res = data as LoginResponse

    if (res.requiresTwoFactor) {
      return { requiresTwoFactor: true, tempToken: res.tempToken }
    }

    localStorage.setItem('accessToken', res.accessToken!)
    localStorage.setItem('refreshToken', res.refreshToken!)
    set({ user: res.user, isAuthenticated: true })
    return { requiresTwoFactor: false }
  },

  validate2FA: async (tempToken, token) => {
    const { data } = await authApi.validate2FA(tempToken, token)
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    set({ user: data.user, isAuthenticated: true })
  },

  logout: async () => {
    await authApi.logout().catch(() => null)
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set({ user: null, isAuthenticated: false })
  },

  loadUser: async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }
    try {
      const { data } = await authApi.me()
      set({ user: data, isAuthenticated: true, isLoading: false })
    } catch (err: unknown) {
      // Só limpa tokens em 401 real — ignora erros de rede/servidor reiniciando
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        set({ user: null, isAuthenticated: false, isLoading: false })
      } else {
        // Erro de rede: mantém sessão, tenta novamente em 3s
        setTimeout(async () => {
          try {
            const { data } = await authApi.me()
            set({ user: data, isAuthenticated: true, isLoading: false })
          } catch {
            set({ isLoading: false })
          }
        }, 3000)
      }
    }
  },
}))
