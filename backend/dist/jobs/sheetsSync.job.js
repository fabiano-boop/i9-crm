"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSheetsQueue = getSheetsQueue;
exports.scheduleDailySync = scheduleDailySync;
exports.startSheetsWorker = startSheetsWorker;
const bullmq_1 = require("bullmq");
const redis_js_1 = require("../config/redis.js");
const sheets_service_js_1 = require("../services/sheets.service.js");
const logger_js_1 = require("../utils/logger.js");
const QUEUE_NAME = 'sheets-sync';
let queue = null;
function getSheetsQueue() {
    if (!queue) {
        queue = new bullmq_1.Queue(QUEUE_NAME, { connection: (0, redis_js_1.getRedis)() });
    }
    return queue;
}
async function scheduleDailySync() {
    const available = await (0, redis_js_1.isRedisAvailable)();
    if (!available) {
        logger_js_1.logger.warn('Redis indisponível — sync automático diário desativado (sync manual via /api/sheets/sync ainda funciona)');
        return;
    }
    try {
        const q = getSheetsQueue();
        const repeatableJobs = await q.getRepeatableJobs();
        for (const job of repeatableJobs) {
            if (job.name === 'daily-sync')
                await q.removeRepeatableByKey(job.key);
        }
        await q.add('daily-sync', {}, {
            repeat: { pattern: '0 7 * * *' },
            removeOnComplete: 10,
            removeOnFail: 5,
        });
        logger_js_1.logger.info('Job de sync diário agendado para 07h00 (BullMQ)');
    }
    catch (err) {
        logger_js_1.logger.warn({ err }, 'Erro ao agendar sync diário');
    }
}
async function startSheetsWorker() {
    const available = await (0, redis_js_1.isRedisAvailable)();
    if (!available)
        return;
    try {
        const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
            logger_js_1.logger.info({ jobId: job.id }, 'Iniciando sync Sheets via job');
            return (0, sheets_service_js_1.syncFromSheets)();
        }, { connection: (0, redis_js_1.getRedis)() });
        worker.on('failed', (job, err) => logger_js_1.logger.error({ jobId: job?.id, err }, 'Sync job falhou'));
        logger_js_1.logger.info('Worker sheets-sync iniciado');
    }
    catch (err) {
        logger_js_1.logger.warn({ err }, 'Erro ao iniciar worker');
    }
}
//# sourceMappingURL=sheetsSync.job.js.map