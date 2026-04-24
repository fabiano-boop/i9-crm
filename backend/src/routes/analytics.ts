import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { prisma } from '../config/database.js'

const router = Router()
router.use(requireAuth)

/**
 * GET /api/analytics/dashboard
 * Retorna métricas consolidadas: leads, pipeline, campanhas, interações.
 */
router.get('/dashboard', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalLeads,
    leadsByClassification,
    leadsByStatus,
    leadsByPipelineStage,
    leadsLast7,
    leadsLast30,
    totalCampaigns,
    campaignsByStatus,
    interactionsLast7,
    topNeighborhoods,
    topNiches,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ['classification'], _count: { id: true } }),
    prisma.lead.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.lead.groupBy({ by: ['pipelineStage'], _count: { id: true } }),
    prisma.lead.count({ where: { importedAt: { gte: sevenDaysAgo } } }),
    prisma.lead.count({ where: { importedAt: { gte: thirtyDaysAgo } } }),
    prisma.campaign.count(),
    prisma.campaign.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.interaction.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.lead.groupBy({
      by: ['neighborhood'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
    prisma.lead.groupBy({
      by: ['niche'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
  ])

  const classMap = Object.fromEntries(
    leadsByClassification.map((r) => [r.classification, r._count.id])
  )
  const statusMap = Object.fromEntries(
    leadsByStatus.map((r) => [r.status, r._count.id])
  )
  const pipelineStageMap = Object.fromEntries(
    leadsByPipelineStage.map((r) => [r.pipelineStage ?? 'new', r._count.id])
  )
  const campaignMap = Object.fromEntries(
    campaignsByStatus.map((r) => [r.status, r._count.id])
  )

  res.json({
    leads: {
      total: totalLeads,
      last7Days: leadsLast7,
      last30Days: leadsLast30,
      byClassification: {
        HOT: classMap['HOT'] ?? 0,
        WARM: classMap['WARM'] ?? 0,
        COLD: classMap['COLD'] ?? 0,
      },
      byStatus: statusMap,
      byPipelineStage: pipelineStageMap,
    },
    campaigns: {
      total: totalCampaigns,
      byStatus: campaignMap,
    },
    interactions: {
      last7Days: interactionsLast7,
    },
    topNeighborhoods: topNeighborhoods.map((r) => ({
      neighborhood: r.neighborhood,
      count: r._count.id,
    })),
    topNiches: topNiches.map((r) => ({
      niche: r.niche,
      count: r._count.id,
    })),
    generatedAt: now.toISOString(),
  })
}))

/**
 * GET /api/analytics/financial
 * SPRINT 1: Retorna métricas financeiras reais por cliente.
 * Inclui receita, custo interno, lucro e margem — alimenta o Dashboard.
 */
router.get('/financial', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const clients = await prisma.client.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      businessName: true,
      monthlyValue: true,
      internalCost: true,
      package: true,
      niche: true,
      startDate: true,
    },
    orderBy: { monthlyValue: 'desc' },
  })

  const totalRevenue  = clients.reduce((s, c) => s + (c.monthlyValue  ?? 0), 0)
  const totalCost     = clients.reduce((s, c) => s + (c.internalCost  ?? 0), 0)
  const totalProfit   = totalRevenue - totalCost
  const avgMargin     = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

  const clientDetails = clients.map(c => {
    const revenue = c.monthlyValue  ?? 0
    const cost    = c.internalCost  ?? 0
    const profit  = revenue - cost
    const margin  = revenue > 0 ? (profit / revenue) * 100 : 0
    return { ...c, revenue, cost, profit, margin: parseFloat(margin.toFixed(1)) }
  })

  res.json({
    summary: {
      totalRevenue,
      totalCost,
      totalProfit,
      avgMargin: parseFloat(avgMargin.toFixed(1)),
      activeClients: clients.length,
    },
    clients: clientDetails,
    generatedAt: new Date().toISOString(),
  })
}))

export default router
