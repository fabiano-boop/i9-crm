import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { getMetaAdsCampaignMetrics } from '../services/metaAds.service.js'

const router = Router()
router.use(requireAuth)

/**
 * GET /api/meta/ads-metrics
 * Retorna métricas de campanhas da Meta Marketing API:
 * spend, impressions, clicks, cpc, cpm, ctr, leads, cost_per_lead.
 * Query param: date_preset (padrão: last_30d)
 * Valores aceitos: today, yesterday, last_7d, last_14d, last_28d, last_30d, last_90d, this_month, last_month
 */
router.get('/ads-metrics', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const datePreset = typeof req.query.date_preset === 'string' ? req.query.date_preset : 'last_30d'
  const metrics = await getMetaAdsCampaignMetrics(datePreset)
  res.json(metrics)
}))

export default router
