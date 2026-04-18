"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleWeeklyReportJobs = scheduleWeeklyReportJobs;
exports.startWeeklyReportWorkers = startWeeklyReportWorkers;
const bullmq_1 = require("bullmq");
const redis_js_1 = require("../config/redis.js");
const logger_js_1 = require("../utils/logger.js");
const weeklyClientReport_service_js_1 = require("../services/weeklyClientReport.service.js");
// ─── Lazy queue getters ───────────────────────────────────────────────────────
let generateQueue = null;
let sendQueue = null;
function getGenerateQueue() {
    if (!generateQueue) {
        generateQueue = new bullmq_1.Queue('weekly-report-generate', { connection: (0, redis_js_1.getRedis)() });
        generateQueue.on('error', (err) => logger_js_1.logger.warn({ err }, 'weeklyReport generateQueue error'));
    }
    return generateQueue;
}
function getSendQueue() {
    if (!sendQueue) {
        sendQueue = new bullmq_1.Queue('weekly-report-send', { connection: (0, redis_js_1.getRedis)() });
        sendQueue.on('error', (err) => logger_js_1.logger.warn({ err }, 'weeklyReport sendQueue error'));
    }
    return sendQueue;
}
// ─── Cron schedulers ─────────────────────────────────────────────────────────
async function scheduleWeeklyReportJobs() {
    const available = await (0, redis_js_1.isRedisAvailable)();
    if (!available) {
        logger_js_1.logger.warn('Redis indisponível — weekly report jobs desativados');
        return;
    }
    try {
        // Sexta às 18h: gerar relatórios
        await getGenerateQueue().upsertJobScheduler('weekly-report-generate-cron', { pattern: '0 18 * * 5' }, { name: 'generate-weekly-reports', data: {} });
        // Sábado às 09h: enviar relatórios gerados
        await getSendQueue().upsertJobScheduler('weekly-report-send-cron', { pattern: '0 9 * * 6' }, { name: 'send-weekly-reports', data: {} });
        logger_js_1.logger.info('Weekly report jobs agendados (gerar @sex-18h, enviar @sab-09h)');
    }
    catch (err) {
        logger_js_1.logger.warn({ err }, 'Erro ao agendar weekly report jobs');
    }
}
// ─── Workers ─────────────────────────────────────────────────────────────────
async function startWeeklyReportWorkers() {
    const available = await (0, redis_js_1.isRedisAvailable)();
    if (!available) {
        logger_js_1.logger.warn('Redis indisponível — weekly report workers desativados');
        return;
    }
    try {
        new bullmq_1.Worker('weekly-report-generate', async () => {
            const result = await (0, weeklyClientReport_service_js_1.generateWeeklyReportsForAllClients)();
            logger_js_1.logger.info(result, 'weekly-report-generate job concluído');
            return result;
        }, { connection: (0, redis_js_1.getRedis)() })
            .on('failed', (job, err) => logger_js_1.logger.error({ jobId: job?.id, err }, 'weekly-report-generate job falhou'))
            .on('error', (err) => logger_js_1.logger.warn({ err }, 'weekly-report-generate worker error'));
        new bullmq_1.Worker('weekly-report-send', async () => {
            const result = await (0, weeklyClientReport_service_js_1.sendPendingWeeklyReports)();
            logger_js_1.logger.info(result, 'weekly-report-send job concluído');
            return result;
        }, { connection: (0, redis_js_1.getRedis)() })
            .on('failed', (job, err) => logger_js_1.logger.error({ jobId: job?.id, err }, 'weekly-report-send job falhou'))
            .on('error', (err) => logger_js_1.logger.warn({ err }, 'weekly-report-send worker error'));
        logger_js_1.logger.info('Weekly report workers iniciados');
    }
    catch (err) {
        logger_js_1.logger.warn({ err }, 'Erro ao iniciar weekly report workers');
    }
}
//# sourceMappingURL=weeklyReport.job.js.map