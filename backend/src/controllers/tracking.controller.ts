import { Request, Response } from 'express'
import { prisma } from '../config/database.js'
import { verifyTrackingHash } from '../services/tracking.service.js'
import { TRACKING_PIXEL_GIF } from '../services/email.service.js'
import { logger } from '../utils/logger.js'
import { wsEvents } from '../services/websocket.service.js'
import { checkHotEngagement } from '../services/opportunityAlert.service.js'

// GET /track/open/:token — pixel de abertura de email
export async function trackOpen(req: Request, res: Response): Promise<void> {
  const token = req.params['token'] as string

  try {
    const cl = await prisma.campaignLead.findUnique({ where: { trackingToken: token } })
    if (cl && cl.status !== 'OPENED' && cl.status !== 'CLICKED' && cl.status !== 'REPLIED') {
      await Promise.all([
        prisma.campaignLead.update({
          where: { id: cl.id },
          data: { status: 'OPENED', openedAt: new Date() },
        }),
        prisma.trackingEvent.create({
          data: {
            leadId: cl.leadId,
            token,
            type: 'open',
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          },
        }),
        // Incrementa score de engajamento (+5)
        prisma.lead.update({
          where: { id: cl.leadId },
          data: { score: { increment: 5 } },
        }),
      ])

      // Notifica via WebSocket os agentes sobre o engajamento do lead
      const updatedLead = await prisma.lead.findUnique({
        where: { id: cl.leadId },
        select: { id: true, name: true, businessName: true, score: true, classification: true },
      })
      if (updatedLead) {
        wsEvents.hotAlert(updatedLead, 'open')
      }

      logger.debug({ leadId: cl.leadId, token }, 'Email aberto rastreado')
    }
  } catch (err) {
    logger.warn({ token, err }, 'Erro ao registrar abertura')
  }

  // SEMPRE retorna o pixel — nunca 404
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': TRACKING_PIXEL_GIF.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
  })
  res.end(TRACKING_PIXEL_GIF)
}

// GET /track/click/:campaignLeadId/:hash — link rastreado
export async function trackClick(req: Request, res: Response): Promise<void> {
  const campaignLeadId = req.params['campaignLeadId'] as string
  const hash = req.params['hash'] as string
  const encodedUrl = req.query['u'] as string

  if (!encodedUrl) {
    res.status(400).send('Link inválido')
    return
  }

  let originalUrl: string
  try {
    originalUrl = Buffer.from(encodedUrl, 'base64url').toString('utf8')
  } catch {
    res.status(400).send('Link corrompido')
    return
  }

  // Verifica autenticidade do hash
  if (!verifyTrackingHash(campaignLeadId, originalUrl, hash)) {
    logger.warn({ campaignLeadId, hash }, 'Hash de tracking inválido')
    res.redirect(302, originalUrl) // redireciona mesmo assim, mas não registra
    return
  }

  try {
    const cl = await prisma.campaignLead.findUnique({ where: { id: campaignLeadId } })
    if (cl) {
      const wasAlreadyClicked = cl.status === 'CLICKED' || cl.status === 'REPLIED'
      await Promise.all([
        !wasAlreadyClicked && prisma.campaignLead.update({
          where: { id: campaignLeadId },
          data: { status: 'CLICKED', clickedAt: new Date() },
        }),
        prisma.trackingEvent.create({
          data: {
            leadId: cl.leadId,
            token: cl.trackingToken,
            type: 'click',
            url: originalUrl,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          },
        }),
        // Incrementa score (+15 por clique)
        prisma.lead.update({
          where: { id: cl.leadId },
          data: { score: { increment: 15 } },
        }),
      ].filter(Boolean))

      // Reclassifica para HOT se score >= 80
      const lead = await prisma.lead.findUnique({
        where: { id: cl.leadId },
        select: { id: true, name: true, businessName: true, score: true, classification: true },
      })
      if (lead && lead.score >= 80 && lead.classification !== 'HOT') {
        await prisma.lead.update({ where: { id: cl.leadId }, data: { classification: 'HOT' } })
        logger.info({ leadId: cl.leadId }, 'Lead promovido para HOT por clique em link')
      }

      // Notifica via WebSocket os agentes sobre o clique do lead
      if (lead) {
        wsEvents.hotAlert(
          { ...lead, classification: lead.score >= 80 ? 'HOT' : lead.classification },
          'click',
        )
      }

      // Verifica alerta de oportunidade após clique
      checkHotEngagement(cl.leadId).then((alert) => {
        if (alert) wsEvents.opportunityAlert(alert)
      }).catch(() => null)

      logger.debug({ leadId: cl.leadId, url: originalUrl }, 'Clique rastreado')
    }
  } catch (err) {
    logger.warn({ campaignLeadId, err }, 'Erro ao registrar clique')
  }

  // Redirect 302 para URL original
  res.redirect(302, originalUrl)
}

// GET /track/events — lista eventos (API interna)
export async function listTrackingEvents(req: Request, res: Response): Promise<void> {
  const { leadId, type, since } = req.query as Record<string, string>

  const events = await prisma.trackingEvent.findMany({
    where: {
      ...(leadId && { leadId }),
      ...(type && { type }),
      ...(since && { createdAt: { gte: new Date(since) } }),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  res.json(events)
}
