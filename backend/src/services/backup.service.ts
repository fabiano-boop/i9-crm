import { spawn } from 'child_process'
import { createReadStream, createWriteStream, statSync, unlinkSync } from 'fs'
import { createGzip } from 'zlib'
import { tmpdir } from 'os'
import { join } from 'path'
import { google } from 'googleapis'
import { prisma } from '../config/database.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import type { BackupLog } from '@prisma/client'

function getDriveAuth() {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado')
  }
  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON) as object
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })
}

function pgDumpToFile(localPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dbUrl = env.DIRECT_URL ?? env.DATABASE_URL
    const pgDump = spawn('pg_dump', ['--dbname', dbUrl, '--format=plain', '--no-password'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const gzip   = createGzip()
    const output = createWriteStream(localPath)

    pgDump.stderr.on('data', (chunk: Buffer) => {
      const msg = chunk.toString()
      if (!msg.toLowerCase().includes('warning')) {
        logger.warn({ stderr: msg }, 'pg_dump stderr')
      }
    })

    pgDump.on('error', (err) =>
      reject(new Error(`pg_dump não encontrado ou falhou: ${err.message}`))
    )

    output.on('finish', resolve)
    output.on('error', reject)

    pgDump.stdout.pipe(gzip).pipe(output)
  })
}

async function uploadToDrive(localPath: string, filename: string): Promise<string> {
  if (!env.BACKUP_GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error('BACKUP_GOOGLE_DRIVE_FOLDER_ID não configurado')
  }
  const drive = google.drive({ version: 'v3', auth: getDriveAuth() })
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [env.BACKUP_GOOGLE_DRIVE_FOLDER_ID] },
    media: { mimeType: 'application/gzip', body: createReadStream(localPath) },
  })
  return res.data.id!
}

async function deleteOldDriveBackups(): Promise<void> {
  if (!env.BACKUP_GOOGLE_DRIVE_FOLDER_ID) return
  const drive  = google.drive({ version: 'v3', auth: getDriveAuth() })
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - env.BACKUP_RETENTION_DAYS)

  const res = await drive.files.list({
    q: `'${env.BACKUP_GOOGLE_DRIVE_FOLDER_ID}' in parents and createdTime < '${cutoff.toISOString()}' and trashed = false`,
    fields: 'files(id, name)',
  })

  for (const file of res.data.files ?? []) {
    await drive.files.delete({ fileId: file.id! })
    logger.info({ fileId: file.id, name: file.name }, 'Backup antigo deletado do Drive')
  }
}

export async function runBackup(triggeredBy = 'auto'): Promise<BackupLog> {
  const ts        = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
  const filename  = `i9crm-${ts}.sql.gz`
  const localPath = join(tmpdir(), filename)

  let driveFileId: string | null = null
  let status   = 'success'
  let errorMsg: string | null = null
  let sizeKb   = 0

  try {
    logger.info({ filename }, 'Iniciando backup')
    await pgDumpToFile(localPath)

    sizeKb      = Math.ceil(statSync(localPath).size / 1024)
    driveFileId = await uploadToDrive(localPath, filename)
    logger.info({ filename, sizeKb, driveFileId }, 'Backup enviado ao Drive')

    await deleteOldDriveBackups()
  } catch (err) {
    status   = 'error'
    errorMsg = err instanceof Error ? err.message : String(err)
    logger.error({ err, filename }, 'Falha no backup')
  } finally {
    try { unlinkSync(localPath) } catch { /* arquivo pode não existir se pg_dump falhou */ }
  }

  const log = await prisma.backupLog.create({
    data: { filename, sizeKb, driveFileId, status, errorMsg, triggeredBy },
  })

  if (status === 'error') throw Object.assign(new Error(errorMsg!), { log })
  return log
}

export async function listBackups(
  page  = 1,
  limit = 20
): Promise<{ data: BackupLog[]; total: number }> {
  const [total, data] = await Promise.all([
    prisma.backupLog.count(),
    prisma.backupLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return { data, total }
}
