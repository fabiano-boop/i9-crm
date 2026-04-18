import { Request, Response } from 'express'
import fs from 'fs'
import { z } from 'zod'
import { prisma } from '../config/database.js'
import { logger } from '../utils/logger.js'
import {
  generateReport,
  sendReport,
  getReportHtml,
} from '../services/weeklyClientReport.service.js'
import { enqueueManualReport, enqueueSendReport } from '../jobs/clientReport.job.js'
import { isRedisAvailable } from '../config/redis.js'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const createClientSchema = z.object({
  businessName: z.string().min(1, 'Nome do negócio é obrigatório'),
  ownerName: z.string().min(1, 'Nome do responsável é obrigatório'),
  email: z.string().email('Email inválido').optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  niche: z.string().optional().nullable(),
  package: z.enum(['basico', 'pro', 'premium']).optional().nullable(),
  monthlyValue: z.number().positive().optional().nullable(),
  startDate: z.string().datetime({ offset: true }).optional(),
  origin: z.enum(['lead', 'referral', 'manual']).default('manual'),
  leadId: z.string().cuid().optional().nullable(),
  notes: z.string().optional().nullable(),
})

const updateClientSchema = createClientSchema.partial().omit({ origin: true, leadId: true })

const patchStatusSchema = z.object({
  status: z.enum(['active', 'paused', 'cancelled']),
  cancellationReason: z.string().optional(),
})

const generateReportSchema = z.object({
  weekStart: z.string().datetime({ offset: true }).optional(),
})

const sendReportSchema = z.object({
  channels: z.array(z.enum(['email', 'whatsapp'])).default(['email', 'whatsapp']),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfCurrentWeek(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // segunda-feira
  return d
}

// ─── CLIENTES — CRUD ──────────────────────────────────────────────────────────

export async function listClients(req: Request, res: Response): Promise<void> {
  const status = req.query['status'] as string | undefined
  const niche = req.query['niche'] as string | undefined
  const neighborhood = req.query['neighborhood'] as string | undefined
  const pkg = req.query['package'] as string | undefined
  const page = Number(req.query['page'] ?? 1)
  const limit = Number(req.query['limit'] ?? 20)
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (status) where['status'] = status
  if (pkg) where['package'] = pkg
  if (niche) where['niche'] = { contains: niche, mode: 'insensitive' }
  if (neighborhood) where['neighborhood'] = { contains: neighborhood, mode: 'insensitive' }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { weeklyReports: true } },
        weeklyReports: { orderBy: { weekStart: 'desc' }, take: 1 },
      },
    }),
    prisma.client.count({ where }),
  ])

  res.json({ clients, total, page, limit })
}

export async function getClient(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      weeklyReports: { orderBy: { weekStart: 'desc' }, take: 10 },
    },
  })

  if (!client) {
    res.status(404).json({ error: 'Cliente não encontrado' })
    return
  }

  // Métricas acumuladas
  const [totalReports, lastReport] = await Promise.all([
    prisma.weeklyReport.count({ where: { clientId: id } }),
    prisma.weeklyReport.findFirst({ where: { clientId: id }, orderBy: { weekStart: 'desc' } }),
  ])

  res.json({ ...client, totalReports, lastReportAt: lastReport?.weekStart ?? null })
}

export async function createClient(req: Request, res: Response): Promise<void> {
  const parse = createClientSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() })
    return
  }

  const data = parse.data
  const client = await prisma.client.create({
    data: {
      businessName: data.businessName,
      ownerName: data.ownerName,
      email: data.email ?? undefined,
      whatsapp: data.whatsapp ?? undefined,
      address: data.address ?? undefined,
      neighborhood: data.neighborhood ?? undefined,
      niche: data.niche ?? undefined,
      package: data.package ?? undefined,
      monthlyValue: data.monthlyValue ?? undefined,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      origin: data.origin,
      leadId: data.leadId ?? undefined,
      notes: data.notes ?? undefined,
    },
  })

  logger.info({ clientId: client.id }, 'Cliente criado')

  // Gerar primeiro relatório em background (semana atual)
  enqueueManualReport(client.id, startOfCurrentWeek()).catch((err) =>
    logger.warn({ err, clientId: client.id }, 'Falha ao enfileirar relatório de onboarding'),
  )

  res.status(201).json(client)
}

export async function updateClient(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string

  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Cliente não encontrado' })
    return
  }

  const parse = updateClientSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() })
    return
  }

  const data = parse.data
  const client = await prisma.client.update({
    where: { id },
    data: {
      ...(data.businessName !== undefined && { businessName: data.businessName }),
      ...(data.ownerName !== undefined && { ownerName: data.ownerName }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.whatsapp !== undefined && { whatsapp: data.whatsapp }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.neighborhood !== undefined && { neighborhood: data.neighborhood }),
      ...(data.niche !== undefined && { niche: data.niche }),
      ...(data.package !== undefined && { package: data.package }),
      ...(data.monthlyValue !== undefined && { monthlyValue: data.monthlyValue }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  })

  res.json(client)
}

export async function patchClientStatus(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string

  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Cliente não encontrado' })
    return
  }

  const parse = patchStatusSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() })
    return
  }

  const { status, cancellationReason } = parse.data

  const client = await prisma.client.update({
    where: { id },
    data: {
      status,
      ...(status === 'cancelled' && {
        cancelledAt: new Date(),
        cancellationReason: cancellationReason ?? null,
      }),
    },
  })

  logger.info({ clientId: id, status }, 'Status do cliente atualizado')
  res.json(client)
}

// Soft delete — apenas muda status para cancelled
export async function deleteClient(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string

  const existing = await prisma.client.findUnique({ where: { id } })
  if (!existing) {
    res.status(404).json({ error: 'Cliente não encontrado' })
    return
  }

  await prisma.client.update({
    where: { id },
    data: { status: 'cancelled', cancelledAt: new Date() },
  })

  logger.info({ clientId: id }, 'Cliente marcado como cancelado (soft delete)')
  res.status(204).send()
}

// ─── WEEKLY REPORTS ───────────────────────────────────────────────────────────

export async function listClientReports(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string
  const page = Number(req.query['page'] ?? 1)
  const limit = Number(req.query['limit'] ?? 10)
  const skip = (page - 1) * limit

  const [reports, total] = await Promise.all([
    prisma.weeklyReport.findMany({
      where: { clientId: id },
      skip,
      take: limit,
      orderBy: { weekStart: 'desc' },
    }),
    prisma.weeklyReport.count({ where: { clientId: id } }),
  ])

  res.json({ reports, total, page, limit })
}

export async function generateClientReport(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string

  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) {
    res.status(404).json({ error: 'Cliente não encontrado' })
    return
  }

  const parse = generateReportSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() })
    return
  }

  const weekStartDate = parse.data.weekStart
    ? new Date(parse.data.weekStart)
    : startOfCurrentWeek()

  // Se Redis disponível, enfileirar com prioridade máxima e retornar imediatamente
  const redisOk = await isRedisAvailable()
  if (redisOk) {
    const jobId = await enqueueManualReport(id, weekStartDate)
    res.status(202).json({ queued: true, jobId, message: 'Relatório enfileirado com prioridade máxima' })
    return
  }

  // Fallback síncrono quando Redis indisponível
  try {
    const report = await generateReport(id, weekStartDate)
    res.status(201).json(report)
  } catch (err) {
    logger.error({ err, clientId: id }, 'Erro ao gerar relatório')
    res.status(500).json({ error: 'Erro ao gerar relatório' })
  }
}

// ─── METRICS ─────────────────────────────────────────────────────────────────

export async function getClientsOverview(_req: Request, res: Response): Promise<void> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfWeek = startOfCurrentWeek()

  const [
    activeClients,
    mrrAgg,
    byPackageRaw,
    byNicheRaw,
    churnThisMonth,
    newThisMonth,
    reportsThisWeek,
  ] = await Promise.all([
    prisma.client.count({ where: { status: 'active' } }),

    prisma.client.aggregate({
      where: { status: 'active' },
      _sum: { monthlyValue: true },
      _avg: { monthlyValue: true },
    }),

    prisma.client.groupBy({
      by: ['package'],
      where: { status: 'active' },
      _count: true,
    }),

    prisma.client.groupBy({
      by: ['niche'],
      where: { status: 'active' },
      _count: true,
      orderBy: { _count: { niche: 'desc' } },
    }),

    prisma.client.count({
      where: { status: 'cancelled', cancelledAt: { gte: startOfMonth } },
    }),

    prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),

    prisma.weeklyReport.count({ where: { createdAt: { gte: startOfWeek } } }),
  ])

  const byPackage: Record<string, number> = {}
  for (const row of byPackageRaw) {
    byPackage[row.package ?? 'sem_pacote'] = row._count
  }

  const byNiche: Record<string, number> = {}
  for (const row of byNicheRaw) {
    byNiche[row.niche ?? 'outros'] = row._count
  }

  res.json({
    totalActive: activeClients,
    totalMRR: mrrAgg._sum.monthlyValue ?? 0,
    avgPackageValue: mrrAgg._avg.monthlyValue ?? 0,
    byPackage,
    byNiche,
    churnThisMonth,
    newThisMonth,
    reportsGeneratedThisWeek: reportsThisWeek,
  })
}

export async function getMrrProjection(_req: Request, res: Response): Promise<void> {
  // Coleta histórico dos últimos 6 meses de MRR
  const months: { label: string; mrr: number; clients: number }[] = []
  const now = new Date()

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)

    const agg = await prisma.client.aggregate({
      where: {
        status: { in: ['active', 'paused'] },
        createdAt: { lte: end },
        OR: [
          { cancelledAt: null },
          { cancelledAt: { gte: start } },
        ],
      },
      _sum: { monthlyValue: true },
      _count: true,
    })

    const label = start.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    months.push({ label, mrr: agg._sum.monthlyValue ?? 0, clients: agg._count })
  }

  // Crescimento médio mês a mês (últimos 3 meses)
  const recentMonths = months.slice(-3)
  let avgGrowthRate = 0
  if (recentMonths.length >= 2) {
    const growthRates: number[] = []
    for (let i = 1; i < recentMonths.length; i++) {
      const prev = recentMonths[i - 1]!.mrr
      const curr = recentMonths[i]!.mrr
      if (prev > 0) growthRates.push((curr - prev) / prev)
    }
    avgGrowthRate = growthRates.length > 0
      ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length
      : 0
  }

  // Projeção — próximos 6 meses
  const projection: { label: string; projectedMrr: number }[] = []
  let lastMrr = months[months.length - 1]?.mrr ?? 0

  for (let i = 1; i <= 6; i++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
    lastMrr = lastMrr * (1 + avgGrowthRate)
    const label = futureDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    projection.push({ label, projectedMrr: Math.round(lastMrr) })
  }

  res.json({ history: months, projection, avgGrowthRate: parseFloat((avgGrowthRate * 100).toFixed(2)) })
}

// ─── STANDALONE REPORT ACTIONS (usados pelo /api/reports router) ──────────────

export async function sendStandaloneReport(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string

  const report = await prisma.weeklyReport.findUnique({ where: { id } })
  if (!report) {
    res.status(404).json({ error: 'Relatório não encontrado' })
    return
  }

  const parse = sendReportSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Dados inválidos', details: parse.error.flatten() })
    return
  }

  const { channels } = parse.data

  const redisOk = await isRedisAvailable()
  if (redisOk) {
    await enqueueSendReport(id, channels)
    res.json({ queued: true })
    return
  }

  try {
    await sendReport(id)
    const updated = await prisma.weeklyReport.findUnique({ where: { id } })
    res.json({ sentViaEmail: updated?.sentViaEmail, sentViaWhatsApp: updated?.sentViaWhatsApp })
  } catch (err) {
    logger.error({ err, reportId: id }, 'Erro ao enviar relatório')
    res.status(500).json({ error: 'Erro ao enviar relatório' })
  }
}

export async function previewReport(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string

  try {
    const html = await getReportHtml(id)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(404).json({ error: msg })
  }
}

export async function downloadReportPdf(req: Request, res: Response): Promise<void> {
  const id = req.params['id'] as string

  const report = await prisma.weeklyReport.findUnique({
    where: { id },
    include: { client: true },
  })
  if (!report) {
    res.status(404).json({ error: 'Relatório não encontrado' })
    return
  }

  // Servir PDF salvo em disco
  if (report.pdfPath && fs.existsSync(report.pdfPath)) {
    const filename = `relatorio-i9-${report.weekStart.toISOString().slice(0, 10)}.pdf`
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    fs.createReadStream(report.pdfPath).pipe(res)
    return
  }

  // Fallback: HTML com print CSS
  try {
    const html = await getReportHtml(id)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('X-Pdf-Fallback', 'true')
    res.send(html)
  } catch (err) {
    logger.error({ err, reportId: id }, 'Erro ao recuperar relatório')
    res.status(500).json({ error: 'Erro ao recuperar relatório' })
  }
}

// Mantido para compatibilidade com a rota nested /:id/reports/:rid/pdf
export async function downloadNestedReportPdf(req: Request, res: Response): Promise<void> {
  req.params['id'] = req.params['rid'] as string
  return downloadReportPdf(req, res)
}
