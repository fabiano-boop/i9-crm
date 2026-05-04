import cron from 'node-cron'
import { prisma } from '../config/database.js'
import { processMessage } from './whatsappAgent.service.js'
import { logger } from '../utils/logger.js'

const FOLLOW_UP_TRIGGER =
  '[FOLLOWUP] Lead não respondeu à mensagem anterior. ' +
  'Envie uma mensagem de retomada curta, natural e consultiva para reengajar. ' +
  'Não mencione que é um processo automático.'

class FollowUpService {
  start(): void {
    // Roda às 10h e 15h UTC (07h e 12h BRT)
    cron.schedule('0 10,15 * * *', async () => {
      try {
        await this.processFollowUps()
      } catch (err) {
        logger.error({ err }, '[FollowUp] Erro inesperado no job')
      }
    })
    logger.info('[FollowUp] Serviço iniciado — rodando às 10h e 15h UTC')
  }

  async processFollowUps(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h atrás

    const leads = await prisma.lead.findMany({
      where: {
        // Recebeu mensagem de saída há mais de 24h e não respondeu
        interactions: {
          some: { type: 'WHATSAPP', direction: 'OUT', createdAt: { lt: cutoff } },
          none: { type: 'WHATSAPP', direction: 'IN' },
        },
        followUpSentAt: null,
        humanMode: false,
        status: { notIn: ['CLOSED', 'LOST'] },
      },
      take: 5,
      orderBy: { score: 'desc' },
    })

    logger.info({ count: leads.length }, '[FollowUp] Iniciando processamento')

    for (const lead of leads) {
      try {
        await processMessage(lead.id, FOLLOW_UP_TRIGGER)
        await prisma.lead.update({
          where: { id: lead.id },
          data: { followUpSentAt: new Date() },
        })
        // Delay humanizado entre envios (45–90s)
        const delay = 45_000 + Math.random() * 45_000
        await new Promise((r) => setTimeout(r, delay))
      } catch (err) {
        logger.error({ err, leadId: lead.id }, '[FollowUp] Erro ao processar lead')
      }
    }

    logger.info({ count: leads.length }, '[FollowUp] Processamento concluído')
  }
}

export const followUpService = new FollowUpService()
