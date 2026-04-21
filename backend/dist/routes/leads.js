"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leads_controller_js_1 = require("../controllers/leads.controller.js");
const auth_js_1 = require("../middleware/auth.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const duplicates_js_1 = __importDefault(require("./duplicates.js"));
const router = (0, express_1.Router)();
router.use(auth_js_1.requireAuth);
// Sub-router para duplicatas
router.use('/duplicates', duplicates_js_1.default);
router.post('/bulk-score', (0, asyncHandler_js_1.asyncHandler)(leads_controller_js_1.bulkScore));
router.post('/import', (0, asyncHandler_js_1.asyncHandler)(leads_controller_js_1.importLeads));
router.get('/', (0, asyncHandler_js_1.asyncHandler)(leads_controller_js_1.listLeads));
router.get('/:id', (0, asyncHandler_js_1.asyncHandler)(leads_controller_js_1.getLead));
router.put('/:id', (0, asyncHandler_js_1.asyncHandler)(leads_controller_js_1.updateLead));
router.delete('/:id', (0, asyncHandler_js_1.asyncHandler)(leads_controller_js_1.deleteLead));
router.put('/:id/stage', (0, asyncHandler_js_1.asyncHandler)(leads_controller_js_1.updateStage));
router.post('/:id/rescore', (0, asyncHandler_js_1.asyncHandler)(leads_controller_js_1.rescoreLead));
router.post('/:id/generate-pitch', (0, asyncHandler_js_1.asyncHandler)(leads_controller_js_1.generateLeadPitch));
router.post('/:id/convert', (0, asyncHandler_js_1.asyncHandler)(leads_controller_js_1.convertLead)); // ← NOVO
router.get('/:id/interactions', (0, asyncHandler_js_1.asyncHandler)(leads_controller_js_1.listInteractions));
router.post('/:id/interactions', (0, asyncHandler_js_1.asyncHandler)(leads_controller_js_1.createInteraction));
router.get('/:id/tracking-events', (0, asyncHandler_js_1.asyncHandler)(leads_controller_js_1.listTrackingEvents));
exports.default = router;
//# sourceMappingURL=leads.js.map