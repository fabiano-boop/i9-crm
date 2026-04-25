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

// Envia documento (PDF) via Whapi usando base64
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

    if (ok) {
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
    data: { status: 'COMPLETED' },
  })

  logger.info({ campaignId, sent, failed }, 'Disparo WhatsApp concluído')
}

// Formato do webhook Whapi:
// { messages: [{ id, type, from, chat_id, timestamp, from_me, text: { body } }] }
// { statuses: [{ id, type: "sent"|"delivered"|"read"|"failed", chat_id, timestamp }] }
export async function processWhatsAppWebhook(body: Record<string, unknown>): Promise<void> {
  logger.info({ payload: JSON.stringify(body) }, 'Webhook Whapi recebido')
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

    // Busca direto na tabela Lead — sem depender de CampaignLead
    const lead = await prisma.lead.findFirst({
      where: { OR: [{ phone: { contains: phone } }, { whatsapp: { contains: phone } }] },
    })

    if (!lead) {
      logger.warn({ phone }, 'Webhook: lead não encontrado para o número')
      continue
    }

    logger.info({ leadId: lead.id, leadName: lead.name, phone }, 'Lead identificado via webhook')

    // Atualiza CampaignLead mais recente se existir (tracking de campanha)
    const recentCampaignLead = await prisma.campaignLead.findFirst({
      where: { leadId: lead.id },
      orderBy: { sentAt: 'desc' },
    })
    const updates: Promise<unknown>[] = [
      prisma.interaction.create({ data: { leadId: lead.id, type: 'WHATSAPP', channel: 'whatsapp', content, direction: 'IN' } }),
      prisma.lead.update({ where: { id: lead.id }, data: { status: 'REPLIED', lastContactAt: new Date() } }),
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
