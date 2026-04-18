"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAgentEnabled = setAgentEnabled;
exports.getAgentEnabled = getAgentEnabled;
exports.getAgentStats = getAgentStats;
exports.getAgentSessions = getAgentSessions;
exports.getHandoffQueue = getHandoffQueue;
exports.isAgentManaged = isAgentManaged;
exports.takeoverFromAgent = takeoverFromAgent;
exports.processMessage = processMessage;
exports.handleLeadReply = handleLeadReply;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const axios_1 = __importDefault(require("axios"));
const database_js_1 = require("../config/database.js");
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../utils/logger.js");
const cadence_service_js_1 = require("./cadence.service.js");
const escalation_service_js_1 = require("./escalation.service.js");
const objections_js_1 = require("../utils/objections.js");
// ─── Runtime toggle (sobrescreve env sem reiniciar o servidor) ────────────────
let _agentEnabled = env_js_1.env.WHATSAPP_AGENT_ENABLED;
function setAgentEnabled(enabled) {
    _agentEnabled = enabled;
    logger_js_1.logger.info({ enabled }, `Agente Maya ${enabled ? 'ativado' : 'desativado'} em tempo de execução`);
}
function getAgentEnabled() { return _agentEnabled; }
const agentStats = {
    totalProcessed: 0,
    totalHandoffs: 0,
    totalSent: 0,
    intentCounts: {},
    stageCounts: {},
    startedAt: new Date().toISOString(),
};
function getAgentStats() {
    return { ...agentStats, intentCounts: { ...agentStats.intentCounts }, stageCounts: { ...agentStats.stageCounts } };
}
// ─── In-memory session state ───────────────────────────────────────────────────
const agentSessions = new Map();
const handoffQueue = new Map();
function getAgentSessions() { return agentSessions; }
function getHandoffQueue() { return handoffQueue; }
function isAgentManaged(leadId) { return agentSessions.has(leadId); }
function takeoverFromAgent(leadId) {
    agentSessions.delete(leadId);
    handoffQueue.delete(leadId);
    logger_js_1.logger.info({ leadId }, 'Agente: humano assumiu conversa');
}
// ─── Packages ─────────────────────────────────────────────────────────────────
const PACKAGES = {
    starter: { name: 'Starter', price: 'R$997/mês', tagline: 'Presença digital + Google Meu Negócio' },
    growth: { name: 'Growth', price: 'R$1.997/mês', tagline: 'Tráfego pago + redes sociais gerenciadas' },
    dominacao: { name: 'Dominação', price: 'R$3.497/mês', tagline: 'Estratégia completa + conteúdo profissional' },
};
function suggestPackage(lead) {
    if (lead.score >= 85)
        return 'dominacao';
    if (lead.score >= 60)
        return 'growth';
    return 'starter';
}
// ─── Maya System Prompt ───────────────────────────────────────────────────────
const MAYA_SYSTEM = `Você é Maya, consultora de marketing digital da i9 Soluções Digitais, especializada em PMEs da Zona Leste de São Paulo.

PERSONALIDADE:
- Fale como uma consultora experiente e humana — nunca como robô ou atendente de callcenter
- Tom direto, caloroso e consultivo — como quem conhece o negócio do cliente de perto
- Conhece profundamente a Zona Leste: Tatuapé, Mooca, Penha, Itaquera, Belém, Sapopemba, Vila Prudente, Aricanduva
- Se perguntarem diretamente se você é IA: seja honesta mas redirecione ("Sou assistente da i9 — mas posso te ajudar agora mesmo, sem enrolação")
- NUNCA revele espontaneamente que é IA

REGRAS ABSOLUTAS PARA WHATSAPP:
- Máximo 3 linhas por mensagem — sem exceção
- Sem bullet points, asteriscos ou qualquer markdown
- Linguagem natural e coloquial, mas profissional
- Emojis com moderação (máx 1 por mensagem, só se natural)
- Nunca pareça estar lendo um script

PACOTES DA I9 (apresente APENAS quando o lead perguntar preço OU demonstrar interesse claro):
- Starter R$997/mês → Presença digital, Google Meu Negócio otimizado, site básico
- Growth R$1.997/mês → Tráfego pago (Meta + Google Ads), redes sociais, relatórios mensais
- Dominação R$3.497/mês → Tudo do Growth + estratégia completa, conteúdo profissional, CRM

AO APRESENTAR PREÇO: contextualize com resultado esperado — nunca preço isolado.

SINALIZAR stage=human_needed QUANDO:
- Lead pediu proposta formal ou contrato
- Lead quer falar com responsável/dono da i9
- Lead está pronto para fechar
- Negociação de preço ou pedido de desconto
- Lead demonstrou raiva ou frustração clara
- Lead pediu para não ser contatado mais`;
// ─── Claude client ────────────────────────────────────────────────────────────
function getClient() {
    if (!env_js_1.env.ANTHROPIC_API_KEY)
        throw new Error('ANTHROPIC_API_KEY não configurado');
    return new sdk_1.default({ apiKey: env_js_1.env.ANTHROPIC_API_KEY });
}
function buildHistory(interactions) {
    return interactions
        .filter((i) => i.content?.trim())
        .slice(-12)
        .map((i) => ({
        role: (i.direction === 'IN' ? 'user' : 'assistant'),
        content: i.content ?? '',
    }));
}
// ─── Send via Evolution API (inline — evita import circular) ──────────────────
async function sendWhatsAppReply(phone, message) {
    const number = phone.replace(/\D/g, '');
    if (!number)
        return false;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await axios_1.default.post(`${env_js_1.env.EVOLUTION_API_URL}/message/sendText/${env_js_1.env.EVOLUTION_INSTANCE_NAME}`, { number: `55${number}`, text: message }, { headers: { apikey: env_js_1.env.EVOLUTION_API_KEY }, timeout: 15_000 });
            return true;
        }
        catch (err) {
            logger_js_1.logger.warn({ phone, attempt, err: err instanceof Error ? err.message : err }, 'Agente: falha ao enviar');
            if (attempt < 3)
                await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
    }
    return false;
}
// ─── Core: processMessage ─────────────────────────────────────────────────────
async function processMessage(leadId, incomingMessage) {
    if (!_agentEnabled) {
        throw new Error('Agente Maya está desativado');
    }
    // 1. Carregar lead + histórico
    const lead = await database_js_1.prisma.lead.findUnique({
        where: { id: leadId },
        include: { interactions: { orderBy: { createdAt: 'asc' }, take: 20 } },
    });
    if (!lead)
        throw new Error(`Lead ${leadId} não encontrado`);
    // 2. Sessão e contexto
    const currentStage = agentSessions.get(leadId) ?? 'first_contact';
    agentSessions.set(leadId, currentStage);
    const pkgKey = suggestPackage(lead);
    const pkg = PACKAGES[pkgKey];
    const history = buildHistory(lead.interactions);
    // 3. Detectar objeção e verificar escalação imediata
    const objectionContext = (0, objections_js_1.getObjectionContext)(incomingMessage);
    const forceEscalation = (0, objections_js_1.requiresImmediateEscalation)(incomingMessage);
    const contextPrompt = `CONTEXTO DO LEAD:
- Nome: ${lead.name}
- Negócio: ${lead.businessName} (${lead.niche})
- Bairro: ${lead.neighborhood}
- Dores: ${lead.painPoints ?? 'não mapeadas'}
- Score: ${lead.score}/100 | Classificação: ${lead.classification}
- Pacote sugerido: ${pkg.name} (${pkg.price}) — ${pkg.tagline}
- Status: ${lead.status} | Estágio atual: ${currentStage}
${forceEscalation ? '\n⚠️ IMPORTANTE: objeção crítica detectada — considere fortemente stage=human_needed' : ''}
${objectionContext}

MENSAGEM RECEBIDA: "${incomingMessage}"

Analise tudo e retorne APENAS um JSON válido:
{
  "intent": "<interested|not_interested|has_objection|wants_price|wants_meeting|already_has|unclear>",
  "stage": "<first_contact|qualifying|presenting|handling_objection|scheduling|human_needed>",
  "message": "<resposta como Maya, máx 3 linhas, tom WhatsApp natural>",
  "shouldHandoff": <true|false>,
  "handoffReason": "<motivo detalhado se shouldHandoff=true, senão null>",
  "suggestedPackage": "<starter|growth|dominacao|null>",
  "newLeadInfo": "<info nova sobre o negócio ou null>",
  "urgencyLevel": "<low|medium|high>"
}`;
    // 4. Chamar Claude
    const client = getClient();
    const claudeResponse = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: MAYA_SYSTEM,
        messages: [...history, { role: 'user', content: contextPrompt }],
    });
    const raw = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        throw new Error('Resposta inválida do Claude — JSON não encontrado');
    const parsed = JSON.parse(jsonMatch[0]);
    // Forçar handoff se a biblioteca de objeções indicar
    if (forceEscalation && !parsed.shouldHandoff) {
        parsed.shouldHandoff = true;
        parsed.stage = 'human_needed';
        parsed.handoffReason = parsed.handoffReason ?? 'Objeção crítica detectada pela biblioteca de contornos';
    }
    // 5. Atualizar sessão
    agentSessions.set(leadId, parsed.stage);
    // 6. Persistir interação de saída + atualizar lead
    const noteAppend = parsed.newLeadInfo
        ? `\n[Maya ${new Date().toLocaleDateString('pt-BR')}]: ${parsed.newLeadInfo}`
        : '';
    await database_js_1.prisma.$transaction([
        database_js_1.prisma.interaction.create({
            data: { leadId, type: 'WHATSAPP', channel: 'whatsapp_agent', content: parsed.message, direction: 'OUT' },
        }),
        database_js_1.prisma.lead.update({
            where: { id: leadId },
            data: { lastContactAt: new Date(), ...(noteAppend ? { notes: (lead.notes ?? '') + noteAppend } : {}) },
        }),
    ]);
    // 7. Enviar mensagem
    const phone = lead.whatsapp ?? lead.phone ?? '';
    const sent = phone ? await sendWhatsAppReply(phone, parsed.message) : false;
    if (!sent && phone)
        logger_js_1.logger.warn({ leadId, phone }, 'Agente: mensagem não enviada');
    // 8. Handoff
    if (parsed.shouldHandoff) {
        handoffQueue.set(leadId, {
            reason: parsed.handoffReason ?? 'Agente sinalizou necessidade de atendimento humano',
            timestamp: new Date(),
            suggestedPackage: parsed.suggestedPackage ?? pkgKey,
            leadName: lead.name,
            businessName: lead.businessName,
            phone: lead.whatsapp ?? lead.phone,
        });
        agentSessions.delete(leadId); // agente libera o lead
        // Escalação completa: WebSocket + email
        await (0, escalation_service_js_1.triggerEscalation)({
            leadId,
            leadName: lead.name,
            businessName: lead.businessName,
            neighborhood: lead.neighborhood,
            phone: lead.whatsapp ?? lead.phone,
            reason: parsed.handoffReason ?? 'Não especificado',
            lastMessage: incomingMessage,
            agentLastReply: parsed.message,
            suggestedPackage: parsed.suggestedPackage ?? pkgKey,
            urgencyLevel: parsed.urgencyLevel ?? 'medium',
        }).catch((err) => logger_js_1.logger.warn({ err }, 'Agente: erro na escalação — continuando'));
        agentStats.totalHandoffs++;
    }
    // 9. Atualizar estatísticas
    agentStats.totalProcessed++;
    if (sent)
        agentStats.totalSent++;
    agentStats.intentCounts[parsed.intent] = (agentStats.intentCounts[parsed.intent] ?? 0) + 1;
    agentStats.stageCounts[parsed.stage] = (agentStats.stageCounts[parsed.stage] ?? 0) + 1;
    logger_js_1.logger.info({ leadId, intent: parsed.intent, stage: parsed.stage, shouldHandoff: parsed.shouldHandoff }, 'Agente: mensagem processada');
    return {
        message: parsed.message,
        stage: parsed.stage,
        intent: parsed.intent,
        shouldHandoff: parsed.shouldHandoff,
        handoffReason: parsed.handoffReason ?? undefined,
        suggestedPackage: parsed.suggestedPackage ?? undefined,
    };
}
// ─── Pausar cadências ao receber resposta ─────────────────────────────────────
async function handleLeadReply(leadId) {
    try {
        const paused = await (0, cadence_service_js_1.pauseActiveCadencesForLead)(leadId, 'lead_replied_agent');
        if (paused > 0)
            logger_js_1.logger.info({ leadId, paused }, 'Agente: cadências pausadas');
    }
    catch (err) {
        logger_js_1.logger.warn({ err, leadId }, 'Agente: erro ao pausar cadências');
    }
}
//# sourceMappingURL=whatsappAgent.service.js.map