import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { prisma } from '../config/database.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import * as ga4 from '../services/ga4.service.js'

const router = Router()

// ─── GA4 OAuth2 callback — per-client (sem JWT) ───────────────────────────────
router.get('/ga4/callback', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const code    = req.query['code']  as string | undefined
  const state   = req.query['state'] as string | undefined
  const error   = req.query['error'] as string | undefined
  const frontendUrl = env.FRONTEND_URL.split(',')[0].trim()

  if (error || !code || !state) {
    logger.warn({ error, state }, 'GA4 callback: erro ou parâmetros ausentes')
    res.redirect(`${frontendUrl}/clients/${state ?? ''}?ga4=error`)
    return
  }

  try {
    await ga4.handleCallback(code, state)
    res.redirect(`${frontendUrl}/clients/${state}?ga4=connected`)
  } catch (err) {
    logger.error({ err, state }, 'GA4 callback: falha ao trocar código por tokens')
    res.redirect(`${frontendUrl}/clients/${state}?ga4=error`)
  }
}))

// ─── GA4 OAuth2 callback — agência (sem JWT) ──────────────────────────────────
router.get('/ga4/agency-callback', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const code  = req.query['code']  as string | undefined
  const error = req.query['error'] as string | undefined
  const frontendUrl = env.FRONTEND_URL.split(',')[0].trim()

  if (error || !code) {
    logger.warn({ error }, 'GA4 agency callback: erro ou code ausente')
    res.redirect(`${frontendUrl}/settings?ga4_agency=error`)
    return
  }

  try {
    await ga4.handleAgencyCallback(code)
    res.redirect(`${frontendUrl}/settings?ga4_agency=connected`)
  } catch (err) {
    logger.error({ err }, 'GA4 agency callback: falha ao salvar tokens')
    res.redirect(`${frontendUrl}/settings?ga4_agency=error`)
  }
}))

// Todas as rotas abaixo exigem JWT
router.use(requireAuth)

// GET /api/integrations/ga4/auth/:clientId → { authUrl }
router.get('/ga4/auth/:clientId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const clientId = req.params['clientId'] as string
  const authUrl = ga4.getAuthUrl(clientId)
  res.json({ authUrl })
}))

// PUT /api/integrations/ga4/property/:clientId — salva Property ID e Search Console URL
router.put('/ga4/property/:clientId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const clientId = req.params['clientId'] as string
  const { propertyId, searchConsoleUrl } = req.body as { propertyId?: string; searchConsoleUrl?: string }
  await prisma.client.update({
    where: { id: clientId },
    data: {
      ...(propertyId        !== undefined && { ga4PropertyId:    propertyId }),
      ...(searchConsoleUrl  !== undefined && { searchConsoleUrl: searchConsoleUrl }),
    },
  })
  res.json({ ok: true })
}))

// GET /api/integrations/ga4/metrics/:clientId → Ga4Metrics
router.get('/ga4/metrics/:clientId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const clientId = req.params['clientId'] as string
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const end   = now.toISOString().slice(0, 10)
  const metrics = await ga4.getMetrics(clientId, start, end)
  res.json(metrics)
}))

// GET /api/integrations/search-console/metrics/:clientId → SearchConsoleMetrics
router.get('/search-console/metrics/:clientId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const clientId = req.params['clientId'] as string
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const end   = now.toISOString().slice(0, 10)
  const metrics = await ga4.getSearchConsoleMetrics(clientId, start, end)
  res.json(metrics)
}))

// ─── Rotas de Agência (devem vir ANTES do wildcard /ga4/:clientId) ────────────

// GET /api/integrations/ga4/agency-auth → { authUrl }
router.get('/ga4/agency-auth', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const authUrl = ga4.getAgencyAuthUrl()
  res.json({ authUrl })
}))

// GET /api/integrations/ga4/agency-metrics → AgencyGa4Metrics
router.get('/ga4/agency-metrics', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  try {
    const metrics = await ga4.getAgencyMetrics()
    res.json(metrics)
  } catch (err: any) {
    const msg: string = err?.message ?? ''
    if (msg.includes('não configurado') || msg.includes('não conectado')) {
      res.status(400).json({ error: msg, code: 'GA4_NOT_CONFIGURED' })
      return
    }
    throw err
  }
}))

// DELETE /api/integrations/ga4/agency → desconectar agência
router.delete('/ga4/agency', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  await ga4.disconnectAgency()
  res.json({ ok: true })
}))

// DELETE /api/integrations/ga4/:clientId → desconectar cliente
router.delete('/ga4/:clientId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const clientId = req.params['clientId'] as string
  await ga4.disconnect(clientId)
  res.json({ ok: true })
}))

export default router
