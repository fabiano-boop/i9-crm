"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_js_1 = require("../controllers/auth.controller.js");
const auth_js_1 = require("../middleware/auth.js");
const auditLog_middleware_js_1 = require("../middleware/auditLog.middleware.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const router = (0, express_1.Router)();
// Auth básico
router.post('/login', (0, asyncHandler_js_1.asyncHandler)(auth_controller_js_1.login));
router.post('/refresh', (0, asyncHandler_js_1.asyncHandler)(auth_controller_js_1.refresh));
router.post('/logout', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(auth_controller_js_1.logout));
router.get('/me', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(auth_controller_js_1.me));
// 2FA — rotas protegidas por JWT (exceto validate que usa tempToken próprio)
router.post('/2fa/setup', auth_js_1.requireAuth, auditLog_middleware_js_1.auditLogMiddleware, (0, asyncHandler_js_1.asyncHandler)(auth_controller_js_1.setup2FA));
router.post('/2fa/verify', auth_js_1.requireAuth, auditLog_middleware_js_1.auditLogMiddleware, (0, asyncHandler_js_1.asyncHandler)(auth_controller_js_1.verify2FA));
router.post('/2fa/validate', (0, asyncHandler_js_1.asyncHandler)(auth_controller_js_1.validate2FA));
router.post('/2fa/disable', auth_js_1.requireAuth, auditLog_middleware_js_1.auditLogMiddleware, (0, asyncHandler_js_1.asyncHandler)(auth_controller_js_1.disable2FA));
router.get('/2fa/status', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(auth_controller_js_1.get2FAStatus));
exports.default = router;
//# sourceMappingURL=auth.js.map