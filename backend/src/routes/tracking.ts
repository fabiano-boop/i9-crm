import { Router } from 'express'
import { trackOpen, trackClick, listTrackingEvents } from '../controllers/tracking.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

const router = Router()

// Rotas públicas (acessadas por email clients e browsers)
router.get('/open/:token', asyncHandler(trackOpen))
router.get('/click/:campaignLeadId/:hash', asyncHandler(trackClick))

// Rota interna autenticada
router.get('/events', requireAuth, asyncHandler(listTrackingEvents))

export default router
