import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { prisma } from '../config/database.js'
import * as cadenceService from '../services/cadence.service.js'

const router = Router()
router.use(requireAuth)

// ── Sequências ──────────────────────────────────────────────────

// GET /api/cadences/sequences
router.get('/sequences', asyncHandler(async (_req, res) => {
  const sequences = await prisma.followUpSequence.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  res.json(sequences)
}))

// POST /api/cadences/sequences
router.post('/sequences', asyncHandler(async (req, res) => {
  const { name, description, steps } = req.body as {
    name: string
    description?: string
    steps: object[]
  }
  const sequence = await prisma.followUpSequence.create({
    data: { name, description, steps },
  })
  res.status(201).json(sequence)
}))

// PUT /api/cadences/sequences/:id
router.put('/sequences/:id', asyncHandler(async (req, res) => {
  const { name, description, steps, isActive } = req.body as {
    name?: string
    description?: string
    steps?: object[]
    isActive?: boolean
  }
  const sequence = await prisma.followUpSequence.update({
    where: { id: req.params['id'] as string },
    data: { name, description, steps, isActive },
  })
  res.json(sequence)
}))

// DELETE /api/cadences/sequences/:id — desativa (soft delete)
router.delete('/sequences/:id', asyncHandler(async (req, res) => {
  await prisma.followUpSequence.update({
    where: { id: req.params['id'] as string },
    data: { isActive: false },
  })
  res.json({ message: 'Sequência desativada' })
}))

// ── Cadências por lead ───────────────────────────────────────────

// GET /api/cadences/leads/:leadId
router.get('/leads/:leadId', asyncHandler(async (req, res) => {
  const cadences = await prisma.leadCadence.findMany({
    where: { leadId: req.params['leadId'] as string },
    include: { sequence: true },
    orderBy: { startedAt: 'desc' },
  })
  res.json(cadences)
}))

// POST /api/cadences/leads/:leadId
router.post('/leads/:leadId', asyncHandler(async (req, res) => {
  const { sequenceId } = req.body as { sequenceId: string }
  const cadence = await cadenceService.startCadence(req.params['leadId'] as string, sequenceId)
  res.status(201).json(cadence)
}))

// PUT /api/cadences/leads/:leadId/:cid/pause
router.put('/leads/:leadId/:cid/pause', asyncHandler(async (req, res) => {
  const { reason = 'manual' } = req.body as { reason?: string }
  const cadence = await cadenceService.pauseCadence(req.params['cid'] as string, reason)
  res.json(cadence)
}))

// PUT /api/cadences/leads/:leadId/:cid/resume
router.put('/leads/:leadId/:cid/resume', asyncHandler(async (req, res) => {
  const cadence = await cadenceService.resumeCadence(req.params['cid'] as string)
  res.json(cadence)
}))

// DELETE /api/cadences/leads/:leadId/:cid
router.delete('/leads/:leadId/:cid', asyncHandler(async (req, res) => {
  const cadence = await cadenceService.cancelCadence(req.params['cid'] as string)
  res.json(cadence)
}))

export default router
