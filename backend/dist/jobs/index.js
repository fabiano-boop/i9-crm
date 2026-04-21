"use strict";
/**
 * Ponto central de inicializacao de todos os workers e agendamentos de jobs.
 * Importado uma unica vez em server.ts.
 *
 * Todos os registros passam por safeSchedule() - se o Redis estiver
 * indisponivel ou a funcao lancar erro, apenas loga warning e segue.
 * Isso garante que uma falha em um job (ex: Redis caiu) nao derrube os outros.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAllWorkers = startAllWorkers;
exports.scheduleAllJobs = scheduleAllJobs;
const logger_js_1 = require("../utils/logger.js");
const sheetsSync_job_js_1 = require("./sheetsSync.job.js");
const backup_job_js_1 = require("./backup.job.js");
const cadence_job_js_1 = require("./cadence.job.js");
const alerts_job_js_1 = require("./alerts.job.js");
const clientReport_job_js_1 = require("./clientReport.job.js");
async function safeSchedule(name, fn) {
    try {
        await fn();
        logger_js_1.logger.info({ job: name }, 'Job "' + name + '" registrado com sucesso');
    }
    catch (err) {
        logger_js_1.logger.warn({ err, job: name }, 'Falha ao registrar job "' + name + '"');
    }
}
async function startAllWorkers() {
    await Promise.allSettled([
        safeSchedule('sheets-worker', () => (0, sheetsSync_job_js_1.startSheetsWorker)()),
        safeSchedule('backup-worker', () => (0, backup_job_js_1.startBackupWorker)()),
        safeSchedule('cadence-worker', () => (0, cadence_job_js_1.startCadenceWorker)()),
        safeSchedule('alert-workers', () => (0, alerts_job_js_1.startAlertWorkers)()),
        safeSchedule('client-report-workers', () => (0, clientReport_job_js_1.startClientReportWorkers)()),
    ]);
    logger_js_1.logger.info('Inicializacao de workers concluida');
}
async function scheduleAllJobs() {
    await Promise.allSettled([
        safeSchedule('daily-sync', () => (0, sheetsSync_job_js_1.scheduleDailySync)()),
        safeSchedule('backup-job', () => (0, backup_job_js_1.scheduleBackupJob)()),
        safeSchedule('cadence-job', () => (0, cadence_job_js_1.scheduleCadenceJob)()),
        safeSchedule('alert-jobs', () => (0, alerts_job_js_1.scheduleAlertJobs)()),
        safeSchedule('client-report-jobs', () => (0, clientReport_job_js_1.scheduleClientReportJobs)()),
    ]);
    logger_js_1.logger.info('Agendamento de jobs concluido');
}
//# sourceMappingURL=index.js.map