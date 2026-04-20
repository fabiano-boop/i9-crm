import axios from 'axios'
import { prisma } from '../config/database.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { createTrackingUrl } from './tracking.service.js'
import { processMessage, handleLeadReply } from './whatsappAgent.service.js'

const whapiHttp = axios.create({
  baseURL: env.WHAPI_URL,
  headers: { Authorization: `Bearer ${env.WHAPI_TOKEN}` },
  timeout: 15_000,
})

// Substitui variáveis do template com dados do lead
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

// Delay aleatório entre 30-60s para parecer humano
function humanDelay(): Promise<void> {
  const ms = 30_000 + Math.random() * 30_000
  return new Promise((r) => setTimeout(r, ms))
}

// Normaliza número para formato Whapi: 5511999999999
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Já tem DDI 55
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return `55${digits}`
}

// Envia mensagem com retry automático (3x)
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

export async function sendCampaignWhatsApp(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
  if (!campaign) throw new Error('Campanha não encontrada')

  const pendingLeads = await prisma.campaignLead.findMany({
    where: { campaignId, status: 'PENDING' },
    include: { lead: true },
  })

  logger.info({ campaignId, total: pendingLeads.length }, 'Iniciando disparo WhatsApp')

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
    message = message.replace(
      /(https?:\/\/[^\s]+)/g,
      (url) => createTrackingUrl(cl.id, url)
    )

    const ok = await sendText(phone, message)

    await prisma.campaignLead.update({
      where: { id: cl.id },
      data: ok
        ? { status: 'SENT', sentAt: new Date() }
        : { status: 'FAILED', errorMsg: 'Falha após 3 tentativas' },
    })

    if (ok) sent++; else failed++

    if (cl !== pendingLeads[pendingLeads.length - 1]) await humanDelay()
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'COMPLETED' },
  })

  logger.info({ campaignId, sent, failed }, 'Disparo WhatsApp concluído')
}

// Formato do webhook Whapi:
// { messages: [{ id, type, from, chat_id, timestamp, from_me, text: { body } }] }
// { statuses: [{ id, type: "sent"|"delivered"|"read"|"failed", chat_id, timestamp }] }
export async function processWhatsAppWebhook(body: Record<string, unknown>): Promise<void> {
  logger.debug({ keys: Object.keys(body) }, 'Webhook Whapi recebido')

  // Status de entrega
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

  // Mensagens recebidas
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

    const campaignLeads = await prisma.campaignLead.findMany({
      where: { lead: { OR: [{ phone: { contains: phone } }, { whatsapp: { contains: phone } }] } },
      orderBy: { sentAt: 'desc' },
      take: 1,
    })
    if (campaignLeads.length === 0) {
      logger.warn({ phone }, 'Webhook: lead não encontrado para o número')
      continue
    }

    const cl = campaignLeads[0]

    await Promise.all([
      prisma.campaignLead.update({ where: { id: cl.id }, data: { replied: true, repliedAt: new Date(), status: 'REPLIED' } }),
      prisma.interaction.create({ data: { leadId: cl.leadId, type: 'WHATSAPP', channel: 'whatsapp', content, direction: 'IN' } }),
      prisma.lead.update({ where: { id: cl.leadId }, data: { status: 'REPLIED', lastContactAt: new Date() } }),
    ])

    handleLeadReply(cl.leadId).catch((err) =>
      logger.warn({ err, leadId: cl.leadId }, 'Erro ao pausar cadências na resposta')
    )

    if (env.WHATSAPP_AGENT_ENABLED && content.trim()) {
      processMessage(cl.leadId, content).catch((err) =>
        logger.error({ err, leadId: cl.leadId }, 'Agente: erro ao processar mensagem recebida')
      )
    }
  }
}
