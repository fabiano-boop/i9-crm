import { Redis } from 'ioredis'
import { env } from './env.js'
import { logger } from '../utils/logger.js'

let redisInstance: Redis | null = null
let redisAvailable = false

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null, // não reconecta — falha silenciosamente
    })
    redisInstance.on('error', () => {
      // Silencia erros de conexão — Redis é opcional
    })
    redisInstance.on('connect', () => {
      redisAvailable = true
      logger.info('Redis conectado — filas BullMQ ativas')
    })
  }
  return redisInstance
}

export async function isRedisAvailable(): Promise<boolean> {
  try {
    const r = getRedis()
    await r.connect().catch(() => null)
    const pong = await r.ping().catch(() => null)
    redisAvailable = pong === 'PONG'
  } catch {
    redisAvailable = false
  }
  return redisAvailable
}

export { redisAvailable }
