import { prisma } from '../config/database.js'
import { logger } from '../utils/logger.js'
import { sendText } from './whatsapp.service.js'
import { broadcast } from './websocket.service.js'
import type { LeadCadence } from '@prisma/client'

interface FollowUpStep {
  day: number
  channel: 'whatsapp' | 'email'
  message: string
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setHours(d.getHours() + days * 24)
  return d
}

export async function startCadence(leadId: string, sequenceId: string): Promise<LeadCadence> {
  const sequence = await prisma.followUpSequence.findUnique({ where: { id: sequenceId } })
  if (!sequence) throw new Error('Sequência não encontrada')

  const steps = sequence.steps as unknown as FollowUpStep[]
  if (!steps.length) throw new Error('Sequência sem steps')

  const cadence = await prisma.leadCadence.create({
    data: {
      leadId,
      sequenceId,
      currentStep: 0,
      status: 'active',
      nextActionAt: daysFromNow(steps[0].day),
    },
  })

  logger.info({ leadId, sequenceId, cadenceId: cadence.id }, 'Cadência iniciada')
  return cadence
}

export async function pauseCadence(cadenceId: string, reason: string): Promise<LeadCadence> {
  return prisma.leadCadence.update({
    where: { id: cadenceId },
    data: { status: 'paused', pausedAt: new Date(), pauseReason: reason },
  })
}

export async function resumeCadence(cadenceId: string): Promise<LeadCadence> {
  return prisma.leadCadence.update({
    where: { id: cadenceId },
    data: { status: 'active', pausedAt: null, pauseReason: null },
  })
}

export async function cancelCadence(cadenceId: string): Promise<LeadCadence> {
  return prisma.leadCadence.update({
    where: { id: cadenceId },
    data: { status: 'cancelled' },
  })
}

export async function processStep(cadenceId: string): Promise<void> {
  const cadence = await prisma.leadCadence.findUnique({
    where: { id: cadenceId },
    include: { lead: true, sequence: true },
  })

  if (!cadence || cadence.status !== 'active') return

  const steps = cadence.sequence.steps as unknown as FollowUpStep[]
  const step  = steps[cadence.currentStep]
  if (!step) return

  const { lead } = cadence
  const vars: Record<string, string> = {
    nome:    lead.name,
    negocio: lead.businessName,
    nicho:   lead.niche,
    bairro:  lead.neighborhood,
    angulo:  lead.whatsappAngle ?? '',
    servico: lead.idealService  ?? '',
  }

  const message = interpolate(step.message, vars)

  try {
    if (step.channel === 'whatsapp') {
      const phone = lead.whatsapp ?? lead.phone ?? ''
      if (phone) await sendText(phone, message)
    }
    // email: logado — sendCampaignEmail é por campanha, não por lead individual
    logger.info({ cadenceId, step: cadence.currentStep, channel: step.channel }, 'Step enviado')
  } catch (err) {
    logger.error({ err, cadenceId }, 'Erro ao enviar step de cadência')
    throw err
  }

  await prisma.interaction.create({
    data: {
      leadId:    lead.id,
      type:      step.channel === 'whatsapp' ? 'WHATSAPP' : 'EMAIL',
      channel:   step.channel,
      content:   message,
      direction: 'OUT',
    },
  })

  const isLastStep = cadence.currentStep >= steps.length - 1

  if (isLastStep) {
    await prisma.leadCadence.update({
      where: { id: cadenceId },
      data: { status: 'completed', completedAt: new Date(), nextActionAt: null },
    })
    logger.info({ cadenceId }, 'Cadência concluída')
  } else {
    const nextStep = steps[cadence.currentStep + 1]
    await prisma.leadCadence.update({
      where: { id: cadenceId },
      data: {
        currentStep:  cadence.currentStep + 1,
        nextActionAt: daysFromNow(nextStep.day),
      },
    })
  }
}

export async function pauseActiveCadencesForLead(leadId: string, reason: string): Promise<number> {
  const active = await prisma.leadCadence.findMany({
    where: { leadId, status: 'active' },
    select: { id: true },
  })

  if (!active.length) return 0

  await prisma.leadCadence.updateMany({
    where: { leadId, status: 'active' },
    data: { status: 'paused', pausedAt: new Date(), pauseReason: reason },
  })

  broadcast({
    type: 'cadence:paused',
    data: { leadId, reason, count: active.length, timestamp: new Date().toISOString() },
  })

  logger.info({ leadId, reason, count: active.length }, 'Cadências pausadas por resposta do lead')
  return active.length
}
