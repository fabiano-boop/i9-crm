"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackOpen = trackOpen;
exports.trackClick = trackClick;
exports.listTrackingEvents = listTrackingEvents;
const database_js_1 = require("../config/database.js");
const tracking_service_js_1 = require("../services/tracking.service.js");
const email_service_js_1 = require("../services/email.service.js");
const logger_js_1 = require("../utils/logger.js");
const websocket_service_js_1 = require("../services/websocket.service.js");
const opportunityAlert_service_js_1 = require("../services/opportunityAlert.service.js");
// GET /track/open/:token — pixel de abertura de email
async function trackOpen(req, res) {
    const token = req.params['token'];
    try {
        const cl = await database_js_1.prisma.campaignLead.findUnique({ where: { trackingToken: token } });
        if (cl && cl.status !== 'OPENED' && cl.status !== 'CLICKED' && cl.status !== 'REPLIED') {
            await Promise.all([
                database_js_1.prisma.campaignLead.update({
                    where: { id: cl.id },
                    data: { status: 'OPENED', openedAt: new Date() },
                }),
                database_js_1.prisma.trackingEvent.create({
                    data: {
                        leadId: cl.leadId,
                        token,
                        type: 'open',
                        ip: req.ip,
                        userAgent: req.headers['user-agent'],
                    },
                }),
                // Incrementa score de engajamento (+5)
                database_js_1.prisma.lead.update({
                    where: { id: cl.leadId },
                    data: { score: { increment: 5 } },
                }),
            ]);
            // Notifica via WebSocket os agentes sobre o engajamento do lead
            const updatedLead = await database_js_1.prisma.lead.findUnique({
                where: { id: cl.leadId },
                select: { id: true, name: true, businessName: true, score: true, classification: true },
            });
            if (updatedLead) {
                websocket_service_js_1.wsEvents.hotAlert(updatedLead, 'open');
            }
            logger_js_1.logger.debug({ leadId: cl.leadId, token }, 'Email aberto rastreado');
        }
    }
    catch (err) {
        logger_js_1.logger.warn({ token, err }, 'Erro ao registrar abertura');
    }
    // SEMPRE retorna o pixel — nunca 404
    res.set({
        'Content-Type': 'image/gif',
        'Content-Length': email_service_js_1.TRACKING_PIXEL_GIF.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
    });
    res.end(email_service_js_1.TRACKING_PIXEL_GIF);
}
// GET /track/click/:campaignLeadId/:hash — link rastreado
async function trackClick(req, res) {
    const campaignLeadId = req.params['campaignLeadId'];
    const hash = req.params['hash'];
    const encodedUrl = req.query['u'];
    if (!encodedUrl) {
        res.status(400).send('Link inválido');
        return;
    }
    let originalUrl;
    try {
        originalUrl = Buffer.from(encodedUrl, 'base64url').toString('utf8');
    }
    catch {
        res.status(400).send('Link corrompido');
        return;
    }
    // Verifica autenticidade do hash
    if (!(0, tracking_service_js_1.verifyTrackingHash)(campaignLeadId, originalUrl, hash)) {
        logger_js_1.logger.warn({ campaignLeadId, hash }, 'Hash de tracking inválido');
        res.redirect(302, originalUrl); // redireciona mesmo assim, mas não registra
        return;
    }
    try {
        const cl = await database_js_1.prisma.campaignLead.findUnique({ where: { id: campaignLeadId } });
        if (cl) {
            const wasAlreadyClicked = cl.status === 'CLICKED' || cl.status === 'REPLIED';
            await Promise.all([
                !wasAlreadyClicked && database_js_1.prisma.campaignLead.update({
                    where: { id: campaignLeadId },
                    data: { status: 'CLICKED', clickedAt: new Date() },
                }),
                database_js_1.prisma.trackingEvent.create({
                    data: {
                        leadId: cl.leadId,
                        token: cl.trackingToken,
                        type: 'click',
                        url: originalUrl,
                        ip: req.ip,
                        userAgent: req.headers['user-agent'],
                    },
                }),
                // Incrementa score (+15 por clique)
                database_js_1.prisma.lead.update({
                    where: { id: cl.leadId },
                    data: { score: { increment: 15 } },
                }),
            ].filter(Boolean));
            // Reclassifica para HOT se score >= 80
            const lead = await database_js_1.prisma.lead.findUnique({
                where: { id: cl.leadId },
                select: { id: true, name: true, businessName: true, score: true, classification: true },
            });
            if (lead && lead.score >= 80 && lead.classification !== 'HOT') {
                await database_js_1.prisma.lead.update({ where: { id: cl.leadId }, data: { classification: 'HOT' } });
                logger_js_1.logger.info({ leadId: cl.leadId }, 'Lead promovido para HOT por clique em link');
            }
            // Notifica via WebSocket os agentes sobre o clique do lead
            if (lead) {
                websocket_service_js_1.wsEvents.hotAlert({ ...lead, classification: lead.score >= 80 ? 'HOT' : lead.classification }, 'click');
            }
            // Verifica alerta de oportunidade após clique
            (0, opportunityAlert_service_js_1.checkHotEngagement)(cl.leadId).then((alert) => {
                if (alert)
                    websocket_service_js_1.wsEvents.opportunityAlert(alert);
            }).catch(() => null);
            logger_js_1.logger.debug({ leadId: cl.leadId, url: originalUrl }, 'Clique rastreado');
        }
    }
    catch (err) {
        logger_js_1.logger.warn({ campaignLeadId, err }, 'Erro ao registrar clique');
    }
    // Redirect 302 para URL original
    res.redirect(302, originalUrl);
}
// GET /track/events — lista eventos (API interna)
async function listTrackingEvents(req, res) {
    const { leadId, type, since } = req.query;
    const events = await database_js_1.prisma.trackingEvent.findMany({
        where: {
            ...(leadId && { leadId }),
            ...(type && { type }),
            ...(since && { createdAt: { gte: new Date(since) } }),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    res.json(events);
}
//# sourceMappingURL=tracking.controller.js.map