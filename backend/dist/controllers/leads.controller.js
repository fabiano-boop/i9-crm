"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importLeads = importLeads;
exports.listLeads = listLeads;
exports.getLead = getLead;
exports.updateLead = updateLead;
exports.deleteLead = deleteLead;
exports.updateStage = updateStage;
exports.listInteractions = listInteractions;
exports.createInteraction = createInteraction;
exports.listTrackingEvents = listTrackingEvents;
exports.rescoreLead = rescoreLead;
exports.bulkScore = bulkScore;
exports.generateLeadPitch = generateLeadPitch;
exports.convertLead = convertLead;
const zod_1 = require("zod");
const database_js_1 = require("../config/database.js");
const pagination_js_1 = require("../utils/pagination.js");
const scoring_service_js_1 = require("../services/scoring.service.js");
const claude_service_js_1 = require("../services/claude.service.js");
const cadence_service_js_1 = require("../services/cadence.service.js");
const logger_js_1 = require("../utils/logger.js");
// Schema de importação em bulk (aceita classification + score + whatsappAngle)
const importLeadSchema = zod_1.z.object({
    externalId: zod_1.z.string().optional(),
    name: zod_1.z.string().min(1),
    businessName: zod_1.z.string().min(1),
    niche: zod_1.z.string().min(1),
    neighborhood: zod_1.z.string().min(1),
    address: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    whatsapp: zod_1.z.string().optional(),
    email: zod_1.z.string().optional(),
    website: zod_1.z.string().optional(),
    instagram: zod_1.z.string().optional(),
    googleRating: zod_1.z.coerce.number().optional(),
    reviewCount: zod_1.z.coerce.number().int().optional(),
    digitalLevel: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    painPoints: zod_1.z.string().optional(),
    idealService: zod_1.z.string().optional(),
    upsellService: zod_1.z.string().optional(),
    urgency: zod_1.z.coerce.number().int().min(1).max(10).optional(),
    revenuePotential: zod_1.z.string().optional(),
    closingEase: zod_1.z.string().optional(),
    score: zod_1.z.coerce.number().int().min(0).max(100).optional(),
    classification: zod_1.z.enum(['HOT', 'WARM', 'COLD']).optional(),
    whatsappAngle: zod_1.z.string().optional(),
    status: zod_1.z.enum(['NEW', 'CONTACTED', 'REPLIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED', 'LOST']).optional(),
    notes: zod_1.z.string().optional(),
});
// POST /api/leads/import — importação bulk sem depender de Google Sheets API
async function importLeads(req, res) {
    const body = req.body;
    if (!Array.isArray(body.leads) || body.leads.length === 0) {
        res.status(400).json({ error: 'leads[] obrigatório', code: 'VALIDATION_ERROR' });
        return;
    }
    let imported = 0, updated = 0, errors = [];
    for (const raw of body.leads) {
        const result = importLeadSchema.safeParse(raw);
        if (!result.success) {
            errors.push(JSON.stringify(result.error.flatten().fieldErrors));
            continue;
        }
        const d = result.data;
        try {
            const existing = d.externalId
                ? await database_js_1.prisma.lead.findUnique({ where: { externalId: d.externalId } })
                : null;
            if (existing) {
                await database_js_1.prisma.lead.update({ where: { id: existing.id }, data: d });
                updated++;
            }
            else {
                await database_js_1.prisma.lead.create({ data: { ...d, importedAt: new Date() } });
                imported++;
            }
        }
        catch (e) {
            errors.push(d.name + ': ' + (e instanceof Error ? e.message : String(e)));
        }
    }
    res.json({ imported, updated, errors, total: imported + updated });
}
// Validação para criação/atualização de lead
const leadSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    businessName: zod_1.z.string().min(1),
    niche: zod_1.z.string().min(1),
    neighborhood: zod_1.z.string().min(1),
    address: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    whatsapp: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    website: zod_1.z.string().optional(),
    instagram: zod_1.z.string().optional(),
    googleRating: zod_1.z.coerce.number().min(0).max(5).optional(),
    reviewCount: zod_1.z.coerce.number().int().min(0).optional(),
    digitalLevel: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    painPoints: zod_1.z.string().optional(),
    idealService: zod_1.z.string().optional(),
    upsellService: zod_1.z.string().optional(),
    urgency: zod_1.z.coerce.number().int().min(1).max(10).optional(),
    revenuePotential: zod_1.z.string().optional(),
    closingEase: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    status: zod_1.z.enum(['NEW', 'CONTACTED', 'REPLIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED', 'LOST']).optional(),
    pipelineStage: zod_1.z.string().optional(),
    assignedToId: zod_1.z.string().optional(),
});
// GET /api/leads
async function listLeads(req, res) {
    const { page, limit } = (0, pagination_js_1.getPaginationParams)(req.query);
    const { status, classification, neighborhood, search, stage, assignedToId } = req.query;
    const where = {};
    if (status)
        where.status = status;
    if (classification)
        where.classification = classification;
    if (neighborhood)
        where.neighborhood = { contains: neighborhood, mode: 'insensitive' };
    if (stage)
        where.pipelineStage = stage;
    if (assignedToId)
        where.assignedToId = assignedToId;
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { businessName: { contains: search, mode: 'insensitive' } },
            { niche: { contains: search, mode: 'insensitive' } },
            { neighborhood: { contains: search, mode: 'insensitive' } },
        ];
    }
    const [data, total] = await Promise.all([
        database_js_1.prisma.lead.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: [{ score: 'desc' }, { importedAt: 'desc' }],
            include: { assignedTo: { select: { id: true, name: true, email: true } } },
        }),
        database_js_1.prisma.lead.count({ where }),
    ]);
    res.json((0, pagination_js_1.buildPaginatedResult)(data, total, { page, limit }));
}
// GET /api/leads/:id
async function getLead(req, res) {
    const lead = await database_js_1.prisma.lead.findUnique({
        where: { id: req.params['id'] },
        include: {
            assignedTo: { select: { id: true, name: true, email: true } },
            interactions: { orderBy: { createdAt: 'desc' }, take: 20 },
            campaignLeads: { include: { campaign: { select: { id: true, name: true, type: true, status: true } } } },
            trackingEvents: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
    });
    if (!lead) {
        res.status(404).json({ error: 'Lead não encontrado', code: 'NOT_FOUND' });
        return;
    }
    res.json(lead);
}
// PUT /api/leads/:id
async function updateLead(req, res) {
    const result = leadSchema.partial().safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: result.error.flatten() });
        return;
    }
    const existing = await database_js_1.prisma.lead.findUnique({ where: { id: req.params['id'] } });
    if (!existing) {
        res.status(404).json({ error: 'Lead não encontrado', code: 'NOT_FOUND' });
        return;
    }
    const lead = await database_js_1.prisma.lead.update({
        where: { id: req.params['id'] },
        data: {
            ...result.data,
            ...(result.data.status === 'CONTACTED' && !existing.lastContactAt
                ? { lastContactAt: new Date() }
                : {}),
        },
        include: { assignedTo: { select: { id: true, name: true, email: true } } },
    });
    res.json(lead);
}
// DELETE /api/leads/:id
async function deleteLead(req, res) {
    const existing = await database_js_1.prisma.lead.findUnique({ where: { id: req.params['id'] } });
    if (!existing) {
        res.status(404).json({ error: 'Lead não encontrado', code: 'NOT_FOUND' });
        return;
    }
    await database_js_1.prisma.lead.delete({ where: { id: req.params['id'] } });
    res.status(204).send();
}
// PUT /api/leads/:id/stage
async function updateStage(req, res) {
    const { stage } = req.body;
    if (!stage) {
        res.status(400).json({ error: 'stage obrigatório', code: 'VALIDATION_ERROR' });
        return;
    }
    const lead = await database_js_1.prisma.lead.update({
        where: { id: req.params['id'] },
        data: { pipelineStage: stage },
    });
    res.json(lead);
}
// GET /api/leads/:id/interactions
async function listInteractions(req, res) {
    const { page, limit } = (0, pagination_js_1.getPaginationParams)(req.query);
    const [data, total] = await Promise.all([
        database_js_1.prisma.interaction.findMany({
            where: { leadId: req.params['id'] },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        database_js_1.prisma.interaction.count({ where: { leadId: req.params['id'] } }),
    ]);
    res.json((0, pagination_js_1.buildPaginatedResult)(data, total, { page, limit }));
}
const interactionSchema = zod_1.z.object({
    type: zod_1.z.enum(['WHATSAPP', 'EMAIL', 'CALL', 'NOTE']),
    channel: zod_1.z.string().min(1),
    content: zod_1.z.string().min(1),
    direction: zod_1.z.enum(['IN', 'OUT']).default('OUT'),
});
// POST /api/leads/:id/interactions
async function createInteraction(req, res) {
    const result = interactionSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: result.error.flatten() });
        return;
    }
    const lead = await database_js_1.prisma.lead.findUnique({ where: { id: req.params['id'] } });
    if (!lead) {
        res.status(404).json({ error: 'Lead não encontrado', code: 'NOT_FOUND' });
        return;
    }
    const leadId = req.params['id'];
    const [interaction] = await Promise.all([
        database_js_1.prisma.interaction.create({
            data: { leadId, ...result.data },
        }),
        database_js_1.prisma.lead.update({
            where: { id: leadId },
            data: { lastContactAt: new Date() },
        }),
    ]);
    if (result.data.direction === 'IN') {
        (0, cadence_service_js_1.pauseActiveCadencesForLead)(leadId, 'lead_replied').catch(() => null);
    }
    res.status(201).json(interaction);
}
// GET /api/leads/:id/tracking-events
async function listTrackingEvents(req, res) {
    const events = await database_js_1.prisma.trackingEvent.findMany({
        where: { leadId: req.params['id'] },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    res.json(events);
}
// POST /api/leads/:id/rescore
async function rescoreLead(req, res) {
    if (!process.env['ANTHROPIC_API_KEY']) {
        res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurado', code: 'AI_NOT_CONFIGURED' });
        return;
    }
    try {
        const result = await (0, scoring_service_js_1.scoreLead)(req.params['id']);
        res.json(result);
    }
    catch (err) {
        const e = err;
        if (e?.status === 401) {
            res.status(503).json({ error: 'ANTHROPIC_API_KEY inválida — atualize no Railway', code: 'AI_AUTH_ERROR' });
            return;
        }
        if (e?.status === 429) {
            res.status(503).json({ error: 'Rate limit da API Anthropic atingido', code: 'AI_RATE_LIMIT' });
            return;
        }
        throw err;
    }
}
// POST /api/leads/bulk-score
async function bulkScore(req, res) {
    if (!process.env['ANTHROPIC_API_KEY']) {
        res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurado', code: 'AI_NOT_CONFIGURED' });
        return;
    }
    const { leadIds } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
        res.status(400).json({ error: 'leadIds obrigatório (array)', code: 'VALIDATION_ERROR' });
        return;
    }
    const results = await (0, scoring_service_js_1.bulkScoreLeads)(leadIds);
    res.json({ results, processed: results.length });
}
// POST /api/leads/:id/generate-pitch
async function generateLeadPitch(req, res) {
    if (!process.env['ANTHROPIC_API_KEY']) {
        res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurado', code: 'AI_NOT_CONFIGURED' });
        return;
    }
    const lead = await database_js_1.prisma.lead.findUnique({ where: { id: req.params['id'] } });
    if (!lead) {
        res.status(404).json({ error: 'Lead não encontrado', code: 'NOT_FOUND' });
        return;
    }
    const pitch = await (0, claude_service_js_1.generatePitch)(lead);
    res.json(pitch);
}
// POST /api/leads/:id/convert
async function convertLead(req, res) {
    const leadId = req.params['id'];
    const lead = await database_js_1.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
        res.status(404).json({ error: 'Lead não encontrado', code: 'NOT_FOUND' });
        return;
    }
    if (lead.status === 'CLOSED') {
        res.status(409).json({ error: 'Lead já foi convertido em cliente', code: 'ALREADY_CONVERTED' });
        return;
    }
    const existing = await database_js_1.prisma.client.findFirst({ where: { leadId } });
    if (existing) {
        res.status(409).json({
            error: 'Já existe um cliente vinculado a este lead',
            code: 'ALREADY_CONVERTED',
            clientId: existing.id,
        });
        return;
    }
    const client = await database_js_1.prisma.client.create({
        data: {
            businessName: lead.businessName,
            ownerName: lead.name,
            email: lead.email ?? undefined,
            whatsapp: lead.whatsapp ?? undefined,
            address: lead.address ?? undefined,
            neighborhood: lead.neighborhood ?? undefined,
            niche: lead.niche ?? undefined,
            origin: 'lead',
            leadId: lead.id,
            notes: lead.notes ?? undefined,
        },
    });
    await database_js_1.prisma.lead.update({
        where: { id: leadId },
        data: {
            status: 'CLOSED',
            pipelineStage: 'closed',
        },
    });
    logger_js_1.logger.info({ leadId, clientId: client.id }, 'Lead convertido em cliente');
    res.status(201).json({ client, leadId });
}
//# sourceMappingURL=leads.controller.js.map