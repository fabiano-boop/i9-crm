"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const database_js_1 = require("../config/database.js");
const whatsappAgent_service_js_1 = require("../services/whatsappAgent.service.js");
const objections_js_1 = require("../utils/objections.js");
const logger_js_1 = require("../utils/logger.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.requireAuth);
// ─── GET /api/agent/status ────────────────────────────────────────────────────
router.get('/status', (0, asyncHandler_js_1.asyncHandler)(async (_req, res) => {
    const sessions = (0, whatsappAgent_service_js_1.getAgentSessions)();
    const handoffMap = (0, whatsappAgent_service_js_1.getHandoffQueue)();
    const handoffEntries = await Promise.all(Array.from(handoffMap.entries()).map(async ([leadId, info]) => {
        const lead = await database_js_1.prisma.lead.findUnique({
            where: { id: leadId },
            select: {
                id: true, name: true, businessName: true, neighborhood: true,
                whatsapp: true, phone: true, score: true, classification: true,
            },
        });
        return { leadId, ...info, lead };
    }));
    res.json({
        enabled: (0, whatsappAgent_service_js_1.getAgentEnabled)(),
        activeSessions: sessions.size,
        activeLeadIds: Array.from(sessions.entries()).map(([id, stage]) => ({ id, stage })),
        handoffQueue: handoffEntries.filter((e) => e.lead !== null),
    });
}));
// ─── POST /api/agent/toggle (ADMIN) ───────────────────────────────────────────
router.post('/toggle', auth_js_1.requireAdmin, (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
        res.status(400).json({ error: '"enabled" deve ser true ou false' });
        return;
    }
    (0, whatsappAgent_service_js_1.setAgentEnabled)(enabled);
    logger_js_1.logger.info({ enabled, by: req.user?.email }, 'Agente Maya: toggle');
    res.json({ enabled, message: `Agente Maya ${enabled ? 'ativado' : 'desativado'}` });
}));
// ─── GET /api/agent/conversations ─────────────────────────────────────────────
router.get('/conversations', (0, asyncHandler_js_1.asyncHandler)(async (_req, res) => {
    const sessions = (0, whatsappAgent_service_js_1.getAgentSessions)();
    const leadIds = Array.from(sessions.keys());
    if (leadIds.length === 0) {
        res.json({ conversations: [] });
        return;
    }
    const leads = await database_js_1.prisma.lead.findMany({
        where: { id: { in: leadIds } },
        select: {
            id: true, name: true, businessName: true, neighborhood: true,
            whatsapp: true, phone: true, score: true, classification: true, status: true,
            interactions: {
                orderBy: { createdAt: 'desc' },
                take: 4,
                select: { id: true, content: true, direction: true, createdAt: true, channel: true },
            },
        },
    });
    const conversations = leads.map((lead) => ({
        ...lead,
        agentStage: sessions.get(lead.id),
        needsHandoff: (0, whatsappAgent_service_js_1.getHandoffQueue)().has(lead.id),
    }));
    res.json({ conversations });
}));
// ─── PUT /api/agent/handoff/:leadId/takeover ──────────────────────────────────
router.put('/handoff/:leadId/takeover', (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const leadId = req.params.leadId;
    const lead = await database_js_1.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
        res.status(404).json({ error: 'Lead não encontrado' });
        return;
    }
    (0, whatsappAgent_service_js_1.takeoverFromAgent)(leadId);
    logger_js_1.logger.info({ leadId, by: req.user?.email }, 'Agente: humano assumiu conversa');
    res.json({ success: true, message: `Conversa com ${lead.name} assumida com sucesso` });
}));
// ─── GET /api/agent/analytics ─────────────────────────────────────────────────
router.get('/analytics', (0, asyncHandler_js_1.asyncHandler)(async (_req, res) => {
    const stats = (0, whatsappAgent_service_js_1.getAgentStats)();
    // Interações do agente no banco (canal whatsapp_agent)
    const [totalDbOut, totalDbIn] = await Promise.all([
        database_js_1.prisma.interaction.count({ where: { channel: 'whatsapp_agent', direction: 'OUT' } }),
        database_js_1.prisma.interaction.count({ where: { channel: 'whatsapp_agent', direction: 'IN' } }),
    ]);
    // Leads únicos atendidos pelo agente
    const uniqueLeadsResult = await database_js_1.prisma.interaction.findMany({
        where: { channel: 'whatsapp_agent' },
        distinct: ['leadId'],
        select: { leadId: true },
    });
    const handoffRate = stats.totalProcessed > 0
        ? ((stats.totalHandoffs / stats.totalProcessed) * 100).toFixed(1)
        : '0.0';
    res.json({
        runtime: {
            totalProcessed: stats.totalProcessed,
            totalHandoffs: stats.totalHandoffs,
            totalSent: stats.totalSent,
            handoffRate: `${handoffRate}%`,
            activeSessions: (0, whatsappAgent_service_js_1.getAgentSessions)().size,
            pendingHandoffs: (0, whatsappAgent_service_js_1.getHandoffQueue)().size,
            startedAt: stats.startedAt,
            intentCounts: stats.intentCounts,
            stageCounts: stats.stageCounts,
        },
        database: {
            totalMessagesSent: totalDbOut,
            totalMessagesReceived: totalDbIn,
            uniqueLeadsAttended: uniqueLeadsResult.length,
        },
    });
}));
// ─── GET /api/agent/lead/:leadId/managed ──────────────────────────────────────
router.get('/lead/:leadId/managed', (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const leadId = req.params.leadId;
    res.json({
        leadId,
        isAgentManaged: (0, whatsappAgent_service_js_1.isAgentManaged)(leadId),
        needsHuman: (0, whatsappAgent_service_js_1.getHandoffQueue)().has(leadId),
        stage: (0, whatsappAgent_service_js_1.getAgentSessions)().get(leadId) ?? null,
        handoffInfo: (0, whatsappAgent_service_js_1.getHandoffQueue)().get(leadId) ?? null,
    });
}));
// ─── POST /api/agent/test (ADMIN) ─────────────────────────────────────────────
router.post('/test', auth_js_1.requireAdmin, (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { leadId, message } = req.body;
    if (!leadId || !message) {
        res.status(400).json({ error: 'leadId e message são obrigatórios' });
        return;
    }
    const lead = await database_js_1.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
        res.status(404).json({ error: 'Lead não encontrado' });
        return;
    }
    // Ativa temporariamente se estiver desativado
    const wasEnabled = (0, whatsappAgent_service_js_1.getAgentEnabled)();
    if (!wasEnabled)
        (0, whatsappAgent_service_js_1.setAgentEnabled)(true);
    try {
        const result = await (0, whatsappAgent_service_js_1.processMessage)(leadId, message);
        res.json({ result });
    }
    finally {
        if (!wasEnabled)
            (0, whatsappAgent_service_js_1.setAgentEnabled)(false);
    }
}));
// ─── GET /api/agent/objections ────────────────────────────────────────────────
router.get('/objections', (0, asyncHandler_js_1.asyncHandler)(async (_req, res) => {
    res.json({
        total: objections_js_1.OBJECTION_LIBRARY.length,
        objections: objections_js_1.OBJECTION_LIBRARY.map(({ key, title, triggers, escalate }) => ({
            key, title, triggerCount: triggers.length, escalate: escalate ?? false,
        })),
    });
}));
exports.default = router;
//# sourceMappingURL=agent.js.map