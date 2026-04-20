import 'dotenv/config'
// build: 2026-04-20
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'
import { prisma } from './config/database.js'
import apiRouter from './routes/index.js'
import { startAllWorkers, scheduleAllJobs } from './jobs/index.js'
import { initWebSocket } from './services/websocket.service.js'
import { startDailyLeadScraperJob } from './jobs/dailyLeadScraper.job.js'

const app = express()
app.set('trust proxy', 1)
const httpServer = createServer(app)

// Health check — antes de qualquer middleware para garantir acesso irrestrito
// (probes do Railway enviam Origin do próprio domínio que não está na allowlist)
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV })
}
app.get('/health', healthHandler)
app.get('/api/health', healthHandler)

// Middlewares globais
app.use(helmet())
const allowedOrigins = env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean)
// Padrão de preview do Vercel para o projeto i9-crm-frontend
const vercelPreviewPattern = /^https:\/\/i9-crm-frontend-[a-z0-9]+-i9-solucoes-digitais\.vercel\.app$/
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman)
    if (!origin) return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    if (vercelPreviewPattern.test(origin)) return cb(null, true)
    cb(new Error(`CORS: origin not allowed — ${origin}`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting global (100 req/min por IP)
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }))

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

const PORT = Number(process.env.PORT) || 3000

httpServer.listen(PORT, () => {
  logger.info(`i9 CRM backend rodando na porta ${PORT}`)
  logger.info(`Ambiente: ${env.NODE_ENV}`)

  // Inicia workers e agendamentos (falham silenciosamente sem Redis)
  startAllWorkers().catch((err) => logger.warn({ err }, 'startAllWorkers falhou'))
  scheduleAllJobs().catch((err) => logger.warn({ err }, 'scheduleAllJobs falhou'))

  // Scraper diário de leads (node-cron)
  startDailyLeadScraperJob()
})

export { app, httpServer }
