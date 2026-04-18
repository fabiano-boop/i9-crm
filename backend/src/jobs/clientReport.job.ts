/**
 * Jobs de relatório semanal de clientes.
 *
 * Queue: "report-queue"
 *   - generate-weekly-reports  → cron sex 18h (bulk)
 *   - send-weekly-reports      → cron sab 09h (bulk)
 *   - generate-report-manual   → disparado via endpoint com prioridade máxima
 *
 * Configurações:
 *   - concurrency: 2  (Puppeteer é CPU/memória intensivo)
 *   - limiter: max 5 jobs/min
 *   - retry: 3 tentativas com backoff fixo de 1h
 */

import { Queue, Worker } from 'bullmq'
import { isRedisAvailable, getRedis } from '../config/redis.js'
import { prisma } from '../config/database.js'
import { logger } from '../utils/logger.js'
import { generateReport, sendReport, generateWeeklyReportsForAllClients, sendPendingWeeklyReports } from '../services/weeklyClientReport.service.js'

// ─── Lazy queue getter ────────────────────────────────────────────────────────

let reportQueue: Queue | null = null

export function getReportQueue(): Queue {
  if (!reportQueue) {
    reportQueue = new Queue('report-queue', { connection: getRedis() })
    reportQueue.on('error', (err) => logger.warn({ err }, 'reportQueue error'))
  }
  return reportQueue
}

// ─── Job payload types ────────────────────────────────────────────────────────

interface GenerateManualPayload {
  clientId: string
  weekStart: string // ISO string
}

interface SendReportPayload {
  reportId: string
  channels?: ('email' | 'whatsapp')[]
}

// ─── Enfileirar geração manual (prioridade máxima = 1) ───────────────────────

export async function enqueueManualReport(clientId: string, weekStart: Date): Promise<string> {
  const queue = getReportQueue()
  const job = await queue.add(
    'generate-report-manual',
    { clientId, weekStart: weekStart.toISOString() } satisfies GenerateManualPayload,
    {
      priority: 1,
      attempts: 3,
      backoff: { type: 'fixed', delay: 3_600_000 }, // 1h
    },
  )
  logger.info({ jobId: job.id, clientId }, 'Job de relatório manual enfileirado')
  return job.id ?? clientId
}

// ─── Enfileirar envio de relatório ───────────────────────────────────────────

export async function enqueueSendReport(
  reportId: string,
  channels: ('email' | 'whatsapp')[] = ['email', 'whatsapp'],
): Promise<void> {
  const queue = getReportQueue()
  await queue.add(
    'send-report',
    { reportId, channels } satisfies SendReportPayload,
    {
      attempts: 3,
      backoff: { type: 'fixed', delay: 3_600_000 },
    },
  )
}

// ─── Cron schedulers ─────────────────────────────────────────────────────────

export async function scheduleClientReportJobs(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) {
    logger.warn('Redis indisponível — client report jobs desativados')
    return
  }

  try {
    const queue = getReportQueue()

    // Sexta às 18h — geração bulk de relatórios
    await queue.upsertJobScheduler(
      'client-report-generate-cron',
      { pattern: '0 18 * * 5' },
      { name: 'generate-weekly-reports', data: {} },
    )

    // Sábado às 09h — envio bulk
    await queue.upsertJobScheduler(
      'client-report-send-cron',
      { pattern: '0 9 * * 6' },
      { name: 'send-weekly-reports', data: {} },
    )

    logger.info('Client report jobs agendados (gerar @sex-18h, enviar @sab-09h)')
  } catch (err) {
    logger.warn({ err }, 'Erro ao agendar client report jobs')
  }
}

// ─── Workers ─────────────────────────────────────────────────────────────────

export async function startClientReportWorkers(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) {
    logger.warn('Redis indisponível — client report workers desativados')
    return
  }

  try {
    new Worker<GenerateManualPayload | Record<string, never>, unknown>(
      'report-queue',
      async (job) => {
        const { name, data } = job

        // ── Geração bulk (cron) ────────────────────────────────────────────
        if (name === 'generate-weekly-reports') {
          const result = await generateWeeklyReportsForAllClients()
          logger.info(result, 'generate-weekly-reports job concluído')
          return result
        }

        // ── Envio bulk (cron) ──────────────────────────────────────────────
        if (name === 'send-weekly-reports') {
          const result = await sendPendingWeeklyReports()
          logger.info(result, 'send-weekly-reports job concluído')
          return result
        }

        // ── Geração manual (prioridade máxima) ────────────────────────────
        if (name === 'generate-report-manual') {
          const { clientId, weekStart } = data as GenerateManualPayload
          const report = await generateReport(clientId, new Date(weekStart))
          logger.info({ reportId: report.id, clientId }, 'generate-report-manual concluído')
          return { reportId: report.id }
        }

        // ── Envio individual ──────────────────────────────────────────────
        if (name === 'send-report') {
          const { reportId } = data as unknown as SendReportPayload
          await sendReport(reportId)
          logger.info({ reportId }, 'send-report job concluído')
          return { reportId }
        }

        logger.warn({ name }, 'report-queue: job desconhecido')
        return null
      },
      {
        connection: getRedis(),
        concurrency: 2, // Puppeteer limita paralelismo
        limiter: {
          max: 5,
          duration: 60_000, // máx 5 jobs/min
        },
      },
    )
      .on('failed', async (job, err) => {
        logger.error({ jobId: job?.id, name: job?.name, err }, 'report-queue job falhou')

        // Criar alerta para o admin quando job falhar após todas as tentativas
        if (job && (job.attemptsMade ?? 0) >= (job.opts.attempts ?? 1)) {
          try {
            const adminLead = await prisma.lead.findFirst({ orderBy: { importedAt: 'desc' } })
            if (adminLead) {
              await prisma.opportunityAlert.create({
                data: {
                  leadId: adminLead.id,
                  type: 'report_job_failed',
                  title: `Falha no job de relatório: ${job.name}`,
                  description: `Job ${job.id} falhou após ${job.attemptsMade} tentativas: ${err instanceof Error ? err.message : String(err)}`,
                  urgency: 8,
                },
              })
            }
          } catch (alertErr) {
            logger.warn({ alertErr }, 'Não foi possível criar alerta de falha de job')
          }
        }
      })
      .on('error', (err) => logger.warn({ err }, 'report-queue worker error'))

    logger.info('Client report workers iniciados (concurrency=2, limiter=5/min)')
  } catch (err) {
    logger.warn({ err }, 'Erro ao iniciar client report workers')
  }
}
