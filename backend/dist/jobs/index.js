"use strict";
/**
 * Ponto central de inicialização de todos os workers e agendamentos de jobs.
 * Importado uma única vez em server.ts.
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
async function startAllWorkers() {
    // Workers síncronos (sem Redis check interno)
    (0, sheetsSync_job_js_1.startSheetsWorker)();
    (0, backup_job_js_1.startBackupWorker)();
    (0, cadence_job_js_1.startCadenceWorker)();
    // Workers assíncronos (Redis-dependent)
    await Promise.allSettled([
        (0, alerts_job_js_1.startAlertWorkers)().catch((err) => logger_js_1.logger.warn({ err }, 'Alert workers falhou ao iniciar')),
        (0, clientReport_job_js_1.startClientReportWorkers)().catch((err) => logger_js_1.logger.warn({ err }, 'Client report workers falhou ao iniciar')),
    ]);
    logger_js_1.logger.info('Todos os workers iniciados');
}
async function scheduleAllJobs() {
    // Agendamentos síncronos
    (0, sheetsSync_job_js_1.scheduleDailySync)();
    (0, backup_job_js_1.scheduleBackupJob)();
    (0, cadence_job_js_1.scheduleCadenceJob)();
    // Agendamentos assíncronos (Redis-dependent)
    await Promise.allSettled([
        (0, alerts_job_js_1.scheduleAlertJobs)().catch((err) => logger_js_1.logger.warn({ err }, 'Alert jobs agendamento falhou')),
        (0, clientReport_job_js_1.scheduleClientReportJobs)().catch((err) => logger_js_1.logger.warn({ err }, 'Client report jobs agendamento falhou')),
    ]);
    logger_js_1.logger.info('Todos os jobs agendados');
}
//# sourceMappingURL=index.js.map