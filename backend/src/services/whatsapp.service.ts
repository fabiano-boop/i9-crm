import axios from 'axios'
import { prisma } from '../config/database.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { createTrackingUrl } from './tracking.service.js'
import { processMessage, handleLeadReply } from './whatsappAgent.service.js'

const evolutionHttp = axios.create({
  baseURL: env.EVOLUTION_API_URL,
  headers: { apikey: env.EVOLUTION_API_KEY },
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

// Envia mensagem com retry automático (3x)
export async function sendText(phone: string, message: string, retries = 3): Promise<boolean> {
  const number = phone.replace(/\D/g, '')
  if (!number) return false

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await evolutionHttp.post(`/message/sendText/${env.EVOLUTION_INSTANCE_NAME}`, {
        number: `55${number}`,
        text: message,
      })
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.warn({ phone, attempt, err: msg }, 'Falha ao enviar WhatsApp')
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

    // Personaliza mensagem com variáveis do lead
    const vars: Record<string, string> = {
      nome: lead.name,
      negocio: lead.businessName,
      bairro: lead.neighborhood,
      nicho: lead.niche,
      angulo: lead.whatsappAngle ?? '',
    }

    // Substitui URLs por links rastreados
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

    // Delay humano entre mensagens (exceto no último)
    if (cl !== pendingLeads[pendingLeads.length - 1]) await humanDelay()
  }

  // Finaliza campanha
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'COMPLETED' },
  })

  logger.info({ campaignId, sent, failed }, 'Disparo WhatsApp concluído')
}

// Webhook handler — processa eventos da Evolution API
export async function processWhatsAppWebhook(body: Record<string, unknown>): Promise<void> {
  const event = body['event'] as string
  const data = body['data'] as Record<string, unknown>
  if (!event || !data) return

  logger.debug({ event }, 'Webhook WhatsApp recebido')

  // Tenta localizar o CampaignLead pelo número do destinatário
  const remoteJid = (data['key'] as Record<string, unknown>)?.['remoteJid'] as string
  if (!remoteJid) return
  const phone = remoteJid.replace('@s.whatsapp.net', '').replace('55', '')

  const campaignLeads = await prisma.campaignLead.findMany({
    where: { lead: { OR: [{ phone: { contains: phone } }, { whatsapp: { contains: phone } }] } },
    orderBy: { sentAt: 'desc' },
    take: 1,
  })
  if (campaignLeads.length === 0) return

  const cl = campaignLeads[0]

  if (event === 'messages.update') {
    const status = (data['update'] as Record<string, unknown>)?.['status'] as string
    if (status === 'DELIVERY_ACK') {
      await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'DELIVERED', deliveredAt: new Date() } })
    } else if (status === 'READ') {
      await prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'OPENED', openedAt: new Date() } })
    }
  } else if (event === 'messages.upsert') {
    // Mensagem recebida = resposta do lead
    const fromMe = (data['key'] as Record<string, unknown>)?.['fromMe'] as boolean
    if (!fromMe) {
      const content = (data['message'] as Record<string, unknown>)?.['conversation'] as string ?? ''

      await Promise.all([
        prisma.campaignLead.update({ where: { id: cl.id }, data: { replied: true, repliedAt: new Date(), status: 'REPLIED' } }),
        prisma.interaction.create({ data: { leadId: cl.leadId, type: 'WHATSAPP', channel: 'whatsapp', content, direction: 'IN' } }),
        prisma.lead.update({ where: { id: cl.leadId }, data: { status: 'REPLIED', lastContactAt: new Date() } }),
      ])

      // Pausa cadências ativas ao receber resposta
      handleLeadReply(cl.leadId).catch((err) =>
        logger.warn({ err, leadId: cl.leadId }, 'Erro ao pausar cadências na resposta')
      )

      // Agente IA processa a mensagem (fire-and-forget para não bloquear webhook)
      if (env.WHATSAPP_AGENT_ENABLED && content.trim()) {
        processMessage(cl.leadId, content).catch((err) =>
          logger.error({ err, leadId: cl.leadId }, 'Agente: erro ao processar mensagem recebida')
        )
      }
    }
  }
}
