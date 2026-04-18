"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const clients_controller_js_1 = require("../controllers/clients.controller.js");
const router = (0, express_1.Router)();
// ── Métricas gerais (antes de /:id para não conflitar) ────────────────────────
router.get('/metrics/overview', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.getClientsOverview));
router.get('/metrics/mrr-projection', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.getMrrProjection));
// ── CRUD de clientes ──────────────────────────────────────────────────────────
router.get('/', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.listClients));
router.post('/', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.createClient));
router.get('/:id', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.getClient));
router.put('/:id', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.updateClient));
router.patch('/:id/status', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.patchClientStatus));
router.delete('/:id', auth_js_1.requireAdmin, (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.deleteClient));
// ── Relatórios nested ─────────────────────────────────────────────────────────
router.get('/:id/reports', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.listClientReports));
router.post('/:id/reports/generate', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.generateClientReport));
// PDF sem JWT — link enviado no WhatsApp para o cliente final ver o relatório
router.get('/:id/reports/:rid/pdf', (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.downloadNestedReportPdf));
exports.default = router;
//# sourceMappingURL=clients.js.map