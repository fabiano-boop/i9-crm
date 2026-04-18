/**
 * Router independente para ações sobre relatórios já existentes.
 * Montado em /api/reports/:id
 *
 * POST /api/reports/:id/send    → enviar por email + WhatsApp
 * GET  /api/reports/:id/pdf     → download do PDF (sem JWT — link do WhatsApp)
 * GET  /api/reports/:id/preview → HTML do relatório no browser
 */

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import {
  sendStandaloneReport,
  previewReport,
  downloadReportPdf,
} from '../controllers/clients.controller.js'

const router = Router()

// Enviar relatório — requer autenticação
router.post('/:id/send', requireAuth, asyncHandler(sendStandaloneReport))

// Preview HTML — requer autenticação
router.get('/:id/preview', requireAuth, asyncHandler(previewReport))

// Download PDF — sem JWT (link enviado no WhatsApp para o cliente final)
router.get('/:id/pdf', asyncHandler(downloadReportPdf))

export default router
