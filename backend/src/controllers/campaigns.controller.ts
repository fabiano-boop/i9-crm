import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database.js'
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination.js'
import { logger } from '../utils/logger.js'
import { sendCampaignWhatsApp } from '../services/whatsapp.service.js'
import { autoCreateCampaignsByNiche } from '../services/nicheAutoCampaign.service.js'

const campaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['WHATSAPP', 'EMAIL', 'BOTH']),
  subject: z.string().optional(),
  bodyText: z.string().min(1),
  bodyHtml: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
})

// GET /api/campaigns
export async function listCampaigns(req: Request, res: Response): Promise<void> {
  const { page, limit } = getPaginationParams(req.query as Record<string, unknown>)
  const [data, total] = await Promise.all([
    prisma.campaign.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { campaignLeads: true } },
      },
    }),
    prisma.campaign.count(),
  ])
  res.json(buildPaginatedResult(data, total, { page, limit }))
}

// GET /api/campaigns/:id
export async function getCampaign(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { campaignLeads: true } },
    },
  })
  if (!campaign) {
    res.status(404).json({ error: 'Campanha não encontrada', code: 'NOT_FOUND' })
    return
  }
  res.json(campaign)
}

// POST /api/campaigns
export async function createCampaign(req: Request, res: Response): Promise<void> {
  const result = campaignSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: result.error.flatten() })
    return
  }
  const campaign = await prisma.campaign.create({
    data: { ...result.data, createdById: req.user!.sub },
    include: { createdBy: { select: { id: true, name: true } } },
  })
  res.status(201).json(campaign)
}

// PUT /api/campaigns/:id
export async function updateCampaign(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string
  const result = campaignSchema.partial().safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: result.error.flatten() })
    return
  }
  const existing = await prisma.campaign.findUnique({ where: { id } })
  if (!existing) { res.status(404).json({ error: 'Campanha não encontrada', code: 'NOT_FOUND' }); return }
  if (existing.status === 'RUNNING') {
    res.status(409).json({ error: 'Não é possível editar uma campanha em execução', code: 'CAMPAIGN_RUNNING' })
    return
  }
  const campaign = await prisma.campaign.update({ where: { id }, data: result.data })
  res.json(campaign)
}

// DELETE /api/campaigns/:id
export async function deleteCampaign(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string
  const existing = await prisma.campaign.findUnique({ where: { id } })
  if (!existing) { res.status(404).json({ error: 'Campanha não encontrada', code: 'NOT_FOUND' }); return }
  await prisma.campaign.delete({ where: { id } })
  res.status(204).send()
}

// POST /api/campaigns/:id/leads — adiciona leads à campanha
export async function addLeadsToCampaign(req: Request, res: Response): Promise<void> {
  const campaignId = req.params.id as string
  const { leadIds } = req.body as { leadIds?: string[] }
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    res.status(400).json({ error: 'leadIds obrigatório', code: 'VALIDATION_ERROR' })
    return
  }
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
  if (!campaign) { res.status(404).json({ error: 'Campanha não encontrada', code: 'NOT_FOUND' }); return }

  // createMany ignora duplicatas com skipDuplicates
  const result = await prisma.campaignLead.createMany({
    data: leadIds.map((leadId) => ({ campaignId, leadId })),
    skipDuplicates: true,
  })
  res.json({ added: result.count })
}

// DELETE /api/campaigns/:id/leads/:leadId
export async function removeLeadFromCampaign(req: Request, res: Response): Promise<void> {
  const campaignId = req.params.id as string
  const leadId = req.params.leadId as string
  await prisma.campaignLead.deleteMany({
    where: { campaignId, leadId },
  })
  res.status(204).send()
}

// GET /api/campaigns/:id/stats
export async function getCampaignStats(req: Request, res: Response): Promise<void> {
  const campaignId = req.params.id as string
  const [total, sent, delivered, opened, clicked, replied, failed] = await Promise.all([
    prisma.campaignLead.count({ where: { campaignId } }),
    prisma.campaignLead.count({ where: { campaignId, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED'] } } }),
    prisma.campaignLead.count({ where: { campaignId, status: { in: ['DELIVERED', 'OPENED', 'CLICKED', 'REPLIED'] } } }),
    prisma.campaignLead.count({ where: { campaignId, status: { in: ['OPENED', 'CLICKED', 'REPLIED'] } } }),
    prisma.campaignLead.count({ where: { campaignId, status: { in: ['CLICKED', 'REPLIED'] } } }),
    prisma.campaignLead.count({ where: { campaignId, replied: true } }),
    prisma.campaignLead.count({ where: { campaignId, status: 'FAILED' } }),
  ])

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0

  res.json({
    total, sent, delivered, opened, clicked, replied, failed,
    rates: {
      delivery: pct(delivered),
      open: pct(opened),
      click: pct(clicked),
      reply: pct(replied),
    },
  })
}

// POST /api/campaigns/:id/send
export async function sendCampaign(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string
  const { channel } = req.body as { channel?: string }
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { _count: { select: { campaignLeads: true } } },
  })
  if (!campaign) { res.status(404).json({ error: 'Campanha não encontrada', code: 'NOT_FOUND' }); return }
  if (campaign.status === 'RUNNING') {
    res.status(409).json({ error: 'Campanha já em execução', code: 'ALREADY_RUNNING' })
    return
  }
  if (campaign._count.campaignLeads === 0) {
    res.status(400).json({ error: 'Campanha sem leads. Adicione leads antes de enviar.', code: 'NO_LEADS' })
    return
  }

  // Atualiza status para RUNNING
  await prisma.campaign.update({ where: { id }, data: { status: 'RUNNING', sentAt: new Date() } })

  logger.info({ campaignId: campaign.id, channel, leads: campaign._count.campaignLeads }, 'Campanha iniciada')

  // Dispara em background sem bloquear a resposta HTTP.
  // Para campanhas grandes (3k+ leads com delay 30-60s), isso roda por horas —
  // se o processo reiniciar, o disparo para. Leads já enviados (status=SENT) não
  // são reenviados pois sendCampaignWhatsApp filtra apenas status=PENDING.
  if (campaign.type === 'WHATSAPP' || campaign.type === 'BOTH') {
    sendCampaignWhatsApp(campaign.id).catch((err) =>
      logger.error({ err, campaignId: campaign.id }, 'Erro no disparo da campanha WhatsApp')
    )
  }

  res.json({
    message: 'Campanha iniciada',
    campaignId: campaign.id,
    leads: campaign._count.campaignLeads,
    channel: channel ?? campaign.type,
  })
}

// POST /api/campaigns/:id/pause
export async function pauseCampaign(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string
  await prisma.campaign.update({ where: { id }, data: { status: 'PAUSED' } })
  res.json({ message: 'Campanha pausada' })
}

// POST /api/campaigns/auto-create-by-niche
export async function autoCreateByNiche(req: Request, res: Response): Promise<void> {
  const user = (req as Request & { user?: { sub: string } }).user
  const adminId = user?.sub
  if (!adminId) {
    res.status(401).json({ error: 'Não autorizado', code: 'UNAUTHORIZED' })
    return
  }

  const results = await autoCreateCampaignsByNiche(adminId)

  if (results.length === 0) {
    res.json({ message: 'Nenhum lead com nicho mapeado encontrado', campaigns: [] })
    return
  }

  const totalLeads = results.reduce((s, r) => s + r.leadsAdded, 0)
  logger.info({ groups: results.length, totalLeads }, 'auto-create-by-niche concluído')
  res.json({ campaigns: results, totalLeads })
}

// GET /api/campaigns/:id/leads-engaged
export async function getEngagedLeads(req: Request, res: Response): Promise<void> {
  const campaignId = req.params.id as string
  const campaignLeads = await prisma.campaignLead.findMany({
    where: {
      campaignId,
      status: { in: ['OPENED', 'CLICKED', 'REPLIED'] },
    },
    include: { lead: true },
    orderBy: { openedAt: 'desc' },
  })
  res.json(campaignLeads)
}
