import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../config/database.js'
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination.js'

const router = Router()
router.use(requireAuth)

/**
 * GET /api/alerts/smart
 * SPRINT 3.4: Alertas inteligentes gerados dinamicamente — sem persistência.
 * Tipos: DEAL_STALLED | OVERDUE_INVOICE | HOT_LEAD_IDLE
 */
router.get('/smart', async (_req: Request, res: Response): Promise<void> => {
  const now = new Date()
  const sevenDaysAgo      = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  const fortyEightHrsAgo  = new Date(now.getTime() - 48 * 60 * 60 * 1000)
  const fiveDaysAgo       = new Date(now.getTime() - 5  * 24 * 60 * 60 * 1000)

  type AlertSeverity = 'high' | 'medium'
  type AlertType = 'DEAL_STALLED' | 'OVERDUE_INVOICE' | 'HOT_LEAD_IDLE'
  interface SmartAlert {
    type: AlertType; severity: AlertSeverity; entityId: string; entityName: string
    message: string; daysSince: number; actionUrl: string
  }
  const alerts: SmartAlert[] = []

  // ── DEAL_STALLED ──────────────────────────────────────────────────────────
  const stalledLeads = await prisma.lead.findMany({
    where: {
      pipelineStage: { in: ['contacted', 'replied', 'proposal', 'negotiation'] },
      updatedAt: { lt: sevenDaysAgo },
    },
    select: { id: true, businessName: true, updatedAt: true, pipelineStage: true },
    take: 10,
    orderBy: { updatedAt: 'asc' },
  })

  for (const lead of stalledLeads) {
    const days = Math.floor((now.getTime() - lead.updatedAt.getTime()) / 86_400_000)
    alerts.push({
      type: 'DEAL_STALLED',
      severity: days > 14 ? 'high' : 'medium',
      entityId: lead.id,
      entityName: lead.businessName,
      message: `Negociação parada há ${days} dias (etapa: ${lead.pipelineStage})`,
      daysSince: days,
      actionUrl: `/leads/${lead.id}`,
    })
  }

  // ── OVERDUE_INVOICE ───────────────────────────────────────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overdueInvoices = await (prisma as any).invoice.findMany({
      where: { status: { not: 'PAID' }, dueDate: { lt: fiveDaysAgo } },
      select: { id: true, dueDate: true, client: { select: { id: true, businessName: true } } },
      take: 10,
      orderBy: { dueDate: 'asc' },
    }) as Array<{ id: string; dueDate: Date; client: { id: string; businessName: string } }>

    for (const inv of overdueInvoices) {
      const days = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86_400_000)
      alerts.push({
        type: 'OVERDUE_INVOICE',
        severity: days > 15 ? 'high' : 'medium',
        entityId: inv.client.id,
        entityName: inv.client.businessName,
        message: `Fatura em atraso há ${days} dias`,
        daysSince: days,
        actionUrl: `/clients/${inv.client.id}`,
      })
    }
  } catch { /* Invoice model ainda não migrado */ }

  // ── HOT_LEAD_IDLE ─────────────────────────────────────────────────────────
  const hotLeads = await prisma.lead.findMany({
    where: { classification: 'HOT' },
    select: {
      id: true,
      businessName: true,
      interactions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
    take: 20,
  })

  for (const lead of hotLeads) {
    const lastAt = lead.interactions[0]?.createdAt
    if (!lastAt || lastAt < fortyEightHrsAgo) {
      const hours = lastAt ? Math.floor((now.getTime() - lastAt.getTime()) / 3_600_000) : null
      alerts.push({
        type: 'HOT_LEAD_IDLE',
        severity: 'high',
        entityId: lead.id,
        entityName: lead.businessName,
        message: hours ? `Lead HOT sem contato há ${hours}h` : 'Lead HOT sem nenhuma interação',
        daysSince: hours ? Math.floor(hours / 24) : 0,
        actionUrl: `/leads/${lead.id}`,
      })
    }
  }

  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1
    return b.daysSince - a.daysSince
  })

  res.json(alerts)
})

// GET /api/alerts — lista alertas com filtros
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { isRead, isDismissed, type } = req.query as Record<string, string>
  const { page, limit } = getPaginationParams(req.query as Record<string, unknown>)

  const where = {
    ...(isRead      !== undefined && { isRead:      isRead === 'true' }),
    ...(isDismissed !== undefined && { isDismissed: isDismissed === 'true' }),
    ...(type && { type }),
  }

  const skip = (page - 1) * limit

  const [total, alerts] = await Promise.all([
    prisma.opportunityAlert.count({ where }),
    prisma.opportunityAlert.findMany({
      where,
      orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      include: {
        lead: { select: { id: true, businessName: true, classification: true, whatsapp: true } },
      },
    }),
  ])

  res.json(buildPaginatedResult(alerts, total, { page, limit }))
})

// GET /api/alerts/unread-count — contagem de não lidos
router.get('/unread-count', async (_req: Request, res: Response): Promise<void> => {
  const count = await prisma.opportunityAlert.count({
    where: { isRead: false, isDismissed: false },
  })
  res.json({ count })
})

// PUT /api/alerts/:id/read — marcar como lido
router.put('/:id/read', async (req: Request, res: Response): Promise<void> => {
  const id = req.params['id'] as string
  const alert = await prisma.opportunityAlert.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  })
  res.json(alert)
})

// PUT /api/alerts/:id/dismiss — dispensar alerta
router.put('/:id/dismiss', async (req: Request, res: Response): Promise<void> => {
  const id = req.params['id'] as string
  const alert = await prisma.opportunityAlert.update({
    where: { id },
    data: { isDismissed: true },
  })
  res.json(alert)
})

export default router
