import { Router } from 'express'
import {
  login, refresh, logout, me,
  setup2FA, verify2FA, validate2FA, disable2FA, get2FAStatus,
} from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { auditLogMiddleware } from '../middleware/auditLog.middleware.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

const router = Router()

// Auth básico
router.post('/login', asyncHandler(login))
router.post('/refresh', asyncHandler(refresh))
router.post('/logout', requireAuth, asyncHandler(logout))
router.get('/me', requireAuth, asyncHandler(me))

// 2FA — rotas protegidas por JWT (exceto validate que usa tempToken próprio)
router.post('/2fa/setup',    requireAuth, auditLogMiddleware, asyncHandler(setup2FA))
router.post('/2fa/verify',   requireAuth, auditLogMiddleware, asyncHandler(verify2FA))
router.post('/2fa/validate', asyncHandler(validate2FA))
router.post('/2fa/disable',  requireAuth, auditLogMiddleware, asyncHandler(disable2FA))
router.get('/2fa/status',    requireAuth, asyncHandler(get2FAStatus))

export default router
