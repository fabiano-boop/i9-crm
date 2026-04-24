import { Queue, Worker } from 'bullmq'
import { isRedisAvailable, getRedis } from '../config/redis.js'
import { logger } from '../utils/logger.js'
import {
  checkHotEngagement,
  checkCoolingLeads,
  checkNoContactWeek,
  generateMorningDigest,
} from '../services/opportunityAlert.service.js'
import { prisma } from '../config/database.js'

// ─── Lazy Queue getters (não cria instâncias no nível de módulo) ──────────────

let engagementQueue: Queue | null = null
let coolingQueue: Queue | null = null
let digestQueue: Queue | null = null

function getEngagementQueue(): Queue {
  if (!engagementQueue) {
    engagementQueue = new Queue('alert-check-engagement', { connection: getRedis() })
    engagementQueue.on('error', (err) => logger.warn({ err }, 'engagementQueue error'))
  }
  return engagementQueue
}

function getCoolingQueue(): Queue {
  if (!coolingQueue) {
    coolingQueue = new Queue('alert-check-cooling', { connection: getRedis() })
    coolingQueue.on('error', (err) => logger.warn({ err }, 'coolingQueue error'))
  }
  return coolingQueue
}

function getDigestQueue(): Queue {
  if (!digestQueue) {
    digestQueue = new Queue('morning-digest', { connection: getRedis() })
    digestQueue.on('error', (err) => logger.warn({ err }, 'digestQueue error'))
  }
  return digestQueue
}

// ─── Cron schedulers ─────────────────────────────────────────────────────────

export async function scheduleAlertJobs(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) {
    logger.warn('Redis indisponível — alert jobs desativados')
    return
  }

  try {
    await getEngagementQueue().upsertJobScheduler(
      'alert-engagement-cron',
      { pattern: '0 * * * *' },
      { name: 'check-engagement', data: {} },
    )

    await getCoolingQueue().upsertJobScheduler(
      'alert-cooling-cron',
      { pattern: '0 9 * * *' },
      { name: 'check-cooling', data: {} },
    )

    await getDigestQueue().upsertJobScheduler(
      'morning-digest-cron',
      { pattern: '0 8 * * 1-6' },
      { name: 'morning-digest', data: {} },
    )

    // SPRINT 2: checar faturas vencidas diariamente às 09h30
    await getCoolingQueue().upsertJobScheduler(
      'alert-overdue-invoices-cron',
      { pattern: '30 9 * * *' },
      { name: 'check-overdue-invoices', data: {} },
    )

    logger.info('Alert jobs agendados (engagement @hourly, cooling @09h, digest @08h seg-sáb, overdue-invoices @09h30)')
  } catch (err) {
    logger.warn({ err }, 'Erro ao agendar alert jobs')
  }
}

// ─── Workers ─────────────────────────────────────────────────────────────────

export async function startAlertWorkers(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) {
    logger.warn('Redis indisponível — alert workers desativados')
    return
  }

  try {
    new Worker(
      'alert-check-engagement',
      async (): Promise<{ checked: number; created: number }> => {
        const oneHourAgo = new Date()
        oneHourAgo.setHours(oneHourAgo.getHours() - 1)

        const recentLeads = await prisma.trackingEvent.findMany({
          where: { createdAt: { gte: oneHourAgo } },
          select: { leadId: true },
          distinct: ['leadId'],
        })

        let created = 0
        for (const { leadId } of recentLeads) {
          const alert = await checkHotEngagement(leadId)
          if (alert) created++
        }

        logger.info({ checked: recentLeads.length, created }, 'alert-check-engagement concluído')
        return { checked: recentLeads.length, created }
      },
      { connection: getRedis() },
    )
      .on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'alert-check-engagement job falhou'))
      .on('error', (err) => logger.warn({ err }, 'alert-check-engagement worker error'))

    new Worker(
      'alert-check-cooling',
      async (): Promise<{ coolingCount: number; noContactCount: number }> => {
        const [coolingCount, noContactCount] = await Promise.all([
          checkCoolingLeads(),
          checkNoContactWeek(),
        ])
        logger.info({ coolingCount, noContactCount }, 'alert-check-cooling concluído')
        return { coolingCount, noContactCount }
      },
      { connection: getRedis() },
    )
      .on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'alert-check-cooling job falhou'))
      .on('error', (err) => logger.warn({ err }, 'alert-check-cooling worker error'))

    new Worker(
      'morning-digest',
      async (): Promise<void> => {
        await generateMorningDigest()
        logger.info('morning-digest job concluído')
      },
      { connection: getRedis() },
    )
      .on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'morning-digest job falhou'))
      .on('error', (err) => logger.warn({ err }, 'morning-digest worker error'))

    // SPRINT 2: alertas de faturas vencidas via alert-check-cooling worker
    // (reutiliza a mesma fila cooling para não criar novo worker)
    logger.info('Alert workers iniciados')
  } catch (err) {
    logger.warn({ err }, 'Erro ao iniciar alert workers')
  }
}

