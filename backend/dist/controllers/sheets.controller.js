"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerSync = triggerSync;
exports.getSyncHistory = getSyncHistory;
exports.getQueueStatus = getQueueStatus;
const database_js_1 = require("../config/database.js");
const sheets_service_js_1 = require("../services/sheets.service.js");
const sheetsSync_job_js_1 = require("../jobs/sheetsSync.job.js");
const logger_js_1 = require("../utils/logger.js");
// POST /api/sheets/sync — dispara sync manual
async function triggerSync(_req, res) {
    if (!process.env['GOOGLE_SHEETS_ID'] || !process.env['GOOGLE_SERVICE_ACCOUNT_JSON'] ||
        process.env['GOOGLE_SERVICE_ACCOUNT_JSON'] === '{"type":"service_account","project_id":"..."}') {
        res.status(503).json({
            error: 'Google Sheets não configurado',
            code: 'SHEETS_NOT_CONFIGURED',
            hint: 'Configure GOOGLE_SHEETS_ID e GOOGLE_SERVICE_ACCOUNT_JSON no .env',
        });
        return;
    }
    logger_js_1.logger.info('Sync manual do Google Sheets solicitado');
    try {
        const result = await (0, sheets_service_js_1.syncFromSheets)();
        res.json({ success: true, result });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger_js_1.logger.error({ err }, 'Erro no sync manual');
        res.status(500).json({ error: message, code: 'SYNC_ERROR' });
    }
}
// GET /api/sheets/sync-history
async function getSyncHistory(_req, res) {
    const history = await database_js_1.prisma.sheetSync.findMany({
        orderBy: { syncedAt: 'desc' },
        take: 20,
    });
    res.json(history);
}
// GET /api/sheets/queue-status
async function getQueueStatus(_req, res) {
    try {
        const q = (0, sheetsSync_job_js_1.getSheetsQueue)();
        const [waiting, active, completed, failed, repeatableJobs] = await Promise.all([
            q.getWaitingCount(),
            q.getActiveCount(),
            q.getCompletedCount(),
            q.getFailedCount(),
            q.getRepeatableJobs(),
        ]);
        res.json({ waiting, active, completed, failed, scheduledJobs: repeatableJobs.length });
    }
    catch {
        res.json({ status: 'Redis indisponível — filas desativadas' });
    }
}
//# sourceMappingURL=sheets.controller.js.map