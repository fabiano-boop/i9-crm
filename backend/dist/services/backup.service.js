"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBackup = runBackup;
exports.listBackups = listBackups;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const zlib_1 = require("zlib");
const os_1 = require("os");
const path_1 = require("path");
const googleapis_1 = require("googleapis");
const database_js_1 = require("../config/database.js");
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../utils/logger.js");
function getDriveAuth() {
    if (!env_js_1.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado');
    }
    const credentials = JSON.parse(env_js_1.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    return new googleapis_1.google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
}
function pgDumpToFile(localPath) {
    return new Promise((resolve, reject) => {
        const dbUrl = env_js_1.env.DIRECT_URL ?? env_js_1.env.DATABASE_URL;
        const pgDump = (0, child_process_1.spawn)('pg_dump', ['--dbname', dbUrl, '--format=plain', '--no-password'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const gzip = (0, zlib_1.createGzip)();
        const output = (0, fs_1.createWriteStream)(localPath);
        pgDump.stderr.on('data', (chunk) => {
            const msg = chunk.toString();
            if (!msg.toLowerCase().includes('warning')) {
                logger_js_1.logger.warn({ stderr: msg }, 'pg_dump stderr');
            }
        });
        pgDump.on('error', (err) => reject(new Error(`pg_dump não encontrado ou falhou: ${err.message}`)));
        output.on('finish', resolve);
        output.on('error', reject);
        pgDump.stdout.pipe(gzip).pipe(output);
    });
}
async function uploadToDrive(localPath, filename) {
    if (!env_js_1.env.BACKUP_GOOGLE_DRIVE_FOLDER_ID) {
        throw new Error('BACKUP_GOOGLE_DRIVE_FOLDER_ID não configurado');
    }
    const drive = googleapis_1.google.drive({ version: 'v3', auth: getDriveAuth() });
    const res = await drive.files.create({
        requestBody: { name: filename, parents: [env_js_1.env.BACKUP_GOOGLE_DRIVE_FOLDER_ID] },
        media: { mimeType: 'application/gzip', body: (0, fs_1.createReadStream)(localPath) },
    });
    return res.data.id;
}
async function deleteOldDriveBackups() {
    if (!env_js_1.env.BACKUP_GOOGLE_DRIVE_FOLDER_ID)
        return;
    const drive = googleapis_1.google.drive({ version: 'v3', auth: getDriveAuth() });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - env_js_1.env.BACKUP_RETENTION_DAYS);
    const res = await drive.files.list({
        q: `'${env_js_1.env.BACKUP_GOOGLE_DRIVE_FOLDER_ID}' in parents and createdTime < '${cutoff.toISOString()}' and trashed = false`,
        fields: 'files(id, name)',
    });
    for (const file of res.data.files ?? []) {
        await drive.files.delete({ fileId: file.id });
        logger_js_1.logger.info({ fileId: file.id, name: file.name }, 'Backup antigo deletado do Drive');
    }
}
async function runBackup(triggeredBy = 'auto') {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const filename = `i9crm-${ts}.sql.gz`;
    const localPath = (0, path_1.join)((0, os_1.tmpdir)(), filename);
    let driveFileId = null;
    let status = 'success';
    let errorMsg = null;
    let sizeKb = 0;
    try {
        logger_js_1.logger.info({ filename }, 'Iniciando backup');
        await pgDumpToFile(localPath);
        sizeKb = Math.ceil((0, fs_1.statSync)(localPath).size / 1024);
        driveFileId = await uploadToDrive(localPath, filename);
        logger_js_1.logger.info({ filename, sizeKb, driveFileId }, 'Backup enviado ao Drive');
        await deleteOldDriveBackups();
    }
    catch (err) {
        status = 'error';
        errorMsg = err instanceof Error ? err.message : String(err);
        logger_js_1.logger.error({ err, filename }, 'Falha no backup');
    }
    finally {
        try {
            (0, fs_1.unlinkSync)(localPath);
        }
        catch { /* arquivo pode não existir se pg_dump falhou */ }
    }
    const log = await database_js_1.prisma.backupLog.create({
        data: { filename, sizeKb, driveFileId, status, errorMsg, triggeredBy },
    });
    if (status === 'error')
        throw Object.assign(new Error(errorMsg), { log });
    return log;
}
async function listBackups(page = 1, limit = 20) {
    const [total, data] = await Promise.all([
        database_js_1.prisma.backupLog.count(),
        database_js_1.prisma.backupLog.findMany({
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
    ]);
    return { data, total };
}
//# sourceMappingURL=backup.service.js.map