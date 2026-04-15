import { Queue, Worker } from 'bullmq'
import { Resend } from 'resend'
import { isRedisAvailable, getRedis } from '../config/redis.js'
import { runBackup } from '../services/backup.service.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const QUEUE_NAME = 'backup'
let queue: Queue | null = null

export function getBackupQueue(): Queue {
  if (!queue) queue = new Queue(QUEUE_NAME, { connection: getRedis() })
  return queue
}

export async function scheduleBackupJob(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) {
    logger.warn('Redis indisponível — backup automático desativado')
    return
  }
  try {
    const q = getBackupQueue()
    for (const job of await q.getRepeatableJobs()) {
      if (job.name === 'daily-backup') await q.removeRepeatableByKey(job.key)
    }
    await q.add('daily-backup', {}, {
      repeat: { pattern: '0 2 * * *' },
      removeOnComplete: 10,
      removeOnFail: 5,
    })
    logger.info('Job de backup agendado para 02h00 (BullMQ)')
  } catch (err) {
    logger.warn({ err }, 'Erro ao agendar backup')
  }
}

export async function startBackupWorker(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) return
  try {
    const worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        logger.info({ jobId: job.id }, 'Executando backup automático')
        return runBackup('auto')
      },
      { connection: getRedis() }
    )

    worker.on('failed', async (_job, err) => {
      logger.error({ err }, 'Backup automático falhou')
      if (env.ADMIN_EMAIL && env.RESEND_API_KEY) {
        try {
          const resend = new Resend(env.RESEND_API_KEY)
          await resend.emails.send({
            from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
            to: env.ADMIN_EMAIL,
            subject: '[i9 CRM] Falha no backup automático',
            html: `<p>O backup automático falhou em <strong>${new Date().toLocaleString('pt-BR')}</strong>.</p><p>Erro: ${err.message}</p>`,
          })
        } catch (emailErr) {
          logger.error({ emailErr }, 'Falha ao enviar alerta de backup')
        }
      }
    })

    logger.info('Worker backup iniciado')
  } catch (err) {
    logger.warn({ err }, 'Erro ao iniciar worker de backup')
  }
}
