"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tracking_controller_js_1 = require("../controllers/tracking.controller.js");
const auth_js_1 = require("../middleware/auth.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const router = (0, express_1.Router)();
// Rotas públicas (acessadas por email clients e browsers)
router.get('/open/:token', (0, asyncHandler_js_1.asyncHandler)(tracking_controller_js_1.trackOpen));
router.get('/click/:campaignLeadId/:hash', (0, asyncHandler_js_1.asyncHandler)(tracking_controller_js_1.trackClick));
// Rota interna autenticada
router.get('/events', auth_js_1.requireAuth, (0, asyncHandler_js_1.asyncHandler)(tracking_controller_js_1.listTrackingEvents));
exports.default = router;
//# sourceMappingURL=tracking.js.map