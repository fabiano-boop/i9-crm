/**
 * Router independente para ações sobre relatórios já existentes.
 * Montado em /api/reports/:id
 *
 * POST /api/reports/:id/send    → enviar por email + WhatsApp
 * GET  /api/reports/:id/pdf     → download do PDF (sem JWT — link do WhatsApp)
 * GET  /api/reports/:id/preview → HTML do relatório no browser
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=reports.d.ts.map