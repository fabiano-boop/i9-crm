import { Router, Request, Response } from 'express'
import { processWhatsAppWebhook } from '../services/whatsapp.service.js'
import { logger } from '../utils/logger.js'

const router = Router()

/**
 * POST /api/webhooks/whatsapp
 *
 * Recebe eventos da Evolution API (delivery status + mensagens recebidas).
 * Configure no painel da Evolution API:
 *   URL: https://seu-backend.com/api/webhooks/whatsapp
 *   Eventos: messages.upsert, messages.update
 *
 * Rota pública (sem JWT) — autenticada pelo EVOLUTION_API_KEY no header se configurado.
 */
router.post('/whatsapp', async (req: Request, res: Response): Promise<void> => {
  // Responde 200 imediatamente para a Evolution API não reenviar
  res.status(200).json({ received: true })

  // Processa de forma assíncrona sem bloquear a resposta
  processWhatsAppWebhook(req.body as Record<string, unknown>).catch((err) => {
    logger.error({ err }, 'Erro ao processar webhook WhatsApp')
  })
})

export default router
