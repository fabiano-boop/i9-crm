import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { findDuplicates, mergeLead } from '../services/duplicate.service.js'
import { z } from 'zod'

const router = Router()
router.use(requireAuth)

// GET /api/leads/duplicates
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const groups = await findDuplicates()
  res.json({ groups, total: groups.length })
})

// POST /api/leads/duplicates/merge
router.post('/merge', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    keepId:   z.string().cuid(),
    mergeIds: z.array(z.string().cuid()).min(1),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'keepId e mergeIds[] são obrigatórios', details: parsed.error.flatten() })
    return
  }

  const { keepId, mergeIds } = parsed.data

  if (mergeIds.includes(keepId)) {
    res.status(400).json({ error: 'keepId não pode estar em mergeIds' })
    return
  }

  try {
    const lead = await mergeLead(keepId, mergeIds)
    res.json({ lead, merged: mergeIds.length })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao realizar merge' })
  }
})

export default router
