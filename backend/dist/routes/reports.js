"use strict";
/**
 * Router independente para ações sobre relatórios já existentes.
 * Montado em /api/reports/:id
 *
 * POST /api/reports/:id/send    → enviar por email + WhatsApp
 * GET  /api/reports/:id/pdf     → download do PDF (sem JWT — link do WhatsApp)
 * GET  /api/reports/:id/preview → HTML do relatório no browser
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const clients_controller_js_1 = require("../controllers/clients.controller.js");
const router = (0, express_1.Router)();
// Enviar relatório — requer autenticação
router.post('/:id/send', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.sendStandaloneReport));
// Preview HTML — requer autenticação
router.get('/:id/preview', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.previewReport));
// Download PDF — sem JWT (link enviado no WhatsApp para o cliente final)
router.get('/:id/pdf', (0, asyncHandler_js_1.asyncHandler)(clients_controller_js_1.downloadReportPdf));
exports.default = router;
//# sourceMappingURL=reports.js.map