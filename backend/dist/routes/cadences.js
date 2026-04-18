"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const database_js_1 = require("../config/database.js");
const cadenceService = __importStar(require("../services/cadence.service.js"));
const router = (0, express_1.Router)();
router.use(auth_js_1.requireAuth);
// ── Sequências ──────────────────────────────────────────────────
// GET /api/cadences/sequences
router.get('/sequences', (0, asyncHandler_js_1.asyncHandler)(async (_req, res) => {
    const sequences = await database_js_1.prisma.followUpSequence.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
    });
    res.json(sequences);
}));
// POST /api/cadences/sequences
router.post('/sequences', (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { name, description, steps } = req.body;
    const sequence = await database_js_1.prisma.followUpSequence.create({
        data: { name, description, steps },
    });
    res.status(201).json(sequence);
}));
// PUT /api/cadences/sequences/:id
router.put('/sequences/:id', (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { name, description, steps, isActive } = req.body;
    const sequence = await database_js_1.prisma.followUpSequence.update({
        where: { id: req.params['id'] },
        data: { name, description, steps, isActive },
    });
    res.json(sequence);
}));
// DELETE /api/cadences/sequences/:id — desativa (soft delete)
router.delete('/sequences/:id', (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    await database_js_1.prisma.followUpSequence.update({
        where: { id: req.params['id'] },
        data: { isActive: false },
    });
    res.json({ message: 'Sequência desativada' });
}));
// ── Cadências por lead ───────────────────────────────────────────
// GET /api/cadences/leads/:leadId
router.get('/leads/:leadId', (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const cadences = await database_js_1.prisma.leadCadence.findMany({
        where: { leadId: req.params['leadId'] },
        include: { sequence: true },
        orderBy: { startedAt: 'desc' },
    });
    res.json(cadences);
}));
// POST /api/cadences/leads/:leadId
router.post('/leads/:leadId', (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { sequenceId } = req.body;
    const cadence = await cadenceService.startCadence(req.params['leadId'], sequenceId);
    res.status(201).json(cadence);
}));
// PUT /api/cadences/leads/:leadId/:cid/pause
router.put('/leads/:leadId/:cid/pause', (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { reason = 'manual' } = req.body;
    const cadence = await cadenceService.pauseCadence(req.params['cid'], reason);
    res.json(cadence);
}));
// PUT /api/cadences/leads/:leadId/:cid/resume
router.put('/leads/:leadId/:cid/resume', (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const cadence = await cadenceService.resumeCadence(req.params['cid']);
    res.json(cadence);
}));
// DELETE /api/cadences/leads/:leadId/:cid
router.delete('/leads/:leadId/:cid', (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const cadence = await cadenceService.cancelCadence(req.params['cid']);
    res.json(cadence);
}));
exports.default = router;
//# sourceMappingURL=cadences.js.map