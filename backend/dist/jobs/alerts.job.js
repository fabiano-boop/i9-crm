"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleAlertJobs = scheduleAlertJobs;
exports.startAlertWorkers = startAlertWorkers;
const bullmq_1 = require("bullmq");
const redis_js_1 = require("../config/redis.js");
const logger_js_1 = require("../utils/logger.js");
const opportunityAlert_service_js_1 = require("../services/opportunityAlert.service.js");
const database_js_1 = require("../config/database.js");
// ─── Lazy Queue getters (não cria instâncias no nível de módulo) ──────────────
let engagementQueue = null;
let coolingQueue = null;
let digestQueue = null;
function getEngagementQueue() {
    if (!engagementQueue) {
        engagementQueue = new bullmq_1.Queue('alert-check-engagement', { connection: (0, redis_js_1.getRedis)() });
        engagementQueue.on('error', (err) => logger_js_1.logger.warn({ err }, 'engagementQueue error'));
    }
    return engagementQueue;
}
function getCoolingQueue() {
    if (!coolingQueue) {
        coolingQueue = new bullmq_1.Queue('alert-check-cooling', { connection: (0, redis_js_1.getRedis)() });
        coolingQueue.on('error', (err) => logger_js_1.logger.warn({ err }, 'coolingQueue error'));
    }
    return coolingQueue;
}
function getDigestQueue() {
    if (!digestQueue) {
        digestQueue = new bullmq_1.Queue('morning-digest', { connection: (0, redis_js_1.getRedis)() });
        digestQueue.on('error', (err) => logger_js_1.logger.warn({ err }, 'digestQueue error'));
    }
    return digestQueue;
}
// ─── Cron schedulers ─────────────────────────────────────────────────────────
async function scheduleAlertJobs() {
    const available = await (0, redis_js_1.isRedisAvailable)();
    if (!available) {
        logger_js_1.logger.warn('Redis indisponível — alert jobs desativados');
        return;
    }
    try {
        await getEngagementQueue().upsertJobScheduler('alert-engagement-cron', { pattern: '0 * * * *' }, { name: 'check-engagement', data: {} });
        await getCoolingQueue().upsertJobScheduler('alert-cooling-cron', { pattern: '0 9 * * *' }, { name: 'check-cooling', data: {} });
        await getDigestQueue().upsertJobScheduler('morning-digest-cron', { pattern: '0 8 * * 1-6' }, { name: 'morning-digest', data: {} });
        logger_js_1.logger.info('Alert jobs agendados (engagement @hourly, cooling @09h, digest @08h seg-sáb)');
    }
    catch (err) {
        logger_js_1.logger.warn({ err }, 'Erro ao agendar alert jobs');
    }
}
// ─── Workers ─────────────────────────────────────────────────────────────────
async function startAlertWorkers() {
    const available = await (0, redis_js_1.isRedisAvailable)();
    if (!available) {
        logger_js_1.logger.warn('Redis indisponível — alert workers desativados');
        return;
    }
    try {
        new bullmq_1.Worker('alert-check-engagement', async () => {
            const oneHourAgo = new Date();
            oneHourAgo.setHours(oneHourAgo.getHours() - 1);
            const recentLeads = await database_js_1.prisma.trackingEvent.findMany({
                where: { createdAt: { gte: oneHourAgo } },
                select: { leadId: true },
                distinct: ['leadId'],
            });
            let created = 0;
            for (const { leadId } of recentLeads) {
                const alert = await (0, opportunityAlert_service_js_1.checkHotEngagement)(leadId);
                if (alert)
                    created++;
            }
            logger_js_1.logger.info({ checked: recentLeads.length, created }, 'alert-check-engagement concluído');
            return { checked: recentLeads.length, created };
        }, { connection: (0, redis_js_1.getRedis)() })
            .on('failed', (job, err) => logger_js_1.logger.error({ jobId: job?.id, err }, 'alert-check-engagement job falhou'))
            .on('error', (err) => logger_js_1.logger.warn({ err }, 'alert-check-engagement worker error'));
        new bullmq_1.Worker('alert-check-cooling', async () => {
            const [coolingCount, noContactCount] = await Promise.all([
                (0, opportunityAlert_service_js_1.checkCoolingLeads)(),
                (0, opportunityAlert_service_js_1.checkNoContactWeek)(),
            ]);
            logger_js_1.logger.info({ coolingCount, noContactCount }, 'alert-check-cooling concluído');
            return { coolingCount, noContactCount };
        }, { connection: (0, redis_js_1.getRedis)() })
            .on('failed', (job, err) => logger_js_1.logger.error({ jobId: job?.id, err }, 'alert-check-cooling job falhou'))
            .on('error', (err) => logger_js_1.logger.warn({ err }, 'alert-check-cooling worker error'));
        new bullmq_1.Worker('morning-digest', async () => {
            await (0, opportunityAlert_service_js_1.generateMorningDigest)();
            logger_js_1.logger.info('morning-digest job concluído');
        }, { connection: (0, redis_js_1.getRedis)() })
            .on('failed', (job, err) => logger_js_1.logger.error({ jobId: job?.id, err }, 'morning-digest job falhou'))
            .on('error', (err) => logger_js_1.logger.warn({ err }, 'morning-digest worker error'));
        logger_js_1.logger.info('Alert workers iniciados');
    }
    catch (err) {
        logger_js_1.logger.warn({ err }, 'Erro ao iniciar alert workers');
    }
}
//# sourceMappingURL=alerts.job.js.map