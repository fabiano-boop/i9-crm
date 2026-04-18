import { Queue, Worker } from 'bullmq'
import { isRedisAvailable, getRedis } from '../config/redis.js'
import { logger } from '../utils/logger.js'
import {
  generateWeeklyReportsForAllClients,
  sendPendingWeeklyReports,
} from '../services/weeklyClientReport.service.js'

// ─── Lazy queue getters ───────────────────────────────────────────────────────

let generateQueue: Queue | null = null
let sendQueue: Queue | null = null

function getGenerateQueue(): Queue {
  if (!generateQueue) {
    generateQueue = new Queue('weekly-report-generate', { connection: getRedis() })
    generateQueue.on('error', (err) => logger.warn({ err }, 'weeklyReport generateQueue error'))
  }
  return generateQueue
}

function getSendQueue(): Queue {
  if (!sendQueue) {
    sendQueue = new Queue('weekly-report-send', { connection: getRedis() })
    sendQueue.on('error', (err) => logger.warn({ err }, 'weeklyReport sendQueue error'))
  }
  return sendQueue
}

// ─── Cron schedulers ─────────────────────────────────────────────────────────

export async function scheduleWeeklyReportJobs(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) {
    logger.warn('Redis indisponível — weekly report jobs desativados')
    return
  }

  try {
    // Sexta às 18h: gerar relatórios
    await getGenerateQueue().upsertJobScheduler(
      'weekly-report-generate-cron',
      { pattern: '0 18 * * 5' },
      { name: 'generate-weekly-reports', data: {} },
    )

    // Sábado às 09h: enviar relatórios gerados
    await getSendQueue().upsertJobScheduler(
      'weekly-report-send-cron',
      { pattern: '0 9 * * 6' },
      { name: 'send-weekly-reports', data: {} },
    )

    logger.info('Weekly report jobs agendados (gerar @sex-18h, enviar @sab-09h)')
  } catch (err) {
    logger.warn({ err }, 'Erro ao agendar weekly report jobs')
  }
}

// ─── Workers ─────────────────────────────────────────────────────────────────

export async function startWeeklyReportWorkers(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) {
    logger.warn('Redis indisponível — weekly report workers desativados')
    return
  }

  try {
    new Worker(
      'weekly-report-generate',
      async (): Promise<{ generated: number; errors: number }> => {
        const result = await generateWeeklyReportsForAllClients()
        logger.info(result, 'weekly-report-generate job concluído')
        return result
      },
      { connection: getRedis() },
    )
      .on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'weekly-report-generate job falhou'))
      .on('error', (err) => logger.warn({ err }, 'weekly-report-generate worker error'))

    new Worker(
      'weekly-report-send',
      async (): Promise<{ sent: number; errors: number }> => {
        const result = await sendPendingWeeklyReports()
        logger.info(result, 'weekly-report-send job concluído')
        return result
      },
      { connection: getRedis() },
    )
      .on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'weekly-report-send job falhou'))
      .on('error', (err) => logger.warn({ err }, 'weekly-report-send worker error'))

    logger.info('Weekly report workers iniciados')
  } catch (err) {
    logger.warn({ err }, 'Erro ao iniciar weekly report workers')
  }
}
