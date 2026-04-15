import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { prisma } from '../config/database.js'
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination.js'

const router = Router()
router.use(requireAuth)

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
