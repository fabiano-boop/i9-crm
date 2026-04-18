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
const evolutionHttp = axios_1.default.create({
    baseURL: env_js_1.env.EVOLUTION_API_URL,
    headers: { apikey: env_js_1.env.EVOLUTION_API_KEY },
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
// Envia mensagem com retry automático (3x)
async function sendText(phone, message, retries = 3) {
    const number = phone.replace(/\D/g, '');
    if (!number)
        return false;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await evolutionHttp.post(`/message/sendText/${env_js_1.env.EVOLUTION_INSTANCE_NAME}`, {
                number: `55${number}`,
                text: message,
            });
            return true;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger_js_1.logger.warn({ phone, attempt, err: msg }, 'Falha ao enviar WhatsApp');
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
        // Personaliza mensagem com variáveis do lead
        const vars = {
            nome: lead.name,
            negocio: lead.businessName,
            bairro: lead.neighborhood,
            nicho: lead.niche,
            angulo: lead.whatsappAngle ?? '',
        };
        // Substitui URLs por links rastreados
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
        // Delay humano entre mensagens (exceto no último)
        if (cl !== pendingLeads[pendingLeads.length - 1])
            await humanDelay();
    }
    // Finaliza campanha
    await database_js_1.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
    });
    logger_js_1.logger.info({ campaignId, sent, failed }, 'Disparo WhatsApp concluído');
}
// Webhook handler — processa eventos da Evolution API
async function processWhatsAppWebhook(body) {
    const event = body['event'];
    const data = body['data'];
    if (!event || !data)
        return;
    logger_js_1.logger.debug({ event }, 'Webhook WhatsApp recebido');
    // Tenta localizar o CampaignLead pelo número do destinatário
    const remoteJid = data['key']?.['remoteJid'];
    if (!remoteJid)
        return;
    const phone = remoteJid.replace('@s.whatsapp.net', '').replace('55', '');
    const campaignLeads = await database_js_1.prisma.campaignLead.findMany({
        where: { lead: { OR: [{ phone: { contains: phone } }, { whatsapp: { contains: phone } }] } },
        orderBy: { sentAt: 'desc' },
        take: 1,
    });
    if (campaignLeads.length === 0)
        return;
    const cl = campaignLeads[0];
    if (event === 'messages.update') {
        const status = data['update']?.['status'];
        if (status === 'DELIVERY_ACK') {
            await database_js_1.prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
        }
        else if (status === 'READ') {
            await database_js_1.prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'OPENED', openedAt: new Date() } });
        }
    }
    else if (event === 'messages.upsert') {
        // Mensagem recebida = resposta do lead
        const fromMe = data['key']?.['fromMe'];
        if (!fromMe) {
            const content = data['message']?.['conversation'] ?? '';
            await Promise.all([
                database_js_1.prisma.campaignLead.update({ where: { id: cl.id }, data: { replied: true, repliedAt: new Date(), status: 'REPLIED' } }),
                database_js_1.prisma.interaction.create({ data: { leadId: cl.leadId, type: 'WHATSAPP', channel: 'whatsapp', content, direction: 'IN' } }),
                database_js_1.prisma.lead.update({ where: { id: cl.leadId }, data: { status: 'REPLIED', lastContactAt: new Date() } }),
            ]);
            // Pausa cadências ativas ao receber resposta
            (0, whatsappAgent_service_js_1.handleLeadReply)(cl.leadId).catch((err) => logger_js_1.logger.warn({ err, leadId: cl.leadId }, 'Erro ao pausar cadências na resposta'));
            // Agente IA processa a mensagem (fire-and-forget para não bloquear webhook)
            if (env_js_1.env.WHATSAPP_AGENT_ENABLED && content.trim()) {
                (0, whatsappAgent_service_js_1.processMessage)(cl.leadId, content).catch((err) => logger_js_1.logger.error({ err, leadId: cl.leadId }, 'Agente: erro ao processar mensagem recebida'));
            }
        }
    }
}
//# sourceMappingURL=whatsapp.service.js.map