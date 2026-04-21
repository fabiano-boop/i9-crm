import { Router } from 'express'
import authRouter from './auth.js'
import leadsRouter from './leads.js'
import sheetsRouter from './sheets.js'
import campaignsRouter from './campaigns.js'
import trackingRouter from './tracking.js'
import adminRouter from './admin.js'
import cadencesRouter from './cadences.js'
import alertsRouter from './alerts.js'
import webhooksRouter from './webhooks.js'
import agentRouter from './agent.js'
import setupRouter from './setup.js'
import clientsRouter from './clients.js'
import reportsRouter from './reports.js'
import analyticsRouter from './analytics.js'
import whatsappRouter from './whatsapp.js'

const router = Router()

router.use('/auth', authRouter)
router.use('/leads', leadsRouter)
router.use('/sheets', sheetsRouter)
router.use('/campaigns', campaignsRouter)
router.use('/tracking', trackingRouter)
router.use('/admin', adminRouter)
router.use('/cadences', cadencesRouter)
router.use('/alerts', alertsRouter)
router.use('/webhooks', webhooksRouter) // Evolution API webhooks (sem JWT)
router.use('/agent', agentRouter)       // Gerenciamento do agente Maya
router.use('/setup', setupRouter)       // TEMPORÁRIO — remover após setup inicial
router.use('/clients', clientsRouter)   // Clientes ativos + relatórios semanais
router.use('/reports', reportsRouter)   // Ações diretas sobre relatórios
router.use('/analytics', analyticsRouter) // Dashboard de métricas
router.use('/whatsapp', whatsappRouter)   // Status da conexão WhatsApp

// ROTA DE TESTE — scraper manual
router.get('/scraper/test', async (_req, res) => {
  try {
    const { runLeadScraper } = await import('../services/leadScraper.service.js')
    res.json({ status: 'iniciado', message: 'Scraper rodando em background' })
    await runLeadScraper()
  } catch (err: any) {
    res.status(500).json({ status: 'erro', message: err.message })
  }
})

export default router
