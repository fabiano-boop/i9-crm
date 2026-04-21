"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.requireAuth);
/**
 * GET /api/whatsapp/status
 * Retorna o estado de conexão da instância WhatsApp.
 * [LEGADO Evolution API removido — substituído pelo Whapi]
 * TODO: implementar status via Whapi quando necessário.
 */
router.get('/status', (0, asyncHandler_js_1.asyncHandler)(async (_req, res) => {
    res.json({
        connected: false,
        state: 'NOT_IMPLEMENTED',
        message: 'Status via Whapi ainda não implementado',
    });
}));
// ============================================================
// [LEGADO Evolution API] — bloco removido porque o projeto
// migrou para Whapi. Caso queira reativar, restaurar via git.
// ============================================================
exports.default = router;
//# sourceMappingURL=whatsapp.js.map