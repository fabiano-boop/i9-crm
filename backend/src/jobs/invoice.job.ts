/**
 * invoice.job.ts — Sprint 2
 *
 * Jobs diários de faturamento:
 *   - 07h: marcar faturas vencidas (PENDING → OVERDUE)
 *   - 08h: gerar faturas recorrentes do dia
 */

import { Queue, Worker } from 'bullmq'
import { isRedisAvailable, getRedis } from '../config/redis.js'
import { logger } from '../utils/logger.js'
import { generateMonthlyInvoices, markOverdueInvoices } from '../services/invoice.service.js'

let invoiceQueue: Queue | null = null

function getInvoiceQueue(): Queue {
  if (!invoiceQueue) {
    invoiceQueue = new Queue('invoice-queue', { connection: getRedis() })
    invoiceQueue.on('error', (err) => logger.warn({ err }, 'invoiceQueue error'))
  }
  return invoiceQueue
}

// ─── Cron schedulers ─────────────────────────────────────────────────────────

export async function scheduleInvoiceJobs(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) {
    logger.warn('Redis indisponível — invoice jobs desativados')
    return
  }

  try {
    const queue = getInvoiceQueue()

    // 07h todos os dias: marcar vencidas
    await queue.upsertJobScheduler(
      'invoice-overdue-cron',
      { pattern: '0 7 * * *' },
      { name: 'mark-overdue-invoices', data: {} },
    )

    // 08h todos os dias: gerar recorrentes do dia
    await queue.upsertJobScheduler(
      'invoice-recurring-cron',
      { pattern: '0 8 * * *' },
      { name: 'generate-monthly-invoices', data: {} },
    )

    logger.info('Invoice jobs agendados (overdue @07h, recurring @08h)')
  } catch (err) {
    logger.warn({ err }, 'Erro ao agendar invoice jobs')
  }
}

// ─── Workers ─────────────────────────────────────────────────────────────────

export async function startInvoiceWorkers(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) {
    logger.warn('Redis indisponível — invoice workers desativados')
    return
  }

  try {
    new Worker(
      'invoice-queue',
      async (job) => {
        if (job.name === 'mark-overdue-invoices') {
          const count = await markOverdueInvoices()
          logger.info({ count }, 'mark-overdue-invoices concluído')
          return { count }
        }

        if (job.name === 'generate-monthly-invoices') {
          const result = await generateMonthlyInvoices()
          logger.info(result, 'generate-monthly-invoices concluído')
          return result
        }

        logger.warn({ name: job.name }, 'invoice-queue: job desconhecido')
        return null
      },
      { connection: getRedis() },
    )
      .on('failed', (job, err) => logger.error({ jobId: job?.id, name: job?.name, err }, 'invoice-queue job falhou'))
      .on('error', (err) => logger.warn({ err }, 'invoice-queue worker error'))

    logger.info('Invoice workers iniciados')
  } catch (err) {
    logger.warn({ err }, 'Erro ao iniciar invoice workers')
  }
}
