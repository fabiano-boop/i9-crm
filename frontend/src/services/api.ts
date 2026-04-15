import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Injeta token em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Renova token expirado automaticamente — só redireciona em 401 real
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // Ignora erros de rede (backend reiniciando) — não faz logout
    if (!error.response) return Promise.reject(error)

    const original = error.config
    if (error.response.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken })
          localStorage.setItem('accessToken', data.accessToken)
          localStorage.setItem('refreshToken', data.refreshToken)
          original.headers.Authorization = `Bearer ${data.accessToken}`
          return api(original)
        } catch {
          // Refresh falhou — limpa sessão via store, não via redirect abrupto
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          window.dispatchEvent(new CustomEvent('auth:logout'))
        }
      }
    }
    return Promise.reject(error)
  }
)

// ===== AUTH =====
export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
  me: () => api.get<User>('/auth/me'),
  logout: () => api.post('/auth/logout'),
  validate2FA: (tempToken: string, token: string) =>
    api.post<{ accessToken: string; refreshToken: string; user: User }>('/auth/2fa/validate', { tempToken, token }),
}

// ===== 2FA =====
export const twoFaApi = {
  setup:   ()               => api.post<{ qrCode: string; secret: string }>('/auth/2fa/setup'),
  verify:  (token: string)  => api.post('/auth/2fa/verify', { token }),
  disable: ()               => api.post('/auth/2fa/disable'),
  status:  ()               => api.get<{ enabled: boolean }>('/auth/2fa/status'),
}

// ===== LEADS =====
export const leadsApi = {
  list: (params?: LeadsParams) => api.get<PaginatedResult<Lead>>('/leads', { params }),
  get: (id: string) => api.get<Lead>(`/leads/${id}`),
  update: (id: string, data: Partial<Lead>) => api.put<Lead>(`/leads/${id}`, data),
  delete: (id: string) => api.delete(`/leads/${id}`),
  updateStage: (id: string, stage: string) => api.put(`/leads/${id}/stage`, { stage }),
  listInteractions: (id: string) => api.get(`/leads/${id}/interactions`),
  createInteraction: (id: string, data: object) => api.post(`/leads/${id}/interactions`, data),
  listTrackingEvents: (id: string) => api.get(`/leads/${id}/tracking-events`),
  generatePitch: (id: string) => api.post<{
    whatsappMessage: string
    emailSubject: string
    emailBody: string
    callScript: string
  }>(`/leads/${id}/generate-pitch`),
}

// ===== CAMPAIGNS =====
export const campaignsApi = {
  list: (params?: { page?: number; limit?: number }) => api.get<PaginatedResult<Campaign>>('/campaigns', { params }),
  get: (id: string) => api.get<Campaign>(`/campaigns/${id}`),
  create: (data: Partial<Campaign>) => api.post<Campaign>('/campaigns', data),
  update: (id: string, data: Partial<Campaign>) => api.put<Campaign>(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
  addLeads: (id: string, leadIds: string[]) => api.post(`/campaigns/${id}/leads`, { leadIds }),
  removeLeads: (id: string, leadId: string) => api.delete(`/campaigns/${id}/leads/${leadId}`),
  send: (id: string, channel?: string) => api.post(`/campaigns/${id}/send`, { channel }),
  pause: (id: string) => api.post(`/campaigns/${id}/pause`),
  stats: (id: string) => api.get(`/campaigns/${id}/stats`),
}

// ===== SHEETS =====
export const sheetsApi = {
  sync: () => api.post('/sheets/sync'),
  history: () => api.get('/sheets/sync-history'),
}

// ===== CADENCES =====
export const cadencesApi = {
  listSequences:  ()                                              => api.get<FollowUpSequence[]>('/cadences/sequences'),
  createSequence: (data: Partial<FollowUpSequence>)               => api.post<FollowUpSequence>('/cadences/sequences', data),
  updateSequence: (id: string, data: Partial<FollowUpSequence>)   => api.put<FollowUpSequence>(`/cadences/sequences/${id}`, data),
  deleteSequence: (id: string)                                    => api.delete(`/cadences/sequences/${id}`),
  listLeadCadences: (leadId: string)                              => api.get<LeadCadence[]>(`/cadences/leads/${leadId}`),
  startCadence:   (leadId: string, sequenceId: string)            => api.post<LeadCadence>(`/cadences/leads/${leadId}`, { sequenceId }),
  pauseCadence:   (leadId: string, cid: string, reason?: string)  => api.put<LeadCadence>(`/cadences/leads/${leadId}/${cid}/pause`, { reason }),
  resumeCadence:  (leadId: string, cid: string)                   => api.put<LeadCadence>(`/cadences/leads/${leadId}/${cid}/resume`),
  cancelCadence:  (leadId: string, cid: string)                   => api.delete(`/cadences/leads/${leadId}/${cid}`),
}

// ===== DUPLICATES =====
export const duplicatesApi = {
  list:  ()                                          => api.get<{ groups: DuplicateGroup[]; total: number }>('/leads/duplicates'),
  merge: (keepId: string, mergeIds: string[])        => api.post<{ lead: Lead; merged: number }>('/leads/duplicates/merge', { keepId, mergeIds }),
}

// ===== ALERTS =====
export const alertsApi = {
  list: (params?: { isRead?: boolean; isDismissed?: boolean; type?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResult<OpportunityAlert>>('/alerts', { params }),
  unreadCount: () => api.get<{ count: number }>('/alerts/unread-count'),
  markRead:    (id: string) => api.put<OpportunityAlert>(`/alerts/${id}/read`),
  dismiss:     (id: string) => api.put<OpportunityAlert>(`/alerts/${id}/dismiss`),
}

// ===== ADMIN =====
export const adminApi = {
  auditLog: (params?: AuditLogParams) =>
    api.get<PaginatedResult<AuditLog>>('/admin/audit-log', { params }),
  backupTrigger: () =>
    api.post<BackupLog>('/admin/backup/trigger'),
  backupHistory: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResult<BackupLog>>('/admin/backup/history', { params }),
}

// ===== TIPOS =====
export interface LoginResponse {
  accessToken?: string
  refreshToken?: string
  user?: User
  requiresTwoFactor?: boolean
  tempToken?: string
}

export interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'AGENT'
  createdAt?: string
}

export interface Lead {
  id: string
  externalId?: string
  name: string
  businessName: string
  niche: string
  neighborhood: string
  address?: string
  phone?: string
  whatsapp?: string
  email?: string
  website?: string
  instagram?: string
  googleRating?: number
  reviewCount?: number
  digitalLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  painPoints?: string
  idealService?: string
  upsellService?: string
  urgency: number
  revenuePotential?: string
  closingEase?: string
  score: number
  classification: 'HOT' | 'WARM' | 'COLD'
  whatsappAngle?: string
  status: 'NEW' | 'CONTACTED' | 'REPLIED' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED' | 'LOST'
  pipelineStage: string
  notes?: string
  lastContactAt?: string
  nextFollowUpAt?: string
  importedAt: string
  updatedAt: string
  assignedTo?: Pick<User, 'id' | 'name' | 'email'>
}

export interface Campaign {
  id: string
  name: string
  description?: string
  type: 'WHATSAPP' | 'EMAIL' | 'BOTH'
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED'
  subject?: string
  bodyText: string
  bodyHtml?: string
  scheduledAt?: string
  sentAt?: string
  createdAt: string
  updatedAt: string
  createdBy?: { id: string; name: string }
  _count?: { campaignLeads: number }
}

export interface AuditLog {
  id: string
  userId: string | null
  userEmail: string | null
  action: string
  entity: string
  entityId: string | null
  after: unknown
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface FollowUpStep {
  day: number
  channel: 'whatsapp' | 'email'
  message: string
}

export interface FollowUpSequence {
  id: string
  name: string
  description: string | null
  steps: FollowUpStep[]
  isActive: boolean
  createdAt: string
}

export interface LeadCadence {
  id: string
  leadId: string
  sequenceId: string
  sequence?: FollowUpSequence
  currentStep: number
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  startedAt: string
  nextActionAt: string | null
  pausedAt: string | null
  pauseReason: string | null
  completedAt: string | null
  updatedAt: string
}

export interface DuplicateGroup {
  leads: Array<Pick<Lead, 'id' | 'name' | 'businessName' | 'phone' | 'whatsapp' | 'email' | 'neighborhood' | 'niche' | 'score' | 'classification' | 'importedAt'>>
  confidence: 'certain' | 'possible'
  reason: string
}

export interface OpportunityAlert {
  id: string
  leadId: string
  lead?: { id: string; businessName: string; classification: string; whatsapp?: string }
  type: string
  title: string
  description: string
  urgency: number
  isRead: boolean
  isDismissed: boolean
  readAt: string | null
  createdAt: string
}

export interface BackupLog {
  id: string
  filename: string
  sizeKb: number
  driveFileId: string | null
  status: string
  errorMsg: string | null
  triggeredBy: string
  createdAt: string
}

export interface AuditLogParams {
  userId?: string
  action?: string
  entity?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export interface LeadsParams {
  page?: number
  limit?: number
  status?: string
  classification?: string
  neighborhood?: string
  search?: string
  stage?: string
}

export interface PaginatedResult<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ─── Agent types ──────────────────────────────────────────────────────────────

export interface AgentConversation {
  id: string
  name: string
  businessName: string
  neighborhood: string
  whatsapp?: string | null
  phone?: string | null
  score: number
  classification: string
  status: string
  agentStage?: string
  needsHandoff: boolean
  interactions: Array<{
    id: string
    content: string
    direction: string
    createdAt: string
    channel: string
  }>
}

export interface AgentStatus {
  enabled: boolean
  activeSessions: number
  activeLeadIds: Array<{ id: string; stage: string }>
  handoffQueue: Array<{
    leadId: string
    reason: string
    timestamp: string
    suggestedPackage?: string
    leadName: string
    businessName: string
    phone?: string | null
    lead?: {
      id: string
      name: string
      businessName: string
      neighborhood: string
      whatsapp?: string | null
      phone?: string | null
      score: number
      classification: string
    } | null
  }>
}

export interface AgentAnalytics {
  runtime: {
    totalProcessed: number
    totalHandoffs: number
    totalSent: number
    handoffRate: string
    activeSessions: number
    pendingHandoffs: number
    startedAt: string
    intentCounts: Record<string, number>
    stageCounts: Record<string, number>
  }
  database: {
    totalMessagesSent: number
    totalMessagesReceived: number
    uniqueLeadsAttended: number
  }
}

// ─── Agent API ────────────────────────────────────────────────────────────────

export const agentApi = {
  status:        ()                                  => api.get<AgentStatus>('/agent/status'),
  toggle:        (enabled: boolean)                  => api.post('/agent/toggle', { enabled }),
  conversations: ()                                  => api.get<{ conversations: AgentConversation[] }>('/agent/conversations'),
  takeover:      (leadId: string)                    => api.put(`/agent/handoff/${leadId}/takeover`),
  analytics:     ()                                  => api.get<AgentAnalytics>('/agent/analytics'),
  test:          (leadId: string, message: string)   => api.post('/agent/test', { leadId, message }),
  objections:    ()                                  => api.get('/agent/objections'),
  leadStatus:    (leadId: string)                    => api.get(`/agent/lead/${leadId}/managed`),
}
