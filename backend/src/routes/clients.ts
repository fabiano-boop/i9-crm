/**
 * Router de clientes ativos e seus relatórios semanais.
 *
 * CLIENTES
 *   GET    /api/clients                       → listar (filtros: status, niche, neighborhood, package)
 *   GET    /api/clients/metrics/overview      → KPIs gerais (MRR, churn, etc.)
 *   GET    /api/clients/metrics/mrr-projection → projeção de MRR 6 meses
 *   GET    /api/clients/:id                   → detalhes + métricas acumuladas
 *   POST   /api/clients                       → criar (Zod validation)
 *   PUT    /api/clients/:id                   → atualizar campos
 *   PATCH  /api/clients/:id/status            → mudar status + registrar cancelamento
 *   DELETE /api/clients/:id                   → soft delete (marca como cancelled)
 *
 * RELATÓRIOS (nested)
 *   GET    /api/clients/:id/reports           → listar relatórios do cliente
 *   POST   /api/clients/:id/reports/generate  → gerar relatório (enfileira com prio máxima)
 *   GET    /api/clients/:id/reports/:rid/pdf  → PDF ou HTML do relatório
 */

import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  patchClientStatus,
  deleteClient,
  listClientReports,
  generateClientReport,
  getClientsOverview,
  getMrrProjection,
  downloadNestedReportPdf,
} from '../controllers/clients.controller.js'

const router = Router()

// ── Métricas gerais (antes de /:id para não conflitar) ────────────────────────
router.get('/metrics/overview', requireAuth, asyncHandler(getClientsOverview))
router.get('/metrics/mrr-projection', requireAuth, asyncHandler(getMrrProjection))

// ── CRUD de clientes ──────────────────────────────────────────────────────────
router.get('/', requireAuth, asyncHandler(listClients))
router.post('/', requireAuth, asyncHandler(createClient))
router.get('/:id', requireAuth, asyncHandler(getClient))
router.put('/:id', requireAuth, asyncHandler(updateClient))
router.patch('/:id/status', requireAuth, asyncHandler(patchClientStatus))
router.delete('/:id', requireAdmin, asyncHandler(deleteClient))

// ── Relatórios nested ─────────────────────────────────────────────────────────
router.get('/:id/reports', requireAuth, asyncHandler(listClientReports))
router.post('/:id/reports/generate', requireAuth, asyncHandler(generateClientReport))

// PDF sem JWT — link enviado no WhatsApp para o cliente final ver o relatório
router.get('/:id/reports/:rid/pdf', asyncHandler(downloadNestedReportPdf))

export default router
