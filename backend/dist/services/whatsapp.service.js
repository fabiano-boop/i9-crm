"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendText = sendText;
exports.sendCampaignWhatsApp = sendCampaignWhatsApp;
exports.processWhatsAppWebhook = processWhatsAppWebhook;
const axios_1 = __importDefault(require("axios"));
const database_js_1 = require("../config/database.js");
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../utils/logger.js");
const tracking_service_js_1 = require("./tracking.service.js");
const whatsappAgent_service_js_1 = require("./whatsappAgent.service.js");
const whapiHttp = axios_1.default.create({
    baseURL: env_js_1.env.WHAPI_URL,
    headers: { Authorization: `Bearer ${env_js_1.env.WHAPI_TOKEN}` },
    timeout: 15_000,
});
// Substitui variáveis do template com dados do lead
function interpolate(template, vars) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}
// Delay aleatório entre 30-60s para parecer humano
function humanDelay() {
    const ms = 30_000 + Math.random() * 30_000;
    return new Promise((r) => setTimeout(r, ms));
}
// Normaliza número para formato Whapi: 5511999999999
function normalizePhone(phone) {
    const digits = phone.replace(/\D/g, '');
    // Já tem DDI 55
    if (digits.startsWith('55') && digits.length >= 12)
        return digits;
    return `55${digits}`;
}
// Envia mensagem com retry automático (3x)
async function sendText(phone, message, retries = 3) {
    const to = normalizePhone(phone);
    if (to.length < 12)
        return false;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await whapiHttp.post('/messages/text', { to, body: message });
            return true;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger_js_1.logger.warn({ phone: to, attempt, err: msg }, 'Falha ao enviar WhatsApp via Whapi');
            if (attempt < retries)
                await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
    }
    return false;
}
async function sendCampaignWhatsApp(campaignId) {
    const campaign = await database_js_1.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign)
        throw new Error('Campanha não encontrada');
    const pendingLeads = await database_js_1.prisma.campaignLead.findMany({
        where: { campaignId, status: 'PENDING' },
        include: { lead: true },
    });
    logger_js_1.logger.info({ campaignId, total: pendingLeads.length }, 'Iniciando disparo WhatsApp');
    let sent = 0;
    let failed = 0;
    for (const cl of pendingLeads) {
        const lead = cl.lead;
        const phone = lead.whatsapp ?? lead.phone ?? '';
        if (!phone) {
            await database_js_1.prisma.campaignLead.update({
                where: { id: cl.id },
                data: { status: 'FAILED', errorMsg: 'Sem número de WhatsApp/telefone' },
            });
            failed++;
            continue;
        }
        const vars = {
            nome: lead.name,
            negocio: lead.businessName,
            bairro: lead.neighborhood,
            nicho: lead.niche,
            angulo: lead.whatsappAngle ?? '',
        };
        let message = interpolate(campaign.bodyText, vars);
        message = message.replace(/(https?:\/\/[^\s]+)/g, (url) => (0, tracking_service_js_1.createTrackingUrl)(cl.id, url));
        const ok = await sendText(phone, message);
        await database_js_1.prisma.campaignLead.update({
            where: { id: cl.id },
            data: ok
                ? { status: 'SENT', sentAt: new Date() }
                : { status: 'FAILED', errorMsg: 'Falha após 3 tentativas' },
        });
        if (ok)
            sent++;
        else
            failed++;
        if (cl !== pendingLeads[pendingLeads.length - 1])
            await humanDelay();
    }
    await database_js_1.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
    });
    logger_js_1.logger.info({ campaignId, sent, failed }, 'Disparo WhatsApp concluído');
}
// Formato do webhook Whapi:
// { messages: [{ id, type, from, chat_id, timestamp, from_me, text: { body } }] }
// { statuses: [{ id, type: "sent"|"delivered"|"read"|"failed", chat_id, timestamp }] }
async function processWhatsAppWebhook(body) {
    logger_js_1.logger.info({ payload: JSON.stringify(body) }, 'Webhook Whapi recebido');
    logger_js_1.logger.debug({ keys: Object.keys(body) }, 'Webhook Whapi recebido');
    // Status de entrega
    const statuses = body['statuses'];
    if (Array.isArray(statuses)) {
        for (const status of statuses) {
            const chatId = status['chat_id'];
            const type = status['type'];
            if (!chatId || !type)
                continue;
            const phone = chatId.replace('@s.whatsapp.net', '').replace(/^55/, '');
            const campaignLeads = await database_js_1.prisma.campaignLead.findMany({
                where: { lead: { OR: [{ phone: { contains: phone } }, { whatsapp: { contains: phone } }] } },
                orderBy: { sentAt: 'desc' },
                take: 1,
            });
            if (campaignLeads.length === 0)
                continue;
            const cl = campaignLeads[0];
            if (type === 'delivered') {
                await database_js_1.prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
            }
            else if (type === 'read') {
                await database_js_1.prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'OPENED', openedAt: new Date() } });
            }
        }
    }
    // Mensagens recebidas
    const messages = body['messages'];
    if (!Array.isArray(messages))
        return;
    for (const msg of messages) {
        const fromMe = msg['from_me'];
        if (fromMe)
            continue;
        const chatId = (msg['chat_id'] ?? msg['from']);
        if (!chatId)
            continue;
        const phone = chatId.replace('@s.whatsapp.net', '').replace(/^55/, '');
        const content = msg['text']?.['body'] ?? '';
        logger_js_1.logger.info({ phone, content }, 'Mensagem recebida via Whapi');
        // Busca direto na tabela Lead — sem depender de CampaignLead
        const lead = await database_js_1.prisma.lead.findFirst({
            where: { OR: [{ phone: { contains: phone } }, { whatsapp: { contains: phone } }] },
        });
        if (!lead) {
            logger_js_1.logger.warn({ phone }, 'Webhook: lead não encontrado para o número');
            continue;
        }
        logger_js_1.logger.info({ leadId: lead.id, leadName: lead.name, phone }, 'Lead identificado via webhook');
        // Atualiza CampaignLead mais recente se existir (tracking de campanha)
        const recentCampaignLead = await database_js_1.prisma.campaignLead.findFirst({
            where: { leadId: lead.id },
            orderBy: { sentAt: 'desc' },
        });
        const updates = [
            database_js_1.prisma.interaction.create({ data: { leadId: lead.id, type: 'WHATSAPP', channel: 'whatsapp', content, direction: 'IN' } }),
            database_js_1.prisma.lead.update({ where: { id: lead.id }, data: { status: 'REPLIED', lastContactAt: new Date() } }),
        ];
        if (recentCampaignLead) {
            updates.push(database_js_1.prisma.campaignLead.update({ where: { id: recentCampaignLead.id }, data: { replied: true, repliedAt: new Date(), status: 'REPLIED' } }));
        }
        await Promise.all(updates);
        (0, whatsappAgent_service_js_1.handleLeadReply)(lead.id).catch((err) => logger_js_1.logger.warn({ err, leadId: lead.id }, 'Erro ao pausar cadências na resposta'));
        if (env_js_1.env.WHATSAPP_AGENT_ENABLED && content.trim()) {
            (0, whatsappAgent_service_js_1.processMessage)(lead.id, content).catch((err) => logger_js_1.logger.error({ err, leadId: lead.id }, 'Agente: erro ao processar mensagem recebida'));
        }
    }
}
//# sourceMappingURL=whatsapp.service.js.map