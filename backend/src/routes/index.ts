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

export default router
