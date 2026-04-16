import { Router, Request, Response } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { prisma } from '../config/database.js'
import {
  getAgentSessions,
  getHandoffQueue,
  takeoverFromAgent,
  processMessage,
  isAgentManaged,
  getAgentEnabled,
  setAgentEnabled,
  getAgentStats,
} from '../services/whatsappAgent.service.js'
import { OBJECTION_LIBRARY } from '../utils/objections.js'
import { logger } from '../utils/logger.js'

const router = Router()
router.use(requireAuth)

// ─── GET /api/agent/status ────────────────────────────────────────────────────

router.get('/status', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const sessions    = getAgentSessions()
  const handoffMap  = getHandoffQueue()

  const handoffEntries = await Promise.all(
    Array.from(handoffMap.entries()).map(async ([leadId, info]) => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true, name: true, businessName: true, neighborhood: true,
          whatsapp: true, phone: true, score: true, classification: true,
        },
      })
      return { leadId, ...info, lead }
    }),
  )

  res.json({
    enabled: getAgentEnabled(),
    activeSessions: sessions.size,
    activeLeadIds: Array.from(sessions.entries()).map(([id, stage]) => ({ id, stage })),
    handoffQueue: handoffEntries.filter((e) => e.lead !== null),
  })
}))

// ─── POST /api/agent/toggle (ADMIN) ───────────────────────────────────────────

router.post('/toggle', requireAdmin, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { enabled } = req.body as { enabled?: boolean }
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: '"enabled" deve ser true ou false' })
    return
  }
  setAgentEnabled(enabled)
  logger.info({ enabled, by: req.user?.email }, 'Agente Maya: toggle')
  res.json({ enabled, message: `Agente Maya ${enabled ? 'ativado' : 'desativado'}` })
}))

// ─── GET /api/agent/conversations ─────────────────────────────────────────────

router.get('/conversations', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const sessions = getAgentSessions()
  const leadIds  = Array.from(sessions.keys())

  if (leadIds.length === 0) {
    res.json({ conversations: [] })
    return
  }

  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: {
      id: true, name: true, businessName: true, neighborhood: true,
      whatsapp: true, phone: true, score: true, classification: true, status: true,
      interactions: {
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { id: true, content: true, direction: true, createdAt: true, channel: true },
      },
    },
  })

  const conversations = leads.map((lead) => ({
    ...lead,
    agentStage:  sessions.get(lead.id),
    needsHandoff: getHandoffQueue().has(lead.id),
  }))

  res.json({ conversations })
}))

// ─── PUT /api/agent/handoff/:leadId/takeover ──────────────────────────────────

router.put('/handoff/:leadId/takeover', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const leadId = req.params.leadId as string

  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) {
    res.status(404).json({ error: 'Lead não encontrado' })
    return
  }

  takeoverFromAgent(leadId)
  logger.info({ leadId, by: req.user?.email }, 'Agente: humano assumiu conversa')

  res.json({ success: true, message: `Conversa com ${lead.name} assumida com sucesso` })
}))

// ─── GET /api/agent/analytics ─────────────────────────────────────────────────

router.get('/analytics', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const stats = getAgentStats()

  // Interações do agente no banco (canal whatsapp_agent)
  const [totalDbOut, totalDbIn] = await Promise.all([
    prisma.interaction.count({ where: { channel: 'whatsapp_agent', direction: 'OUT' } }),
    prisma.interaction.count({ where: { channel: 'whatsapp_agent', direction: 'IN' } }),
  ])

  // Leads únicos atendidos pelo agente
  const uniqueLeadsResult = await prisma.interaction.findMany({
    where: { channel: 'whatsapp_agent' },
    distinct: ['leadId'],
    select: { leadId: true },
  })

  const handoffRate = stats.totalProcessed > 0
    ? ((stats.totalHandoffs / stats.totalProcessed) * 100).toFixed(1)
    : '0.0'

  res.json({
    runtime: {
      totalProcessed: stats.totalProcessed,
      totalHandoffs:  stats.totalHandoffs,
      totalSent:      stats.totalSent,
      handoffRate:    `${handoffRate}%`,
      activeSessions: getAgentSessions().size,
      pendingHandoffs: getHandoffQueue().size,
      startedAt:      stats.startedAt,
      intentCounts:   stats.intentCounts,
      stageCounts:    stats.stageCounts,
    },
    database: {
      totalMessagesSent:     totalDbOut,
      totalMessagesReceived: totalDbIn,
      uniqueLeadsAttended:   uniqueLeadsResult.length,
    },
  })
}))

// ─── GET /api/agent/lead/:leadId/managed ──────────────────────────────────────

router.get('/lead/:leadId/managed', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const leadId = req.params.leadId as string
  res.json({
    leadId,
    isAgentManaged: isAgentManaged(leadId),
    needsHuman:     getHandoffQueue().has(leadId),
    stage:          getAgentSessions().get(leadId) ?? null,
    handoffInfo:    getHandoffQueue().get(leadId) ?? null,
  })
}))

// ─── POST /api/agent/test (ADMIN) ─────────────────────────────────────────────

router.post('/test', requireAdmin, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { leadId, message } = req.body as { leadId?: string; message?: string }

  if (!leadId || !message) {
    res.status(400).json({ error: 'leadId e message são obrigatórios' })
    return
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) {
    res.status(404).json({ error: 'Lead não encontrado' })
    return
  }

  // Ativa temporariamente se estiver desativado
  const wasEnabled = getAgentEnabled()
  if (!wasEnabled) setAgentEnabled(true)

  try {
    const result = await processMessage(leadId, message)
    res.json({ result })
  } finally {
    if (!wasEnabled) setAgentEnabled(false)
  }
}))

// ─── GET /api/agent/objections ────────────────────────────────────────────────

router.get('/objections', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  res.json({
    total: OBJECTION_LIBRARY.length,
    objections: OBJECTION_LIBRARY.map(({ key, title, triggers, escalate }) => ({
      key, title, triggerCount: triggers.length, escalate: escalate ?? false,
    })),
  })
}))

export default router
