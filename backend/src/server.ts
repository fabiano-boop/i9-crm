import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'
import { prisma } from './config/database.js'
import apiRouter from './routes/index.js'
import { scheduleDailySync, startSheetsWorker } from './jobs/sheetsSync.job.js'
import { scheduleBackupJob, startBackupWorker } from './jobs/backup.job.js'
import { scheduleCadenceJob, startCadenceWorker } from './jobs/cadence.job.js'
import { scheduleAlertJobs, startAlertWorkers } from './jobs/alerts.job.js'
import { initWebSocket } from './services/websocket.service.js'

const app = express()
const httpServer = createServer(app)

// Middlewares globais
app.use(helmet())
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting global (100 req/min por IP)
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }))

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV })
})

// Rotas da API
app.use('/api', apiRouter)

// Handler de erro global
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err, 'Unhandled error')
  res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' })
})

// Graceful shutdown
async function shutdown() {
  logger.info('Encerrando servidor...')
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Inicializa WebSocket no mesmo servidor HTTP
initWebSocket(httpServer)

httpServer.listen(env.PORT, () => {
  logger.info(`i9 CRM backend rodando na porta ${env.PORT}`)
  logger.info(`Ambiente: ${env.NODE_ENV}`)

  // Inicia workers e agendamentos (falham silenciosamente sem Redis)
  startSheetsWorker()
  scheduleDailySync()
  startBackupWorker()
  scheduleBackupJob()
  startCadenceWorker()
  scheduleCadenceJob()
  startAlertWorkers().catch((err) => logger.warn({ err }, 'Alert workers start falhou'))
  scheduleAlertJobs().catch((err) => logger.warn({ err }, 'Alert jobs schedule falhou'))
})

export { app, httpServer }
