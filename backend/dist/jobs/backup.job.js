"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBackupQueue = getBackupQueue;
exports.scheduleBackupJob = scheduleBackupJob;
exports.startBackupWorker = startBackupWorker;
const bullmq_1 = require("bullmq");
const resend_1 = require("resend");
const redis_js_1 = require("../config/redis.js");
const backup_service_js_1 = require("../services/backup.service.js");
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../utils/logger.js");
const QUEUE_NAME = 'backup';
let queue = null;
function getBackupQueue() {
    if (!queue)
        queue = new bullmq_1.Queue(QUEUE_NAME, { connection: (0, redis_js_1.getRedis)() });
    return queue;
}
async function scheduleBackupJob() {
    const available = await (0, redis_js_1.isRedisAvailable)();
    if (!available) {
        logger_js_1.logger.warn('Redis indisponível — backup automático desativado');
        return;
    }
    try {
        const q = getBackupQueue();
        for (const job of await q.getRepeatableJobs()) {
            if (job.name === 'daily-backup')
                await q.removeRepeatableByKey(job.key);
        }
        await q.add('daily-backup', {}, {
            repeat: { pattern: '0 2 * * *' },
            removeOnComplete: 10,
            removeOnFail: 5,
        });
        logger_js_1.logger.info('Job de backup agendado para 02h00 (BullMQ)');
    }
    catch (err) {
        logger_js_1.logger.warn({ err }, 'Erro ao agendar backup');
    }
}
async function startBackupWorker() {
    const available = await (0, redis_js_1.isRedisAvailable)();
    if (!available)
        return;
    try {
        const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
            logger_js_1.logger.info({ jobId: job.id }, 'Executando backup automático');
            return (0, backup_service_js_1.runBackup)('auto');
        }, { connection: (0, redis_js_1.getRedis)() });
        worker.on('failed', async (_job, err) => {
            logger_js_1.logger.error({ err }, 'Backup automático falhou');
            if (env_js_1.env.ADMIN_EMAIL && env_js_1.env.RESEND_API_KEY) {
                try {
                    const resend = new resend_1.Resend(env_js_1.env.RESEND_API_KEY);
                    await resend.emails.send({
                        from: `${env_js_1.env.EMAIL_FROM_NAME} <${env_js_1.env.EMAIL_FROM}>`,
                        to: env_js_1.env.ADMIN_EMAIL,
                        subject: '[i9 CRM] Falha no backup automático',
                        html: `<p>O backup automático falhou em <strong>${new Date().toLocaleString('pt-BR')}</strong>.</p><p>Erro: ${err.message}</p>`,
                    });
                }
                catch (emailErr) {
                    logger_js_1.logger.error({ emailErr }, 'Falha ao enviar alerta de backup');
                }
            }
        });
        logger_js_1.logger.info('Worker backup iniciado');
    }
    catch (err) {
        logger_js_1.logger.warn({ err }, 'Erro ao iniciar worker de backup');
    }
}
//# sourceMappingURL=backup.job.js.map