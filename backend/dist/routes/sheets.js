"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sheets_controller_js_1 = require("../controllers/sheets.controller.js");
const auth_js_1 = require("../middleware/auth.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.requireAuth);
router.post('/sync', auth_js_1.requireAdmin, (0, asyncHandler_js_1.asyncHandler)(sheets_controller_js_1.triggerSync));
router.get('/sync-history', (0, asyncHandler_js_1.asyncHandler)(sheets_controller_js_1.getSyncHistory));
router.get('/queue-status', (0, asyncHandler_js_1.asyncHandler)(sheets_controller_js_1.getQueueStatus));
exports.default = router;
//# sourceMappingURL=sheets.js.map