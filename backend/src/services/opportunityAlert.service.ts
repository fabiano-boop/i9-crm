import { prisma } from '../config/database.js'
import { logger } from '../utils/logger.js'
import { Resend } from 'resend'
import { env } from '../config/env.js'
import type { OpportunityAlert } from '@prisma/client'

// Evita criar alertas duplicados dentro de uma janela de tempo
async function alreadyCreated(leadId: string, type: string, withinHours: number): Promise<boolean> {
  const since = new Date()
  since.setHours(since.getHours() - withinHours)
  const existing = await prisma.opportunityAlert.findFirst({
    where: { leadId, type, createdAt: { gte: since } },
  })
  return existing !== null
}

export async function checkHotEngagement(leadId: string): Promise<OpportunityAlert | null> {
  const fourHoursAgo = new Date()
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4)

  const [opens, clicks] = await Promise.all([
    prisma.trackingEvent.count({
      where: { leadId, type: 'open', createdAt: { gte: fourHoursAgo } },
    }),
    prisma.trackingEvent.count({
      where: { leadId, type: 'click', createdAt: { gte: fourHoursAgo } },
    }),
  ])

  const hasEnoughOpens  = opens >= 2
  const hasClick        = clicks >= 1
  if (!hasEnoughOpens && !hasClick) return null

  if (await alreadyCreated(leadId, 'hot_engagement', 12)) return null

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { name: true, businessName: true },
  })
  if (!lead) return null

  const urgency = hasClick ? 10 : 9
  const desc    = hasClick
    ? `Clicou em um link rastreado nas últimas 4h`
    : `Abriu o email ${opens}x nas últimas 4h`

  const alert = await prisma.opportunityAlert.create({
    data: {
      leadId,
      type:        'hot_engagement',
      title:       `🔥 ${lead.businessName} está engajado`,
      description: desc,
      urgency,
    },
  })

  logger.info({ leadId, urgency }, 'Alerta hot_engagement criado')
  return alert
}

export async function checkCoolingLeads(): Promise<number> {
  const fiveDaysAgo = new Date()
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

  const hotLeads = await prisma.lead.findMany({
    where: {
      classification: 'HOT',
      OR: [
        { lastContactAt: null },
        { lastContactAt: { lte: fiveDaysAgo } },
      ],
    },
    select: { id: true, name: true, businessName: true },
  })

  let created = 0
  for (const lead of hotLeads) {
    if (await alreadyCreated(lead.id, 'cooling_lead', 24)) continue
    await prisma.opportunityAlert.create({
      data: {
        leadId:      lead.id,
        type:        'cooling_lead',
        title:       `❄️ ${lead.businessName} esfriando`,
        description: 'Lead HOT sem contato nos últimos 5 dias',
        urgency:     7,
      },
    })
    created++
  }

  logger.info({ checked: hotLeads.length, created }, 'checkCoolingLeads concluído')
  return created
}

export async function checkNoContactWeek(): Promise<number> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const leads = await prisma.lead.findMany({
    where: {
      classification: { in: ['HOT', 'WARM'] },
      OR: [
        { lastContactAt: null },
        { lastContactAt: { lte: sevenDaysAgo } },
      ],
    },
    select: { id: true, name: true, businessName: true, classification: true },
  })

  let created = 0
  for (const lead of leads) {
    if (await alreadyCreated(lead.id, 'no_contact_week', 24)) continue
    await prisma.opportunityAlert.create({
      data: {
        leadId:      lead.id,
        type:        'no_contact_week',
        title:       `📅 ${lead.businessName} — sem contato há 7+ dias`,
        description: `Lead ${lead.classification} sem nenhum contato em mais de uma semana`,
        urgency:     6,
      },
    })
    created++
  }

  logger.info({ checked: leads.length, created }, 'checkNoContactWeek concluído')
  return created
}

export async function generateMorningDigest(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.RESEND_API_KEY) {
    logger.warn('ADMIN_EMAIL ou RESEND_API_KEY não configurado — digest não enviado')
    return
  }

  const top5 = await prisma.opportunityAlert.findMany({
    where: { isRead: false, isDismissed: false },
    orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
    take: 5,
    include: { lead: { select: { businessName: true, classification: true } } },
  })

  if (!top5.length) {
    logger.info('Nenhum alerta pendente — digest não enviado')
    return
  }

  const rows = top5.map((a) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${a.lead.businessName}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${a.title}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${a.urgency}/10</td>
    </tr>
  `).join('')

  const html = `
    <h2 style="color:#1a56db;">☀️ Digest Matinal — i9 CRM</h2>
    <p>Bom dia! Aqui estão as <strong>principais janelas de oportunidade</strong> para hoje:</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:8px;text-align:left;">Lead</th>
          <th style="padding:8px;text-align:left;">Alerta</th>
          <th style="padding:8px;text-align:center;">Urgência</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:12px;color:#999;margin-top:24px;">i9 Soluções Digitais — Zona Leste SP</p>
  `

  const resend = new Resend(env.RESEND_API_KEY)
  await resend.emails.send({
    from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
    to:   env.ADMIN_EMAIL,
    subject: `☀️ Digest i9 CRM — ${new Date().toLocaleDateString('pt-BR')}`,
    html,
  })

  logger.info({ count: top5.length }, 'Digest matinal enviado')
}
