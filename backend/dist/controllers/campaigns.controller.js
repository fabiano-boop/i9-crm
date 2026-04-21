"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCampaigns = listCampaigns;
exports.getCampaign = getCampaign;
exports.createCampaign = createCampaign;
exports.updateCampaign = updateCampaign;
exports.deleteCampaign = deleteCampaign;
exports.addLeadsToCampaign = addLeadsToCampaign;
exports.removeLeadFromCampaign = removeLeadFromCampaign;
exports.getCampaignStats = getCampaignStats;
exports.sendCampaign = sendCampaign;
exports.pauseCampaign = pauseCampaign;
exports.getEngagedLeads = getEngagedLeads;
const zod_1 = require("zod");
const database_js_1 = require("../config/database.js");
const pagination_js_1 = require("../utils/pagination.js");
const logger_js_1 = require("../utils/logger.js");
const campaignSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    type: zod_1.z.enum(['WHATSAPP', 'EMAIL', 'BOTH']),
    subject: zod_1.z.string().optional(),
    bodyText: zod_1.z.string().min(1),
    bodyHtml: zod_1.z.string().optional(),
    scheduledAt: zod_1.z.string().datetime().optional(),
});
// GET /api/campaigns
async function listCampaigns(req, res) {
    const { page, limit } = (0, pagination_js_1.getPaginationParams)(req.query);
    const [data, total] = await Promise.all([
        database_js_1.prisma.campaign.findMany({
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                createdBy: { select: { id: true, name: true } },
                _count: { select: { campaignLeads: true } },
            },
        }),
        database_js_1.prisma.campaign.count(),
    ]);
    res.json((0, pagination_js_1.buildPaginatedResult)(data, total, { page, limit }));
}
// GET /api/campaigns/:id
async function getCampaign(req, res) {
    const id = req.params.id;
    const campaign = await database_js_1.prisma.campaign.findUnique({
        where: { id },
        include: {
            createdBy: { select: { id: true, name: true } },
            _count: { select: { campaignLeads: true } },
        },
    });
    if (!campaign) {
        res.status(404).json({ error: 'Campanha não encontrada', code: 'NOT_FOUND' });
        return;
    }
    res.json(campaign);
}
// POST /api/campaigns
async function createCampaign(req, res) {
    const result = campaignSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: result.error.flatten() });
        return;
    }
    const campaign = await database_js_1.prisma.campaign.create({
        data: { ...result.data, createdById: req.user.sub },
        include: { createdBy: { select: { id: true, name: true } } },
    });
    res.status(201).json(campaign);
}
// PUT /api/campaigns/:id
async function updateCampaign(req, res) {
    const id = req.params.id;
    const result = campaignSchema.partial().safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: result.error.flatten() });
        return;
    }
    const existing = await database_js_1.prisma.campaign.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: 'Campanha não encontrada', code: 'NOT_FOUND' });
        return;
    }
    if (existing.status === 'RUNNING') {
        res.status(409).json({ error: 'Não é possível editar uma campanha em execução', code: 'CAMPAIGN_RUNNING' });
        return;
    }
    const campaign = await database_js_1.prisma.campaign.update({ where: { id }, data: result.data });
    res.json(campaign);
}
// DELETE /api/campaigns/:id
async function deleteCampaign(req, res) {
    const id = req.params.id;
    const existing = await database_js_1.prisma.campaign.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: 'Campanha não encontrada', code: 'NOT_FOUND' });
        return;
    }
    await database_js_1.prisma.campaign.delete({ where: { id } });
    res.status(204).send();
}
// POST /api/campaigns/:id/leads — adiciona leads à campanha
async function addLeadsToCampaign(req, res) {
    const campaignId = req.params.id;
    const { leadIds } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
        res.status(400).json({ error: 'leadIds obrigatório', code: 'VALIDATION_ERROR' });
        return;
    }
    const campaign = await database_js_1.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
        res.status(404).json({ error: 'Campanha não encontrada', code: 'NOT_FOUND' });
        return;
    }
    // createMany ignora duplicatas com skipDuplicates
    const result = await database_js_1.prisma.campaignLead.createMany({
        data: leadIds.map((leadId) => ({ campaignId, leadId })),
        skipDuplicates: true,
    });
    res.json({ added: result.count });
}
// DELETE /api/campaigns/:id/leads/:leadId
async function removeLeadFromCampaign(req, res) {
    const campaignId = req.params.id;
    const leadId = req.params.leadId;
    await database_js_1.prisma.campaignLead.deleteMany({
        where: { campaignId, leadId },
    });
    res.status(204).send();
}
// GET /api/campaigns/:id/stats
async function getCampaignStats(req, res) {
    const campaignId = req.params.id;
    const [total, sent, delivered, opened, clicked, replied, failed] = await Promise.all([
        database_js_1.prisma.campaignLead.count({ where: { campaignId } }),
        database_js_1.prisma.campaignLead.count({ where: { campaignId, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED'] } } }),
        database_js_1.prisma.campaignLead.count({ where: { campaignId, status: { in: ['DELIVERED', 'OPENED', 'CLICKED', 'REPLIED'] } } }),
        database_js_1.prisma.campaignLead.count({ where: { campaignId, status: { in: ['OPENED', 'CLICKED', 'REPLIED'] } } }),
        database_js_1.prisma.campaignLead.count({ where: { campaignId, status: { in: ['CLICKED', 'REPLIED'] } } }),
        database_js_1.prisma.campaignLead.count({ where: { campaignId, replied: true } }),
        database_js_1.prisma.campaignLead.count({ where: { campaignId, status: 'FAILED' } }),
    ]);
    const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;
    res.json({
        total, sent, delivered, opened, clicked, replied, failed,
        rates: {
            delivery: pct(delivered),
            open: pct(opened),
            click: pct(clicked),
            reply: pct(replied),
        },
    });
}
// POST /api/campaigns/:id/send
async function sendCampaign(req, res) {
    const id = req.params.id;
    const { channel } = req.body;
    const campaign = await database_js_1.prisma.campaign.findUnique({
        where: { id },
        include: { _count: { select: { campaignLeads: true } } },
    });
    if (!campaign) {
        res.status(404).json({ error: 'Campanha não encontrada', code: 'NOT_FOUND' });
        return;
    }
    if (campaign.status === 'RUNNING') {
        res.status(409).json({ error: 'Campanha já em execução', code: 'ALREADY_RUNNING' });
        return;
    }
    if (campaign._count.campaignLeads === 0) {
        res.status(400).json({ error: 'Campanha sem leads. Adicione leads antes de enviar.', code: 'NO_LEADS' });
        return;
    }
    // Atualiza status para RUNNING
    await database_js_1.prisma.campaign.update({ where: { id }, data: { status: 'RUNNING', sentAt: new Date() } });
    logger_js_1.logger.info({ campaignId: campaign.id, channel, leads: campaign._count.campaignLeads }, 'Campanha iniciada');
    res.json({
        message: 'Campanha iniciada',
        campaignId: campaign.id,
        leads: campaign._count.campaignLeads,
        channel: channel ?? campaign.type,
    });
}
// POST /api/campaigns/:id/pause
async function pauseCampaign(req, res) {
    const id = req.params.id;
    await database_js_1.prisma.campaign.update({ where: { id }, data: { status: 'PAUSED' } });
    res.json({ message: 'Campanha pausada' });
}
// GET /api/campaigns/:id/leads-engaged
async function getEngagedLeads(req, res) {
    const campaignId = req.params.id;
    const campaignLeads = await database_js_1.prisma.campaignLead.findMany({
        where: {
            campaignId,
            status: { in: ['OPENED', 'CLICKED', 'REPLIED'] },
        },
        include: { lead: true },
        orderBy: { openedAt: 'desc' },
    });
    res.json(campaignLeads);
}
//# sourceMappingURL=campaigns.controller.js.map