import { Queue, Worker } from 'bullmq'
import { isRedisAvailable, getRedis } from '../config/redis.js'
import { prisma } from '../config/database.js'
import { processStep } from '../services/cadence.service.js'
import { logger } from '../utils/logger.js'

const QUEUE_NAME = 'cadence'
let queue: Queue | null = null

export function getCadenceQueue(): Queue {
  if (!queue) queue = new Queue(QUEUE_NAME, { connection: getRedis() })
  return queue
}

export async function scheduleCadenceJob(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) {
    logger.warn('Redis indisponível — cadência automática desativada')
    return
  }
  try {
    const q = getCadenceQueue()
    for (const job of await q.getRepeatableJobs()) {
      if (job.name === 'cadence-check') await q.removeRepeatableByKey(job.key)
    }
    await q.add('cadence-check', {}, {
      repeat: { pattern: '0 * * * *' }, // a cada hora
      removeOnComplete: 5,
      removeOnFail: 5,
    })
    logger.info('Job de cadência agendado (a cada hora)')
  } catch (err) {
    logger.warn({ err }, 'Erro ao agendar job de cadência')
  }
}

export async function startCadenceWorker(): Promise<void> {
  const available = await isRedisAvailable()
  if (!available) return
  try {
    const worker = new Worker(
      QUEUE_NAME,
      async (job): Promise<{ queued: number } | void> => {
        if (job.name === 'cadence-check') {
          const due = await prisma.leadCadence.findMany({
            where: { status: 'active', nextActionAt: { lte: new Date() } },
            select: { id: true },
          })
          logger.info({ count: due.length }, 'Cadências vencidas encontradas')
          const q = getCadenceQueue()
          for (const { id } of due) {
            await q.add('process-step', { cadenceId: id }, {
              attempts: 3,
              backoff: { type: 'fixed', delay: 2 * 60 * 60 * 1000 }, // retry em 2h
              removeOnComplete: 20,
              removeOnFail: 10,
            })
          }
          return { queued: due.length }
        }

        if (job.name === 'process-step') {
          const { cadenceId } = job.data as { cadenceId: string }
          await processStep(cadenceId)
        }
      },
      {
        connection: getRedis(),
        limiter: { max: 30, duration: 60_000 }, // max 30 steps/min
      }
    )

    worker.on('failed', (job, err) => {
      logger.error({ jobName: job?.name, jobData: job?.data, err }, 'Cadência job falhou')
    })

    logger.info('Worker de cadência iniciado')
  } catch (err) {
    logger.warn({ err }, 'Erro ao iniciar worker de cadência')
  }
}
