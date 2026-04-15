import { Queue, Worker } from 'bullmq'
import { isRedisAvailable, getRedis } from '../config/redis.js'
import { syncFromSheets } from '../services/sheets.service.js'
import { logger } from '../utils/logger.js'

const QUEUE_NAME = 'sheets-sync'
let queue: Queue | null = null

export function getSheetsQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: getRedis() })
  }
  return queue
}

export async function scheduleDailySync(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) {
    logger.warn('Redis indisponível — sync automático diário desativado (sync manual via /api/sheets/sync ainda funciona)')
    return
  }

  try {
    const q = getSheetsQueue()
    const repeatableJobs = await q.getRepeatableJobs()
    for (const job of repeatableJobs) {
      if (job.name === 'daily-sync') await q.removeRepeatableByKey(job.key)
    }
    await q.add('daily-sync', {}, {
      repeat: { pattern: '0 7 * * *' },
      removeOnComplete: 10,
      removeOnFail: 5,
    })
    logger.info('Job de sync diário agendado para 07h00 (BullMQ)')
  } catch (err) {
    logger.warn({ err }, 'Erro ao agendar sync diário')
  }
}

export async function startSheetsWorker(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) return

  try {
    const worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        logger.info({ jobId: job.id }, 'Iniciando sync Sheets via job')
        return syncFromSheets()
      },
      { connection: getRedis() }
    )
    worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Sync job falhou'))
    logger.info('Worker sheets-sync iniciado')
  } catch (err) {
    logger.warn({ err }, 'Erro ao iniciar worker')
  }
}
