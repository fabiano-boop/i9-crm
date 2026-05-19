import { Router, Request, Response } from 'express'
import { processWhatsAppWebhook, processMetaWebhook } from '../services/whatsapp.service.js'
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

/**
 * GET /api/webhooks/meta
 *
 * Verificação do webhook pela Meta (obrigatório no setup).
 * A Meta envia hub.mode, hub.verify_token e hub.challenge.
 */
router.get('/meta', (req: Request, res: Response): void => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    logger.info('Webhook Meta verificado com sucesso')
    res.status(200).send(challenge)
  } else {
    logger.warn({ mode, token }, 'Webhook Meta: verificação falhou')
    res.status(403).json({ error: 'Forbidden' })
  }
})

/**
 * POST /api/webhooks/meta
 *
 * Recebe eventos da Meta WABA (delivery status + mensagens recebidas).
 * Configure no Meta Business Manager:
 *   URL: https://i9-crm-production.up.railway.app/api/webhooks/meta
 *   Verify Token: i9crm-meta-webhook-2026
 *   Eventos: messages
 *
 * Rota pública (sem JWT).
 */
router.post('/meta', async (req: Request, res: Response): Promise<void> => {
  // Responde 200 imediatamente para a Meta não reenviar
  res.status(200).json({ received: true })

  processMetaWebhook(req.body as Record<string, unknown>).catch((err) => {
    // DEBUG TEMPORÁRIO — remover após validação
    logger.error({
      errMessage: err instanceof Error ? err.message : err,
      errStack: err instanceof Error ? err.stack : undefined,
    }, '[DEBUG] Erro completo ao processar webhook Meta WABA')
  })
})

export default router