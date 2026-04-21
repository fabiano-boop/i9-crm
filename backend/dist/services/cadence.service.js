"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCadence = startCadence;
exports.pauseCadence = pauseCadence;
exports.resumeCadence = resumeCadence;
exports.cancelCadence = cancelCadence;
exports.processStep = processStep;
exports.pauseActiveCadencesForLead = pauseActiveCadencesForLead;
const database_js_1 = require("../config/database.js");
const logger_js_1 = require("../utils/logger.js");
const whatsapp_service_js_1 = require("./whatsapp.service.js");
const websocket_service_js_1 = require("./websocket.service.js");
function interpolate(template, vars) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}
function daysFromNow(days) {
    const d = new Date();
    d.setHours(d.getHours() + days * 24);
    return d;
}
async function startCadence(leadId, sequenceId) {
    const sequence = await database_js_1.prisma.followUpSequence.findUnique({ where: { id: sequenceId } });
    if (!sequence)
        throw new Error('Sequência não encontrada');
    const steps = sequence.steps;
    if (!steps.length)
        throw new Error('Sequência sem steps');
    const cadence = await database_js_1.prisma.leadCadence.create({
        data: {
            leadId,
            sequenceId,
            currentStep: 0,
            status: 'active',
            nextActionAt: daysFromNow(steps[0].day),
        },
    });
    logger_js_1.logger.info({ leadId, sequenceId, cadenceId: cadence.id }, 'Cadência iniciada');
    return cadence;
}
async function pauseCadence(cadenceId, reason) {
    return database_js_1.prisma.leadCadence.update({
        where: { id: cadenceId },
        data: { status: 'paused', pausedAt: new Date(), pauseReason: reason },
    });
}
async function resumeCadence(cadenceId) {
    return database_js_1.prisma.leadCadence.update({
        where: { id: cadenceId },
        data: { status: 'active', pausedAt: null, pauseReason: null },
    });
}
async function cancelCadence(cadenceId) {
    return database_js_1.prisma.leadCadence.update({
        where: { id: cadenceId },
        data: { status: 'cancelled' },
    });
}
async function processStep(cadenceId) {
    const cadence = await database_js_1.prisma.leadCadence.findUnique({
        where: { id: cadenceId },
        include: { lead: true, sequence: true },
    });
    if (!cadence || cadence.status !== 'active')
        return;
    const steps = cadence.sequence.steps;
    const step = steps[cadence.currentStep];
    if (!step)
        return;
    const { lead } = cadence;
    const vars = {
        nome: lead.name,
        negocio: lead.businessName,
        nicho: lead.niche,
        bairro: lead.neighborhood,
        angulo: lead.whatsappAngle ?? '',
        servico: lead.idealService ?? '',
    };
    const message = interpolate(step.message, vars);
    try {
        if (step.channel === 'whatsapp') {
            const phone = lead.whatsapp ?? lead.phone ?? '';
            if (phone)
                await (0, whatsapp_service_js_1.sendText)(phone, message);
        }
        // email: logado — sendCampaignEmail é por campanha, não por lead individual
        logger_js_1.logger.info({ cadenceId, step: cadence.currentStep, channel: step.channel }, 'Step enviado');
    }
    catch (err) {
        logger_js_1.logger.error({ err, cadenceId }, 'Erro ao enviar step de cadência');
        throw err;
    }
    await database_js_1.prisma.interaction.create({
        data: {
            leadId: lead.id,
            type: step.channel === 'whatsapp' ? 'WHATSAPP' : 'EMAIL',
            channel: step.channel,
            content: message,
            direction: 'OUT',
        },
    });
    const isLastStep = cadence.currentStep >= steps.length - 1;
    if (isLastStep) {
        await database_js_1.prisma.leadCadence.update({
            where: { id: cadenceId },
            data: { status: 'completed', completedAt: new Date(), nextActionAt: null },
        });
        logger_js_1.logger.info({ cadenceId }, 'Cadência concluída');
    }
    else {
        const nextStep = steps[cadence.currentStep + 1];
        await database_js_1.prisma.leadCadence.update({
            where: { id: cadenceId },
            data: {
                currentStep: cadence.currentStep + 1,
                nextActionAt: daysFromNow(nextStep.day),
            },
        });
    }
}
async function pauseActiveCadencesForLead(leadId, reason) {
    const active = await database_js_1.prisma.leadCadence.findMany({
        where: { leadId, status: 'active' },
        select: { id: true },
    });
    if (!active.length)
        return 0;
    await database_js_1.prisma.leadCadence.updateMany({
        where: { leadId, status: 'active' },
        data: { status: 'paused', pausedAt: new Date(), pauseReason: reason },
    });
    (0, websocket_service_js_1.broadcast)({
        type: 'cadence:paused',
        data: { leadId, reason, count: active.length, timestamp: new Date().toISOString() },
    });
    logger_js_1.logger.info({ leadId, reason, count: active.length }, 'Cadências pausadas por resposta do lead');
    return active.length;
}
//# sourceMappingURL=cadence.service.js.map