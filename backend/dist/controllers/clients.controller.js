"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listClients = listClients;
exports.getClient = getClient;
exports.createClient = createClient;
exports.updateClient = updateClient;
exports.patchClientStatus = patchClientStatus;
exports.deleteClient = deleteClient;
exports.listClientReports = listClientReports;
exports.generateClientReport = generateClientReport;
exports.getClientsOverview = getClientsOverview;
exports.getMrrProjection = getMrrProjection;
exports.sendStandaloneReport = sendStandaloneReport;
exports.previewReport = previewReport;
exports.downloadReportPdf = downloadReportPdf;
exports.downloadNestedReportPdf = downloadNestedReportPdf;
const fs_1 = __importDefault(require("fs"));
const zod_1 = require("zod");
const database_js_1 = require("../config/database.js");
const logger_js_1 = require("../utils/logger.js");
const weeklyClientReport_service_js_1 = require("../services/weeklyClientReport.service.js");
const clientReport_job_js_1 = require("../jobs/clientReport.job.js");
const redis_js_1 = require("../config/redis.js");
// ─── Zod schemas ──────────────────────────────────────────────────────────────
const createClientSchema = zod_1.z.object({
    businessName: zod_1.z.string().min(1, 'Nome do negócio é obrigatório'),
    ownerName: zod_1.z.string().min(1, 'Nome do responsável é obrigatório'),
    email: zod_1.z.string().email('Email inválido').optional().nullable(),
    whatsapp: zod_1.z.string().optional().nullable(),
    address: zod_1.z.string().optional().nullable(),
    neighborhood: zod_1.z.string().optional().nullable(),
    niche: zod_1.z.string().optional().nullable(),
    package: zod_1.z.enum(['basico', 'pro', 'premium']).optional().nullable(),
    monthlyValue: zod_1.z.number().positive().optional().nullable(),
    startDate: zod_1.z.string().datetime({ offset: true }).optional(),
    origin: zod_1.z.enum(['lead', 'referral', 'manual']).default('manual'),
    leadId: zod_1.z.string().cuid().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
});
const updateClientSchema = createClientSchema.partial().omit({ origin: true, leadId: true });
const patchStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['active', 'paused', 'cancelled']),
    cancellationReason: zod_1.z.string().optional(),
});
const generateReportSchema = zod_1.z.object({
    weekStart: zod_1.z.string().datetime({ offset: true }).optional(),
});
const sendReportSchema = zod_1.z.object({
    channels: zod_1.z.array(zod_1.z.enum(['email', 'whatsapp'])).default(['email', 'whatsapp']),
});
// ─── Helpers ──────────────────────────────────────────────────────────────────
function startOfCurrentWeek() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // segunda-feira
    return d;
}
// ─── CLIENTES — CRUD ──────────────────────────────────────────────────────────
async function listClients(req, res) {
    const status = req.query['status'];
    const niche = req.query['niche'];
    const neighborhood = req.query['neighborhood'];
    const pkg = req.query['package'];
    const page = Number(req.query['page'] ?? 1);
    const limit = Number(req.query['limit'] ?? 20);
    const skip = (page - 1) * limit;
    const where = {};
    if (status)
        where['status'] = status;
    if (pkg)
        where['package'] = pkg;
    if (niche)
        where['niche'] = { contains: niche, mode: 'insensitive' };
    if (neighborhood)
        where['neighborhood'] = { contains: neighborhood, mode: 'insensitive' };
    const [clients, total] = await Promise.all([
        database_js_1.prisma.client.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { weeklyReports: true } },
                weeklyReports: { orderBy: { weekStart: 'desc' }, take: 1 },
            },
        }),
        database_js_1.prisma.client.count({ where }),
    ]);
    res.json({ clients, total, page, limit });
}
async function getClient(req, res) {
    const id = req.params['id'];
    const client = await database_js_1.prisma.client.findUnique({
        where: { id },
        include: {
            weeklyReports: { orderBy: { weekStart: 'desc' }, take: 10 },
        },
    });
    if (!client) {
        res.status(404).json({ error: 'Cliente não encontrado' });
        return;
    }
    // Métricas acumuladas
    const [totalReports, lastReport] = await Promise.all([
        database_js_1.prisma.weeklyReport.count({ where: { clientId: id } }),
        database_js_1.prisma.weeklyReport.findFirst({ where: { clientId: id }, orderBy: { weekStart: 'desc' } }),
    ]);
    res.json({ ...client, totalReports, lastReportAt: lastReport?.weekStart ?? null });
}
async function createClient(req, res) {
    const parse = createClientSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() });
        return;
    }
    const data = parse.data;
    const client = await database_js_1.prisma.client.create({
        data: {
            businessName: data.businessName,
            ownerName: data.ownerName,
            email: data.email ?? undefined,
            whatsapp: data.whatsapp ?? undefined,
            address: data.address ?? undefined,
            neighborhood: data.neighborhood ?? undefined,
            niche: data.niche ?? undefined,
            package: data.package ?? undefined,
            monthlyValue: data.monthlyValue ?? undefined,
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            origin: data.origin,
            leadId: data.leadId ?? undefined,
            notes: data.notes ?? undefined,
        },
    });
    logger_js_1.logger.info({ clientId: client.id }, 'Cliente criado');
    // Gerar primeiro relatório em background (semana atual)
    (0, clientReport_job_js_1.enqueueManualReport)(client.id, startOfCurrentWeek()).catch((err) => logger_js_1.logger.warn({ err, clientId: client.id }, 'Falha ao enfileirar relatório de onboarding'));
    res.status(201).json(client);
}
async function updateClient(req, res) {
    const id = req.params['id'];
    const existing = await database_js_1.prisma.client.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: 'Cliente não encontrado' });
        return;
    }
    const parse = updateClientSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() });
        return;
    }
    const data = parse.data;
    const client = await database_js_1.prisma.client.update({
        where: { id },
        data: {
            ...(data.businessName !== undefined && { businessName: data.businessName }),
            ...(data.ownerName !== undefined && { ownerName: data.ownerName }),
            ...(data.email !== undefined && { email: data.email }),
            ...(data.whatsapp !== undefined && { whatsapp: data.whatsapp }),
            ...(data.address !== undefined && { address: data.address }),
            ...(data.neighborhood !== undefined && { neighborhood: data.neighborhood }),
            ...(data.niche !== undefined && { niche: data.niche }),
            ...(data.package !== undefined && { package: data.package }),
            ...(data.monthlyValue !== undefined && { monthlyValue: data.monthlyValue }),
            ...(data.notes !== undefined && { notes: data.notes }),
        },
    });
    res.json(client);
}
async function patchClientStatus(req, res) {
    const id = req.params['id'];
    const existing = await database_js_1.prisma.client.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: 'Cliente não encontrado' });
        return;
    }
    const parse = patchStatusSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() });
        return;
    }
    const { status, cancellationReason } = parse.data;
    const client = await database_js_1.prisma.client.update({
        where: { id },
        data: {
            status,
            ...(status === 'cancelled' && {
                cancelledAt: new Date(),
                cancellationReason: cancellationReason ?? null,
            }),
        },
    });
    logger_js_1.logger.info({ clientId: id, status }, 'Status do cliente atualizado');
    res.json(client);
}
// Soft delete — apenas muda status para cancelled
async function deleteClient(req, res) {
    const id = req.params['id'];
    const existing = await database_js_1.prisma.client.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: 'Cliente não encontrado' });
        return;
    }
    await database_js_1.prisma.client.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt: new Date() },
    });
    logger_js_1.logger.info({ clientId: id }, 'Cliente marcado como cancelado (soft delete)');
    res.status(204).send();
}
// ─── WEEKLY REPORTS ───────────────────────────────────────────────────────────
async function listClientReports(req, res) {
    const id = req.params['id'];
    const page = Number(req.query['page'] ?? 1);
    const limit = Number(req.query['limit'] ?? 10);
    const skip = (page - 1) * limit;
    const [reports, total] = await Promise.all([
        database_js_1.prisma.weeklyReport.findMany({
            where: { clientId: id },
            skip,
            take: limit,
            orderBy: { weekStart: 'desc' },
        }),
        database_js_1.prisma.weeklyReport.count({ where: { clientId: id } }),
    ]);
    res.json({ reports, total, page, limit });
}
async function generateClientReport(req, res) {
    const id = req.params['id'];
    const client = await database_js_1.prisma.client.findUnique({ where: { id } });
    if (!client) {
        res.status(404).json({ error: 'Cliente não encontrado' });
        return;
    }
    const parse = generateReportSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() });
        return;
    }
    const weekStartDate = parse.data.weekStart
        ? new Date(parse.data.weekStart)
        : startOfCurrentWeek();
    // Se Redis disponível, enfileirar com prioridade máxima e retornar imediatamente
    const redisOk = await (0, redis_js_1.isRedisAvailable)();
    if (redisOk) {
        const jobId = await (0, clientReport_job_js_1.enqueueManualReport)(id, weekStartDate);
        res.status(202).json({ queued: true, jobId, message: 'Relatório enfileirado com prioridade máxima' });
        return;
    }
    // Fallback síncrono quando Redis indisponível
    try {
        const report = await (0, weeklyClientReport_service_js_1.generateReport)(id, weekStartDate);
        res.status(201).json(report);
    }
    catch (err) {
        logger_js_1.logger.error({ err, clientId: id }, 'Erro ao gerar relatório');
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
}
// ─── METRICS ─────────────────────────────────────────────────────────────────
async function getClientsOverview(_req, res) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = startOfCurrentWeek();
    const [activeClients, mrrAgg, byPackageRaw, byNicheRaw, churnThisMonth, newThisMonth, reportsThisWeek,] = await Promise.all([
        database_js_1.prisma.client.count({ where: { status: 'active' } }),
        database_js_1.prisma.client.aggregate({
            where: { status: 'active' },
            _sum: { monthlyValue: true },
            _avg: { monthlyValue: true },
        }),
        database_js_1.prisma.client.groupBy({
            by: ['package'],
            where: { status: 'active' },
            _count: true,
        }),
        database_js_1.prisma.client.groupBy({
            by: ['niche'],
            where: { status: 'active' },
            _count: true,
            orderBy: { _count: { niche: 'desc' } },
        }),
        database_js_1.prisma.client.count({
            where: { status: 'cancelled', cancelledAt: { gte: startOfMonth } },
        }),
        database_js_1.prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
        database_js_1.prisma.weeklyReport.count({ where: { createdAt: { gte: startOfWeek } } }),
    ]);
    const byPackage = {};
    for (const row of byPackageRaw) {
        byPackage[row.package ?? 'sem_pacote'] = row._count;
    }
    const byNiche = {};
    for (const row of byNicheRaw) {
        byNiche[row.niche ?? 'outros'] = row._count;
    }
    res.json({
        totalActive: activeClients,
        totalMRR: mrrAgg._sum.monthlyValue ?? 0,
        avgPackageValue: mrrAgg._avg.monthlyValue ?? 0,
        byPackage,
        byNiche,
        churnThisMonth,
        newThisMonth,
        reportsGeneratedThisWeek: reportsThisWeek,
    });
}
async function getMrrProjection(_req, res) {
    // Coleta histórico dos últimos 6 meses de MRR
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const agg = await database_js_1.prisma.client.aggregate({
            where: {
                status: { in: ['active', 'paused'] },
                createdAt: { lte: end },
                OR: [
                    { cancelledAt: null },
                    { cancelledAt: { gte: start } },
                ],
            },
            _sum: { monthlyValue: true },
            _count: true,
        });
        const label = start.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        months.push({ label, mrr: agg._sum.monthlyValue ?? 0, clients: agg._count });
    }
    // Crescimento médio mês a mês (últimos 3 meses)
    const recentMonths = months.slice(-3);
    let avgGrowthRate = 0;
    if (recentMonths.length >= 2) {
        const growthRates = [];
        for (let i = 1; i < recentMonths.length; i++) {
            const prev = recentMonths[i - 1].mrr;
            const curr = recentMonths[i].mrr;
            if (prev > 0)
                growthRates.push((curr - prev) / prev);
        }
        avgGrowthRate = growthRates.length > 0
            ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length
            : 0;
    }
    // Projeção — próximos 6 meses
    const projection = [];
    let lastMrr = months[months.length - 1]?.mrr ?? 0;
    for (let i = 1; i <= 6; i++) {
        const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        lastMrr = lastMrr * (1 + avgGrowthRate);
        const label = futureDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        projection.push({ label, projectedMrr: Math.round(lastMrr) });
    }
    res.json({ history: months, projection, avgGrowthRate: parseFloat((avgGrowthRate * 100).toFixed(2)) });
}
// ─── STANDALONE REPORT ACTIONS (usados pelo /api/reports router) ──────────────
async function sendStandaloneReport(req, res) {
    const id = req.params['id'];
    const report = await database_js_1.prisma.weeklyReport.findUnique({ where: { id } });
    if (!report) {
        res.status(404).json({ error: 'Relatório não encontrado' });
        return;
    }
    const parse = sendReportSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() });
        return;
    }
    const { channels } = parse.data;
    const redisOk = await (0, redis_js_1.isRedisAvailable)();
    if (redisOk) {
        await (0, clientReport_job_js_1.enqueueSendReport)(id, channels);
        res.json({ queued: true });
        return;
    }
    try {
        await (0, weeklyClientReport_service_js_1.sendReport)(id);
        const updated = await database_js_1.prisma.weeklyReport.findUnique({ where: { id } });
        res.json({ sentViaEmail: updated?.sentViaEmail, sentViaWhatsApp: updated?.sentViaWhatsApp });
    }
    catch (err) {
        logger_js_1.logger.error({ err, reportId: id }, 'Erro ao enviar relatório');
        res.status(500).json({ error: 'Erro ao enviar relatório' });
    }
}
async function previewReport(req, res) {
    const id = req.params['id'];
    try {
        const html = await (0, weeklyClientReport_service_js_1.getReportHtml)(id);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(404).json({ error: msg });
    }
}
async function downloadReportPdf(req, res) {
    const id = req.params['id'];
    const report = await database_js_1.prisma.weeklyReport.findUnique({
        where: { id },
        include: { client: true },
    });
    if (!report) {
        res.status(404).json({ error: 'Relatório não encontrado' });
        return;
    }
    // Servir PDF salvo em disco
    if (report.pdfPath && fs_1.default.existsSync(report.pdfPath)) {
        const filename = `relatorio-i9-${report.weekStart.toISOString().slice(0, 10)}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        fs_1.default.createReadStream(report.pdfPath).pipe(res);
        return;
    }
    // Fallback: HTML com print CSS
    try {
        const html = await (0, weeklyClientReport_service_js_1.getReportHtml)(id);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Pdf-Fallback', 'true');
        res.send(html);
    }
    catch (err) {
        logger_js_1.logger.error({ err, reportId: id }, 'Erro ao recuperar relatório');
        res.status(500).json({ error: 'Erro ao recuperar relatório' });
    }
}
// Mantido para compatibilidade com a rota nested /:id/reports/:rid/pdf
async function downloadNestedReportPdf(req, res) {
    req.params['id'] = req.params['rid'];
    return downloadReportPdf(req, res);
}
//# sourceMappingURL=clients.controller.js.map