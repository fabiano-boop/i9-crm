import { Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/database.js'
import { getPaginationParams, buildPaginatedResult } from '../utils/pagination.js'
import { scoreLead, bulkScoreLeads } from '../services/scoring.service.js'
import { generatePitch } from '../services/claude.service.js'
import { pauseActiveCadencesForLead } from '../services/cadence.service.js'

// Schema de importação em bulk (aceita classification + score + whatsappAngle)
const importLeadSchema = z.object({
  externalId: z.string().optional(),
  name: z.string().min(1),
  businessName: z.string().min(1),
  niche: z.string().min(1),
  neighborhood: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  instagram: z.string().optional(),
  googleRating: z.coerce.number().optional(),
  reviewCount: z.coerce.number().int().optional(),
  digitalLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  painPoints: z.string().optional(),
  idealService: z.string().optional(),
  upsellService: z.string().optional(),
  urgency: z.coerce.number().int().min(1).max(10).optional(),
  revenuePotential: z.string().optional(),
  closingEase: z.string().optional(),
  score: z.coerce.number().int().min(0).max(100).optional(),
  classification: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  whatsappAngle: z.string().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'REPLIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED', 'LOST']).optional(),
  notes: z.string().optional(),
})

// POST /api/leads/import — importação bulk sem depender de Google Sheets API
export async function importLeads(req: Request, res: Response): Promise<void> {
  const body = req.body as { leads?: unknown[] }
  if (!Array.isArray(body.leads) || body.leads.length === 0) {
    res.status(400).json({ error: 'leads[] obrigatório', code: 'VALIDATION_ERROR' })
    return
  }

  let imported = 0, updated = 0, errors: string[] = []

  for (const raw of body.leads) {
    const result = importLeadSchema.safeParse(raw)
    if (!result.success) {
      errors.push(JSON.stringify(result.error.flatten().fieldErrors))
      continue
    }
    const d = result.data
    try {
      const existing = d.externalId
        ? await prisma.lead.findUnique({ where: { externalId: d.externalId } })
        : null

      if (existing) {
        await prisma.lead.update({ where: { id: existing.id }, data: d })
        updated++
      } else {
        await prisma.lead.create({ data: { ...d, importedAt: new Date() } })
        imported++
      }
    } catch (e: unknown) {
      errors.push(d.name + ': ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  res.json({ imported, updated, errors, total: imported + updated })
}

// Validação para criação/atualização de lead
const leadSchema = z.object({
  name: z.string().min(1),
  businessName: z.string().min(1),
  niche: z.string().min(1),
  neighborhood: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
  instagram: z.string().optional(),
  googleRating: z.coerce.number().min(0).max(5).optional(),
  reviewCount: z.coerce.number().int().min(0).optional(),
  digitalLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  painPoints: z.string().optional(),
  idealService: z.string().optional(),
  upsellService: z.string().optional(),
  urgency: z.coerce.number().int().min(1).max(10).optional(),
  revenuePotential: z.string().optional(),
  closingEase: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'REPLIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED', 'LOST']).optional(),
  pipelineStage: z.string().optional(),
  assignedToId: z.string().optional(),
})

// GET /api/leads
export async function listLeads(req: Request, res: Response): Promise<void> {
  const { page, limit } = getPaginationParams(req.query as Record<string, unknown>)
  const { status, classification, neighborhood, search, stage, assignedToId } = req.query as Record<string, string>

  const where: Prisma.LeadWhereInput = {}

  if (status) where.status = status as Prisma.EnumLeadStatusFilter
  if (classification) where.classification = classification as Prisma.EnumClassificationFilter
  if (neighborhood) where.neighborhood = { contains: neighborhood, mode: 'insensitive' }
  if (stage) where.pipelineStage = stage
  if (assignedToId) where.assignedToId = assignedToId
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { businessName: { contains: search, mode: 'insensitive' } },
      { niche: { contains: search, mode: 'insensitive' } },
      { neighborhood: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [data, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ score: 'desc' }, { importedAt: 'desc' }],
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
    }),
    prisma.lead.count({ where }),
  ])

  res.json(buildPaginatedResult(data, total, { page, limit }))
}

// GET /api/leads/:id
export async function getLead(req: Request, res: Response): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: (req.params['id'] as string) },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      interactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      campaignLeads: { include: { campaign: { select: { id: true, name: true, type: true, status: true } } } },
      trackingEvents: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })

  if (!lead) {
    res.status(404).json({ error: 'Lead não encontrado', code: 'NOT_FOUND' })
    return
  }

  res.json(lead)
}

// PUT /api/leads/:id
export async function updateLead(req: Request, res: Response): Promise<void> {
  const result = leadSchema.partial().safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: result.error.flatten() })
    return
  }

  const existing = await prisma.lead.findUnique({ where: { id: (req.params['id'] as string) } })
  if (!existing) {
    res.status(404).json({ error: 'Lead não encontrado', code: 'NOT_FOUND' })
    return
  }

  const lead = await prisma.lead.update({
    where: { id: (req.params['id'] as string) },
    data: {
      ...result.data,
      // Atualiza lastContactAt se o status mudou para CONTACTED
      ...(result.data.status === 'CONTACTED' && !existing.lastContactAt
        ? { lastContactAt: new Date() }
        : {}),
    },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  })

  res.json(lead)
}

// DELETE /api/leads/:id
export async function deleteLead(req: Request, res: Response): Promise<void> {
  const existing = await prisma.lead.findUnique({ where: { id: (req.params['id'] as string) } })
  if (!existing) {
    res.status(404).json({ error: 'Lead não encontrado', code: 'NOT_FOUND' })
    return
  }

  await prisma.lead.delete({ where: { id: (req.params['id'] as string) } })
  res.status(204).send()
}

// PUT /api/leads/:id/stage
export async function updateStage(req: Request, res: Response): Promise<void> {
  const { stage } = req.body as { stage?: string }
  if (!stage) {
    res.status(400).json({ error: 'stage obrigatório', code: 'VALIDATION_ERROR' })
    return
  }

  const lead = await prisma.lead.update({
    where: { id: (req.params['id'] as string) },
    data: { pipelineStage: stage },
  })

  res.json(lead)
}

// GET /api/leads/:id/interactions
export async function listInteractions(req: Request, res: Response): Promise<void> {
  const { page, limit } = getPaginationParams(req.query as Record<string, unknown>)

  const [data, total] = await Promise.all([
    prisma.interaction.findMany({
      where: { leadId: (req.params['id'] as string) },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.interaction.count({ where: { leadId: (req.params['id'] as string) } }),
  ])

  res.json(buildPaginatedResult(data, total, { page, limit }))
}

const interactionSchema = z.object({
  type: z.enum(['WHATSAPP', 'EMAIL', 'CALL', 'NOTE']),
  channel: z.string().min(1),
  content: z.string().min(1),
  direction: z.enum(['IN', 'OUT']).default('OUT'),
})

// POST /api/leads/:id/interactions
export async function createInteraction(req: Request, res: Response): Promise<void> {
  const result = interactionSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: result.error.flatten() })
    return
  }

  const lead = await prisma.lead.findUnique({ where: { id: (req.params['id'] as string) } })
  if (!lead) {
    res.status(404).json({ error: 'Lead não encontrado', code: 'NOT_FOUND' })
    return
  }

  const leadId = req.params['id'] as string

  const [interaction] = await Promise.all([
    prisma.interaction.create({
      data: { leadId, ...result.data },
    }),
    // Atualiza lastContactAt do lead
    prisma.lead.update({
      where: { id: leadId },
      data: { lastContactAt: new Date() },
    }),
  ])

  // Auto-pausar cadências ativas quando o lead responde
  if (result.data.direction === 'IN') {
    pauseActiveCadencesForLead(leadId, 'lead_replied').catch(() => null)
  }

  res.status(201).json(interaction)
}

// GET /api/leads/:id/tracking-events
export async function listTrackingEvents(req: Request, res: Response): Promise<void> {
  const events = await prisma.trackingEvent.findMany({
    where: { leadId: (req.params['id'] as string) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json(events)
}

// POST /api/leads/:id/rescore
export async function rescoreLead(req: Request, res: Response): Promise<void> {
  if (!process.env['ANTHROPIC_API_KEY']) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurado', code: 'AI_NOT_CONFIGURED' })
    return
  }
  try {
    const result = await scoreLead((req.params['id'] as string))
    res.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    if (e?.status === 401) {
      res.status(503).json({ error: 'ANTHROPIC_API_KEY inválida — atualize no Railway', code: 'AI_AUTH_ERROR' })
      return
    }
    if (e?.status === 429) {
      res.status(503).json({ error: 'Rate limit da API Anthropic atingido', code: 'AI_RATE_LIMIT' })
      return
    }
    throw err // deixa o asyncHandler tratar os demais erros
  }
}

// POST /api/leads/bulk-score
export async function bulkScore(req: Request, res: Response): Promise<void> {
  if (!process.env['ANTHROPIC_API_KEY']) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurado', code: 'AI_NOT_CONFIGURED' })
    return
  }
  const { leadIds } = req.body as { leadIds?: string[] }
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    res.status(400).json({ error: 'leadIds obrigatório (array)', code: 'VALIDATION_ERROR' })
    return
  }
  const results = await bulkScoreLeads(leadIds)
  res.json({ results, processed: results.length })
}

// POST /api/leads/:id/generate-pitch
export async function generateLeadPitch(req: Request, res: Response): Promise<void> {
  if (!process.env['ANTHROPIC_API_KEY']) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurado', code: 'AI_NOT_CONFIGURED' })
    return
  }
  const lead = await prisma.lead.findUnique({ where: { id: (req.params['id'] as string) } })
  if (!lead) {
    res.status(404).json({ error: 'Lead não encontrado', code: 'NOT_FOUND' })
    return
  }
  const pitch = await generatePitch(lead)
  res.json(pitch)
}
