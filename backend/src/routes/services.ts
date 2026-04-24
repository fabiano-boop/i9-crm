import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { prisma } from '../config/database.js'

const router = Router()
router.use(requireAuth)

/** GET /api/services — lista todos os serviços */
router.get('/', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const services = await prisma.service.findMany({
    orderBy: { name: 'asc' },
  })
  res.json({ services, total: services.length })
}))

/** GET /api/services/:id — detalhe de um serviço */
router.get('/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const id = req.params['id'] as string
  const service = await prisma.service.findUnique({ where: { id } })
  if (!service) { res.status(404).json({ error: 'Serviço não encontrado' }); return }
  res.json(service)
}))

/**
 * GET /api/services/:id/sales-history
 * SPRINT 3.5: Histórico de vendas por serviço.
 * Contratos = clientes com serviceId = id
 * Receita   = faturas pagas (status PAID) desses clientes, agrupadas por mês
 */
router.get('/:id/sales-history', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const serviceId = req.params['id'] as string

  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) { res.status(404).json({ error: 'Serviço não encontrado' }); return }

  // Clientes vinculados a este serviço
  const clients = await prisma.client.findMany({
    where: { serviceId },
    select: {
      id: true,
      businessName: true,
      monthlyValue: true,
      startDate: true,
      status: true,
      invoices: {
        where: { status: 'PAID' },
        select: { amount: true, paidAt: true, referenceMonth: true },
      },
    },
    orderBy: { startDate: 'desc' },
  })

  // Mapa de receita por mês — últimos 12 meses
  const now = new Date()
  const monthMap: Record<string, number> = {}
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap[key] = 0
  }

  let totalRevenue = 0
  for (const client of clients) {
    for (const inv of client.invoices) {
      const monthKey = inv.referenceMonth
        ?? (inv.paidAt ? `${inv.paidAt.getFullYear()}-${String(inv.paidAt.getMonth() + 1).padStart(2, '0')}` : null)
      if (monthKey && monthMap[monthKey] !== undefined) {
        monthMap[monthKey] += inv.amount
      }
      totalRevenue += inv.amount
    }
  }

  const monthlyRevenue = Object.entries(monthMap).map(([month, revenue]) => ({ month, revenue }))

  const activeClients = clients.filter(c => c.status === 'active').length
  const avgTicket = clients.length > 0
    ? clients.reduce((s, c) => s + (c.monthlyValue ?? 0), 0) / clients.length
    : 0

  const contracts = clients.map(c => ({
    clientId:     c.id,
    clientName:   c.businessName,
    startDate:    c.startDate.toISOString(),
    monthlyValue: c.monthlyValue ?? 0,
    status:       c.status === 'active' ? 'ACTIVE' : c.status === 'paused' ? 'PAUSED' : 'CHURNED',
  }))

  res.json({
    serviceId:      service.id,
    serviceName:    service.name,
    category:       service.category,
    totalRevenue:   parseFloat(totalRevenue.toFixed(2)),
    totalContracts: clients.length,
    activeContracts: activeClients,
    avgTicket:      parseFloat(avgTicket.toFixed(2)),
    monthlyRevenue,
    contracts,
  })
}))

export default router
