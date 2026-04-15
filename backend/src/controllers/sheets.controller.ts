import { Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { syncFromSheets } from '../services/sheets.service.js'
import { getSheetsQueue } from '../jobs/sheetsSync.job.js'
import { logger } from '../utils/logger.js'

// POST /api/sheets/sync — dispara sync manual
export async function triggerSync(_req: Request, res: Response): Promise<void> {
  if (!process.env['GOOGLE_SHEETS_ID'] || !process.env['GOOGLE_SERVICE_ACCOUNT_JSON'] ||
      process.env['GOOGLE_SERVICE_ACCOUNT_JSON'] === '{"type":"service_account","project_id":"..."}') {
    res.status(503).json({
      error: 'Google Sheets não configurado',
      code: 'SHEETS_NOT_CONFIGURED',
      hint: 'Configure GOOGLE_SHEETS_ID e GOOGLE_SERVICE_ACCOUNT_JSON no .env',
    })
    return
  }

  logger.info('Sync manual do Google Sheets solicitado')

  try {
    const result = await syncFromSheets()
    res.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ err }, 'Erro no sync manual')
    res.status(500).json({ error: message, code: 'SYNC_ERROR' })
  }
}

// GET /api/sheets/sync-history
export async function getSyncHistory(_req: Request, res: Response): Promise<void> {
  const history = await prisma.sheetSync.findMany({
    orderBy: { syncedAt: 'desc' },
    take: 20,
  })
  res.json(history)
}

// GET /api/sheets/queue-status
export async function getQueueStatus(_req: Request, res: Response): Promise<void> {
  try {
    const q = getSheetsQueue()
    const [waiting, active, completed, failed, repeatableJobs] = await Promise.all([
      q.getWaitingCount(),
      q.getActiveCount(),
      q.getCompletedCount(),
      q.getFailedCount(),
      q.getRepeatableJobs(),
    ])
    res.json({ waiting, active, completed, failed, scheduledJobs: repeatableJobs.length })
  } catch {
    res.json({ status: 'Redis indisponível — filas desativadas' })
  }
}
