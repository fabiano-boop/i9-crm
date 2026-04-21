"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRACKING_PIXEL_GIF = void 0;
exports.sendCampaignEmail = sendCampaignEmail;
const resend_1 = require("resend");
const nodemailer_1 = __importDefault(require("nodemailer"));
const database_js_1 = require("../config/database.js");
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../utils/logger.js");
const tracking_service_js_1 = require("./tracking.service.js");
// Pixel de rastreamento 1x1 transparente em base64
const TRACKING_PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
exports.TRACKING_PIXEL_GIF = TRACKING_PIXEL_GIF;
function getResend() {
    if (!env_js_1.env.RESEND_API_KEY)
        throw new Error('RESEND_API_KEY não configurado');
    return new resend_1.Resend(env_js_1.env.RESEND_API_KEY);
}
function getSmtpTransport() {
    return nodemailer_1.default.createTransport({
        host: process.env['SMTP_HOST'] ?? 'smtp.gmail.com',
        port: Number(process.env['SMTP_PORT'] ?? 587),
        secure: false,
        auth: { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] },
    });
}
function interpolate(template, vars) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}
function buildHtmlEmail(bodyText, trackingToken, campaignLeadId) {
    const pixelUrl = `${env_js_1.env.TRACKING_BASE_URL}/track/open/${trackingToken}`;
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="border-bottom:3px solid #1a56db;padding-bottom:16px;margin-bottom:24px;">
    <strong style="font-size:20px;color:#1a56db;">i9</strong>
    <span style="color:#666;font-size:14px;margin-left:8px;">Soluções Digitais</span>
  </div>
  <div style="line-height:1.7;white-space:pre-wrap;">${bodyText}</div>
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;">
    i9 Soluções Digitais — Zona Leste de São Paulo<br>
    <a href="${env_js_1.env.TRACKING_BASE_URL}/unsubscribe/${campaignLeadId}" style="color:#999;">Cancelar inscrição</a>
  </div>
  <img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="">
</body></html>`;
}
async function sendCampaignEmail(campaignId) {
    const campaign = await database_js_1.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign)
        throw new Error('Campanha não encontrada');
    const pendingLeads = await database_js_1.prisma.campaignLead.findMany({
        where: { campaignId, status: 'PENDING' },
        include: { lead: true },
    });
    logger_js_1.logger.info({ campaignId, total: pendingLeads.length }, 'Iniciando disparo email');
    let sent = 0;
    let failed = 0;
    const useResend = Boolean(env_js_1.env.RESEND_API_KEY);
    const resend = useResend ? getResend() : null;
    const smtp = useResend ? null : getSmtpTransport();
    for (const cl of pendingLeads) {
        const lead = cl.lead;
        if (!lead.email) {
            await database_js_1.prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'FAILED', errorMsg: 'Sem email' } });
            failed++;
            continue;
        }
        const vars = {
            nome: lead.name, negocio: lead.businessName,
            bairro: lead.neighborhood, servico: lead.idealService ?? '',
        };
        let bodyText = interpolate(campaign.bodyText, vars);
        bodyText = bodyText.replace(/(https?:\/\/[^\s]+)/g, (url) => (0, tracking_service_js_1.createTrackingUrl)(cl.id, url));
        const html = campaign.bodyHtml
            ? interpolate(campaign.bodyHtml, vars)
            : buildHtmlEmail(bodyText, cl.trackingToken, cl.id);
        const subject = campaign.subject ?? `i9 Soluções — ${campaign.name}`;
        try {
            if (resend) {
                await resend.emails.send({
                    from: `${env_js_1.env.EMAIL_FROM_NAME} <${env_js_1.env.EMAIL_FROM}>`,
                    to: lead.email,
                    subject,
                    html,
                    text: bodyText,
                });
            }
            else if (smtp) {
                await smtp.sendMail({ from: `${env_js_1.env.EMAIL_FROM_NAME} <${env_js_1.env.EMAIL_FROM}>`, to: lead.email, subject, html, text: bodyText });
            }
            await database_js_1.prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'SENT', sentAt: new Date() } });
            sent++;
            // Delay de 2-5s entre envios
            await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await database_js_1.prisma.campaignLead.update({ where: { id: cl.id }, data: { status: 'FAILED', errorMsg: msg } });
            failed++;
            logger_js_1.logger.warn({ leadId: lead.id, err: msg }, 'Falha ao enviar email');
        }
    }
    await database_js_1.prisma.campaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED' } });
    logger_js_1.logger.info({ campaignId, sent, failed }, 'Disparo email concluído');
}
//# sourceMappingURL=email.service.js.map