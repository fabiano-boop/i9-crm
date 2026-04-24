import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { prisma } from '../config/database.js'

const router = Router()
router.use(requireAuth)

/**
 * GET /api/settings
 * Retorna configurações do usuário logado (inclui monthlyMrrGoal).
 */
router.get('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.sub
  if (!userId) { res.status(401).json({ error: 'Não autenticado' }); return }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, monthlyMrrGoal: true },
  })

  res.json(user)
}))

/**
 * PUT /api/settings/mrr-goal
 * Atualiza a meta mensal de MRR do usuário logado.
 * Body: { goal: number }
 */
router.put('/mrr-goal', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.sub
  if (!userId) { res.status(401).json({ error: 'Não autenticado' }); return }

  const { goal } = req.body as { goal: unknown }
  if (typeof goal !== 'number' || goal < 0) {
    res.status(400).json({ error: 'Meta inválida — envie um número >= 0' })
    return
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { monthlyMrrGoal: goal },
    select: { id: true, monthlyMrrGoal: true },
  })

  res.json(user)
}))

export default router
