import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

const router = Router()
router.use(requireAuth)

/**
 * GET /api/whatsapp/status
 * Retorna o estado de conexão da instância WhatsApp.
 * [LEGADO Evolution API removido — substituído pelo Whapi]
 * TODO: implementar status via Whapi quando necessário.
 */
router.get('/status', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  res.json({
    connected: false,
    state: 'NOT_IMPLEMENTED',
    message: 'Status via Whapi ainda não implementado',
  })
}))

// ============================================================
// [LEGADO Evolution API] — bloco removido porque o projeto
// migrou para Whapi. Caso queira reativar, restaurar via git.
// ============================================================

export default router
