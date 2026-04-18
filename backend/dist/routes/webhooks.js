"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_service_js_1 = require("../services/whatsapp.service.js");
const logger_js_1 = require("../utils/logger.js");
const router = (0, express_1.Router)();
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
router.post('/whatsapp', async (req, res) => {
    // Responde 200 imediatamente para a Evolution API não reenviar
    res.status(200).json({ received: true });
    // Processa de forma assíncrona sem bloquear a resposta
    (0, whatsapp_service_js_1.processWhatsAppWebhook)(req.body).catch((err) => {
        logger_js_1.logger.error({ err }, 'Erro ao processar webhook WhatsApp');
    });
});
exports.default = router;
//# sourceMappingURL=webhooks.js.map