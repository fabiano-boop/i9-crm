import { Router } from 'express'
import { triggerSync, getSyncHistory, getQueueStatus } from '../controllers/sheets.controller.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

const router = Router()

router.use(requireAuth)

router.post('/sync', requireAdmin, asyncHandler(triggerSync))
router.get('/sync-history', asyncHandler(getSyncHistory))
router.get('/queue-status', asyncHandler(getQueueStatus))

export default router
