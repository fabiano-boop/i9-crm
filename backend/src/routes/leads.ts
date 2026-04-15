import { Router } from 'express'
import {
  listLeads,
  getLead,
  updateLead,
  deleteLead,
  updateStage,
  listInteractions,
  createInteraction,
  listTrackingEvents,
  rescoreLead,
  bulkScore,
  generateLeadPitch,
  importLeads,
} from '../controllers/leads.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import duplicatesRouter from './duplicates.js'

const router = Router()

router.use(requireAuth)

// Sub-router para duplicatas: GET /api/leads/duplicates, POST /api/leads/duplicates/merge
router.use('/duplicates', duplicatesRouter)

router.post('/bulk-score', asyncHandler(bulkScore))
router.post('/import', asyncHandler(importLeads))

router.get('/', asyncHandler(listLeads))
router.get('/:id', asyncHandler(getLead))
router.put('/:id', asyncHandler(updateLead))
router.delete('/:id', asyncHandler(deleteLead))
router.put('/:id/stage', asyncHandler(updateStage))
router.post('/:id/rescore', asyncHandler(rescoreLead))
router.post('/:id/generate-pitch', asyncHandler(generateLeadPitch))
router.get('/:id/interactions', asyncHandler(listInteractions))
router.post('/:id/interactions', asyncHandler(createInteraction))
router.get('/:id/tracking-events', asyncHandler(listTrackingEvents))

export default router
