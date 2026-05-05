import { Router, Request, Response } from 'express'
import { processWhatsAppWebhook } from '../services/whatsapp.service.js'
import { logger } from '../utils/logger.js'

const router = Router()

/**
 * POST /api/webhooks/whatsapp
 *
 * Recebe eventos da Whapi (delivery status + mensagens recebidas).
 * Configure no painel da Whapi:
 *   URL: https://seu-backend.com/api/webhooks/whatsapp
 *   Eventos: messages, statuses
 *
 * Rota pública (sem JWT).
 */
router.post('/whatsapp', async (req: Request, res: Response): Promise<void> => {
  // Responde 200 imediatamente para a Whapi não reenviar
  res.status(200).json({ received: true })

  // Processa de forma assíncrona sem bloquear a resposta
  processWhatsAppWebhook(req.body as Record<string, unknown>).catch((err) => {
    logger.error({ err }, 'Erro ao processar webhook WhatsApp')
  })
})

export default router
