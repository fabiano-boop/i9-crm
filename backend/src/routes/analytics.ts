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

/**
 * GET /api/analytics/saas
 * SPRINT 3.3: Métricas SaaS — MRR, Churn Rate, LTV e NRR do mês atual.
 * NRR = (mrrStart + expansionMrr - contractionMrr - churnedMrr) / mrrStart * 100
 */
router.get('/saas', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [activeClients, clientsAtMonthStart, churnedThisMonth] = await Promise.all([
    prisma.client.findMany({
      where: { status: 'active' },
      select: { monthlyValue: true },
    }),
    // Clientes ativos no início do mês corrente (existiam antes e não cancelaram antes)
    prisma.client.findMany({
      where: {
        startDate: { lt: currentMonthStart },
        OR: [{ cancelledAt: null }, { cancelledAt: { gte: currentMonthStart } }],
      },
      select: { monthlyValue: true },
    }),
    // Clientes que churned neste mês
    prisma.client.findMany({
      where: { status: 'churned', cancelledAt: { gte: currentMonthStart } },
      select: { monthlyValue: true },
    }),
  ])

  const mrr        = activeClients.reduce((s, c) => s + (c.monthlyValue ?? 0), 0)
  const mrrStart   = clientsAtMonthStart.reduce((s, c) => s + (c.monthlyValue ?? 0), 0)
  const churnedMrr = churnedThisMonth.reduce((s, c) => s + (c.monthlyValue ?? 0), 0)

  // Expansion e contraction não são rastreados (campo único monthlyValue sem histórico)
  const expansionMrr    = 0
  const contractionMrr  = 0

  const nrr = mrrStart > 0
    ? parseFloat(((mrrStart + expansionMrr - contractionMrr - churnedMrr) / mrrStart * 100).toFixed(1))
    : 100

  const churnRate = mrrStart > 0
    ? parseFloat((churnedMrr / mrrStart * 100).toFixed(1))
    : 0

  const activeCount     = activeClients.length
  const avgMonthlyValue = activeCount > 0 ? mrr / activeCount : 0

  // LTV = ARPU / churn mensal (se churn = 0, usa estimativa de 24 meses)
  const avgLtv = churnRate > 0
    ? parseFloat((avgMonthlyValue / (churnRate / 100)).toFixed(0))
    : parseFloat((avgMonthlyValue * 24).toFixed(0))

  res.json({
    mrr:              parseFloat(mrr.toFixed(2)),
    mrrStart:         parseFloat(mrrStart.toFixed(2)),
    churnedMrr:       parseFloat(churnedMrr.toFixed(2)),
    expansionMrr,
    contractionMrr,
    nrr,
    churnRate,
    avgLtv,
    activeClients:    activeCount,
  })
}))

/**
 * GET /api/analytics/comparison
 * SPRINT 3.2: Compara mês atual vs mês anterior — MRR, leads, deals, receita.
 */
router.get('/comparison', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart    = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd      = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  const [
    currentClients,
    prevClients,
    currentLeads,
    prevLeads,
    currentDeals,
    prevDeals,
  ] = await Promise.all([
    prisma.client.findMany({ where: { status: 'active' }, select: { monthlyValue: true } }),
    prisma.client.findMany({
      where: {
        startDate: { lte: prevMonthEnd },
        OR: [{ cancelledAt: null }, { cancelledAt: { gt: prevMonthEnd } }],
      },
      select: { monthlyValue: true },
    }),
    prisma.lead.count({ where: { importedAt: { gte: currentMonthStart } } }),
    prisma.lead.count({ where: { importedAt: { gte: prevMonthStart, lte: prevMonthEnd } } }),
    prisma.lead.count({ where: { pipelineStage: 'closed', updatedAt: { gte: currentMonthStart } } }),
    prisma.lead.count({ where: { pipelineStage: 'closed', updatedAt: { gte: prevMonthStart, lte: prevMonthEnd } } }),
  ])

  const currentMrr = currentClients.reduce((s, c) => s + (c.monthlyValue ?? 0), 0)
  const prevMrr    = prevClients.reduce((s, c) => s + (c.monthlyValue ?? 0), 0)

  function calcDelta(cur: number, prev: number) {
    const value = parseFloat((cur - prev).toFixed(2))
    const percent = prev > 0 ? parseFloat(((Math.abs(cur - prev) / prev) * 100).toFixed(1)) : 0
    const direction: 'up' | 'down' | 'neutral' = value > 0 ? 'up' : value < 0 ? 'down' : 'neutral'
    return { value, percent, direction }
  }

  res.json({
    current:  { mrr: currentMrr, leads: currentLeads, deals: currentDeals, revenue: currentMrr },
    previous: { mrr: prevMrr,    leads: prevLeads,    deals: prevDeals,    revenue: prevMrr },
    deltas: {
      mrr:     calcDelta(currentMrr,    prevMrr),
      leads:   calcDelta(currentLeads,  prevLeads),
      deals:   calcDelta(currentDeals,  prevDeals),
      revenue: calcDelta(currentMrr,    prevMrr),
    },
  })
}))

export default router
