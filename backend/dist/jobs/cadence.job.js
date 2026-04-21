"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCadenceQueue = getCadenceQueue;
exports.scheduleCadenceJob = scheduleCadenceJob;
exports.startCadenceWorker = startCadenceWorker;
const bullmq_1 = require("bullmq");
const redis_js_1 = require("../config/redis.js");
const database_js_1 = require("../config/database.js");
const cadence_service_js_1 = require("../services/cadence.service.js");
const logger_js_1 = require("../utils/logger.js");
const QUEUE_NAME = 'cadence';
let queue = null;
function getCadenceQueue() {
    if (!queue)
        queue = new bullmq_1.Queue(QUEUE_NAME, { connection: (0, redis_js_1.getRedis)() });
    return queue;
}
async function scheduleCadenceJob() {
    const available = await (0, redis_js_1.isRedisAvailable)();
    if (!available) {
        logger_js_1.logger.warn('Redis indisponível — cadência automática desativada');
        return;
    }
    try {
        const q = getCadenceQueue();
        for (const job of await q.getRepeatableJobs()) {
            if (job.name === 'cadence-check')
                await q.removeRepeatableByKey(job.key);
        }
        await q.add('cadence-check', {}, {
            repeat: { pattern: '0 * * * *' }, // a cada hora
            removeOnComplete: 5,
            removeOnFail: 5,
        });
        logger_js_1.logger.info('Job de cadência agendado (a cada hora)');
    }
    catch (err) {
        logger_js_1.logger.warn({ err }, 'Erro ao agendar job de cadência');
    }
}
async function startCadenceWorker() {
    const available = await (0, redis_js_1.isRedisAvailable)();
    if (!available)
        return;
    try {
        const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
            if (job.name === 'cadence-check') {
                const due = await database_js_1.prisma.leadCadence.findMany({
                    where: { status: 'active', nextActionAt: { lte: new Date() } },
                    select: { id: true },
                });
                logger_js_1.logger.info({ count: due.length }, 'Cadências vencidas encontradas');
                const q = getCadenceQueue();
                for (const { id } of due) {
                    await q.add('process-step', { cadenceId: id }, {
                        attempts: 3,
                        backoff: { type: 'fixed', delay: 2 * 60 * 60 * 1000 }, // retry em 2h
                        removeOnComplete: 20,
                        removeOnFail: 10,
                    });
                }
                return { queued: due.length };
            }
            if (job.name === 'process-step') {
                const { cadenceId } = job.data;
                await (0, cadence_service_js_1.processStep)(cadenceId);
            }
        }, {
            connection: (0, redis_js_1.getRedis)(),
            limiter: { max: 30, duration: 60_000 }, // max 30 steps/min
        });
        worker.on('failed', (job, err) => {
            logger_js_1.logger.error({ jobName: job?.name, jobData: job?.data, err }, 'Cadência job falhou');
        });
        logger_js_1.logger.info('Worker de cadência iniciado');
    }
    catch (err) {
        logger_js_1.logger.warn({ err }, 'Erro ao iniciar worker de cadência');
    }
}
//# sourceMappingURL=cadence.job.js.map