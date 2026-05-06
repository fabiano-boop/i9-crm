import axios from 'axios'
import { prisma } from '../config/database.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { createTrackingUrl } from './tracking.service.js'
import { processMessage, handleLeadReply } from './whatsappAgent.service.js'

// ─── Whapi (Maya / conversas 1:1) ────────────────────────────────────────────
const whapiHttp = axios.create({
  baseURL: env.WHAPI_URL,
  headers: { Authorization: `Bearer ${env.WHAPI_TOKEN}` },
  timeout: 15_000,
})

// ─── Meta Cloud API (campanhas em massa) ─────────────────────────────────────
const metaHttp = axios.create({
  baseURL: `https://graph.facebook.com/v19.0/${env.META_PHONE_NUMBER_ID}`,
  headers: {
    Authorization: `Bearer ${env.META_WABA_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
})

// ─── Utilitários ──────────────────────────────────────────────────────────────

// Substitui variáveis do template com dados do lead
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

// Delay aleatório entre 90-180s (anti-ban — aumentado após restrição)
function humanDelay(): Promise<void> {
  const ms = 90_000 + Math.random() * 90_000
  return new Promise((r) => setTimeout(r, ms))
}

// Limite diário Whapi pelo dia de warm-up (hard cap reduzido para 15)
function getDailyLimit(warmupDay: number): number {
  if (warmupDay <= 7) return 20
  if (warmupDay <= 30) return 50
  if (warmupDay <= 90) return 80
  return 150
}

async function getAntiBanStatus(): Promise<{ sentToday: number; limit: number; warmupDay: number }> {
  const today = new Date().toISOString().split('T')[0]
  const [stats, config] = await Promise.all([
    prisma.whatsAppDailyStats.findUnique({ where: { date: today } }),
    prisma.whatsAppConfig.upsert({ where: { id: 'default' }, create: {}, update: {} }),
  ])
  const warmupDay = Math.max(1, Math.floor((Date.now() - config.warmupStartDate.getTime()) / 86_400_000) + 1)
  // Hard cap reduzido para 15/dia após restrição
  return { sentToday: stats?.sent ?? 0, limit: Math.min(15, getDailyLimit(warmupDay)), warmupDay }
}

async function incrementDailyCounter(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  await prisma.whatsAppDailyStats.upsert({
    where: { date: today },
    create: { date: today, sent: 1 },
    update: { sent: { increment: 1 } },
  })
}

// Normaliza número: 5511999999999
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return `55${digits}`
}

// ─── Whapi: envio individual (Maya) ──────────────────────────────────────────

export async function sendText(phone: string, message: string, retries = 3): Promise<boolean> {
  const to = normalizePhone(phone)
  if (to.length < 12) return false

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await whapiHttp.post('/messages/text', { to, body: message })
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.warn({ phone: to, attempt, err: msg }, 'Falha ao enviar WhatsApp via Whapi')
      if (attempt < retries) await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
  return false
}

export async function sendDocument(phone: string, buffer: Buffer, filename: string): Promise<boolean> {
  const to = normalizePhone(phone)
  if (to.length < 12) return false

  try {
    const media = `data:application/pdf;base64,${buffer.toString('base64')}`
    await whapiHttp.post('/messages/document', { to, media, filename })
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn({ phone: to, filename, err: msg }, 'Falha ao enviar documento via Whapi')
    return false
  }
}

// ─── Meta WABA: envio individual ─────────────────────────────────────────────

export async function sendTextWABA(phone: string, message: string, retries = 3): Promise<boolean> {
  const to = normalizePhone(phone)
  if (to.length < 12) return false

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await metaHttp.post('/messages', {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      })
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.warn({ phone: to, attempt, err: msg }, 'Falha ao enviar WhatsApp via Meta WABA')
      if (attempt < retries) await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
  return false
}

// ─── Whapi: disparo de campanha (legado — Whapi com throttle) ─────────────────

export async function sendCampaignWhatsApp(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
  if (!campaign) throw new Error('Campanha não encontrada')

  const pendingLeads = await prisma.campaignLead.findMany({
    where: { campaignId, status: 'PENDING' },
    include: { lead: true },
  })

  const { sentToday: initialSent, limit, warmupDay } = await getAntiBanStatus()
  logger.info({ campaignId, total: pendingLeads.length, limit, warmupDay, sentToday: initialSent }, 'Iniciando disparo WhatsApp (Whapi)')

  let sent = 0
  let failed = 0

  for (const cl of pendingLeads) {
    const { sentToday } = await getAntiBanStatus()
    if (sentToday >= limit) {
      logger.warn({ campaignId, sentToday, limit, warmupDay }, 'Limite diário atingido — pausando campanha')
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'PAUSED', pauseReason: 'DAILY_LIMIT_REACHED' },
      })
      return
    }

    const lead = cl.lead
    const phone = lead.whatsapp ?? lead.phone ?? ''
    if (!phone) {
      await prisma.campaignLead.update({
        where: { id: cl.id },
        data: { status: 'FAILED', errorMsg: 'Sem número de WhatsApp/telefone' },
      })
      failed++
      continue
    }

    const vars: Record<string, string> = {
      nome: lead.name,
      negocio: lead.businessName,
      bairro: lead.neighborhood,
      nicho: lead.niche,
      angulo: lead.whatsappAngle ?? '',
    }

    let message = interpolate(campaign.bodyText, vars)
    message = message.replace(/(https?:\/\/[^\s]+)/g, (url) => createTrackingUrl(cl.id, url))

    const ok = await sendText(phone, message)

    await prisma.campaignLead.update({
      where: { id: cl.id },
      data: ok
        ? { status: 'SENT', sentAt: new Date() }
        : { status: 'FAILED', errorMsg: 'Falha após 3 tentativas' },
    })

    if (ok) {
      await incrementDailyCounter()
      await prisma.lead.update({
        where: { id: cl.leadId },
        data: { status: 'CONTACTED', pipelineStage: 'CONTACTED', lastContactAt: new Date() },
      })
      sent++
    } else {
      failed++
    }

    if (cl !== pendingLeads[pendingLeads.length - 1]) await humanDelay()
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'COMPLETED', pauseReason: null },
  })

  logger.info({ campaignId, sent, failed }, 'Disparo WhatsApp (Whapi) concluído')
}

// ─── Meta WABA: disparo de campanha em massa ──────────────────────────────────
// Sem throttle de warm-up — Meta gerencia os limites internamente.
// Delay de 1-3s entre mensagens para parecer humano.

export async function sendCampaignWABA(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
  if (!campaign) throw new Error('Campanha não encontrada')

  const pendingLeads = await prisma.campaignLead.findMany({
    where: { campaignId, status: 'PENDING' },
    include: { lead: true },
  })

  logger.info({ campaignId, total: pendingLeads.length }, 'Iniciando disparo via Meta WABA')

  let sent = 0
  let failed = 0

  for (const cl of pendingLeads) {
    const lead = cl.lead
    const phone = lead.whatsapp ?? lead.phone ?? ''

    if (!phone) {
      await prisma.campaignLead.update({
        where: { id: cl.id },
        data: { status: 'FAILED', errorMsg: 'Sem número de WhatsApp/telefone' },
      })
      failed++
      continue
    }

    const vars: Record<string, string> = {
      nome: lead.name,
      negocio: lead.businessName,
      bairro: lead.neighborhood,
      nicho: lead.niche,
      angulo: lead.whatsappAngle ?? '',
    }

    let message = interpolate(campaign.bodyText, vars)
    message = message.replace(/(https?:\/\/[^\s]+)/g, (url) => createTrackingUrl(cl.id, url))

    const ok = await sendTextWABA(phone, message)

    await prisma.campaignLead.update({
      where: { id: cl.id },
      data: ok
        ? { status: 'SENT', sentAt: new Date() }
        : { status: 'FAILED', errorMsg: 'Falha após 3 tentativas (WABA)' },
    })

    if (ok) {
      await prisma.lead.update({
        where: { id: cl.leadId },
        data: { status: 'CONTACTED', pipelineStage: 'CONTACTED', lastContactAt: new Date() },
      })
      sent++
    } else {
      failed++
    }

    // Delay leve entre envios (1-3s) — Meta não exige throttle pesado
    if (cl !== pendingLeads[pendingLeads.length - 1]) {
      await new Promise((r) => setTimeout(r, 1_000 + Math.random() * 2_000))
    }
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'COMPLETED', pauseReason: null },
  })

  logger.info({ campaignId, sent, failed }, 'Disparo Meta WABA concluído')
}

// ─── Webhook Whapi ────────────────────────────────────────────────────────────

export async function processWhatsAppWebhook(body: Record<string, unknown>): Promise<void> {
  logger.info({ payload: JSON.stringify(body) }, 'Webhook Whapi recebido')
  logger.debug({ keys: Object.keys(body) }, 'Webhook Whapi recebido')

  const statuses = body['statuses'] as Array<Record<string, unknown>> | undefined
  if (Array.isArray(statuses)) {
    for (const status of statuses) {
      const chatId = status['chat_id'] as string | undefined
      const type = status['type'] as string | undefined
      if (!chatId || !type) continue

      const phone = chatId.replace('@s.whatsapp.net', '').replace(/^55/, '')
      const campaignLeads = await prisma.campaignLead.findMany({
        where: { lead: { OR: [{ phone: { contains: phone } }, { whatsapp: { contains: phone } }] } },
        orderBy: { sentAt: 'desc' },
        take: 1,
      })
      if (campaignLeads.length === 0) continue
      const cl = campaignLeads[0]

      if (type === 'delivered') {
        await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'DELIVERED', deliveredAt: new Date() } })
      } else if (type === 'read') {
        await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'OPENED', openedAt: new Date() } })
      }
    }
  }

  const messages = body['messages'] as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(messages)) return

  for (const msg of messages) {
    const fromMe = msg['from_me'] as boolean
    if (fromMe) continue

    const chatId = (msg['chat_id'] ?? msg['from']) as string | undefined
    if (!chatId) continue

    const phone = chatId.replace('@s.whatsapp.net', '').replace(/^55/, '')
    const content = (msg['text'] as Record<string, unknown> | undefined)?.['body'] as string ?? ''

    logger.info({ phone, content }, 'Mensagem recebida via Whapi')

    const lead = await prisma.lead.findFirst({
      where: { OR: [{ phone: { contains: phone } }, { whatsapp: { contains: phone } }] },
    })

    if (!lead) {
      logger.warn({ phone }, 'Webhook Whapi: lead não encontrado')
      continue
    }

    const recentCampaignLead = await prisma.campaignLead.findFirst({
      where: { leadId: lead.id },
      orderBy: { sentAt: 'desc' },
    })

    const updates: Promise<unknown>[] = [
      prisma.interaction.create({ data: { leadId: lead.id, type: 'WHATSAPP', channel: 'whatsapp', content, direction: 'IN' } }),
      prisma.lead.update({ where: { id: lead.id }, data: { status: 'REPLIED', pipelineStage: 'replied', lastContactAt: new Date() } }),
    ]
    if (recentCampaignLead) {
      updates.push(
        prisma.campaignLead.update({ where: { id: recentCampaignLead.id }, data: { replied: true, repliedAt: new Date(), status: 'REPLIED' } })
      )
    }
    await Promise.all(updates)

    handleLeadReply(lead.id).catch((err) =>
      logger.warn({ err, leadId: lead.id }, 'Erro ao pausar cadências na resposta')
    )

    if (env.WHATSAPP_AGENT_ENABLED && content.trim()) {
      processMessage(lead.id, content).catch((err) =>
        logger.error({ err, leadId: lead.id }, 'Agente: erro ao processar mensagem recebida')
      )
    }
  }
}

// ─── Webhook Meta WABA ────────────────────────────────────────────────────────
// Formato Meta: { object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages, statuses } }] }] }

export async function processMetaWebhook(body: Record<string, unknown>): Promise<void> {
  logger.info({ payload: JSON.stringify(body) }, 'Webhook Meta WABA recebido')

  const entry = body['entry'] as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(entry)) return

  for (const e of entry) {
    const changes = e['changes'] as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(changes)) continue

    for (const change of changes) {
      const value = change['value'] as Record<string, unknown> | undefined
      if (!value) continue

      // Status de entrega
      const statuses = value['statuses'] as Array<Record<string, unknown>> | undefined
      if (Array.isArray(statuses)) {
        for (const status of statuses) {
          const phone = (status['recipient_id'] as string ?? '').replace(/^55/, '')
          const type = status['status'] as string | undefined
          if (!phone || !type) continue

          const campaignLeads = await prisma.campaignLead.findMany({
            where: { lead: { OR: [{ phone: { contains: phone } }, { whatsapp: { contains: phone } }] } },
            orderBy: { sentAt: 'desc' },
            take: 1,
          })
          if (campaignLeads.length === 0) continue
          const cl = campaignLeads[0]

          if (type === 'delivered') {
            await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'DELIVERED', deliveredAt: new Date() } })
          } else if (type === 'read') {
            await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'OPENED', openedAt: new Date() } })
          }
        }
      }

      // Mensagens recebidas
      const messages = value['messages'] as Array<Record<string, unknown>> | undefined
      if (!Array.isArray(messages)) continue

      for (const msg of messages) {
        const phone = ((msg['from'] as string) ?? '').replace(/^55/, '')
        const content = (msg['text'] as Record<string, unknown> | undefined)?.['body'] as string ?? ''
        if (!phone) continue

        logger.info({ phone, content }, 'Mensagem recebida via Meta WABA')

        const lead = await prisma.lead.findFirst({
          where: { OR: [{ phone: { contains: phone } }, { whatsapp: { contains: phone } }] },
        })

        if (!lead) {
          logger.warn({ phone }, 'Webhook Meta: lead não encontrado')
          continue
        }

        const recentCampaignLead = await prisma.campaignLead.findFirst({
          where: { leadId: lead.id },
          orderBy: { sentAt: 'desc' },
        })

        const updates: Promise<unknown>[] = [
          prisma.interaction.create({ data: { leadId: lead.id, type: 'WHATSAPP', channel: 'whatsapp_waba', content, direction: 'IN' } }),
          prisma.lead.update({ where: { id: lead.id }, data: { status: 'REPLIED', pipelineStage: 'replied', lastContactAt: new Date() } }),
        ]
        if (recentCampaignLead) {
          updates.push(
            prisma.campaignLead.update({ where: { id: recentCampaignLead.id }, data: { replied: true, repliedAt: new Date(), status: 'REPLIED' } })
          )
        }
        await Promise.all(updates)

        handleLeadReply(lead.id).catch((err) =>
          logger.warn({ err, leadId: lead.id }, 'Erro ao pausar cadências na resposta (WABA)')
        )

        // Maya responde via Whapi (canal de conversa)
        if (env.WHATSAPP_AGENT_ENABLED && content.trim()) {
          processMessage(lead.id, content).catch((err) =>
            logger.error({ err, leadId: lead.id }, 'Agente: erro ao processar mensagem WABA')
          )
        }
      }
    }
  }
}

// ─── Wrapper para whatsappAgent.service.ts ────────────────────────────────────
export async function sendWhatsAppReply(to: string, body: string): Promise<void> {
  await sendText(to, body)
}