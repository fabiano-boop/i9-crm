"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreLead = scoreLead;
exports.bulkScoreLeads = bulkScoreLeads;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const database_js_1 = require("../config/database.js");
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../utils/logger.js");
const SYSTEM_PROMPT = `Você é o motor de scoring da i9 Soluções Digitais, especializada
em marketing digital para PMEs da Zona Leste de SP. Analise o lead
e retorne APENAS um JSON válido com os campos solicitados.
Score 0-100. HOT=80+, WARM=60-79, COLD<60.
O ângulo WhatsApp deve ser uma frase de abertura personalizada,
específica para o negócio e bairro, que NÃO pareça genérica.
Nunca use linguagem de marketing vazia. Foque na dor real do negócio.`;
function getClient() {
    if (!env_js_1.env.ANTHROPIC_API_KEY)
        throw new Error('ANTHROPIC_API_KEY não configurado');
    return new sdk_1.default({ apiKey: env_js_1.env.ANTHROPIC_API_KEY });
}
function buildUserPrompt(lead) {
    return `Analise este lead e retorne um JSON com: score, classification, painPoints, idealService, whatsappAngle, reasoning.

DADOS DO LEAD:
- Negócio: ${lead.businessName}
- Nicho: ${lead.niche}
- Bairro: ${lead.neighborhood}
- Nível digital: ${lead.digitalLevel}
- Avaliação Google: ${lead.googleRating ?? 'N/A'} (${lead.reviewCount ?? 0} reviews)
- Urgência declarada: ${lead.urgency}/10
- Potencial de receita: ${lead.revenuePotential ?? 'N/A'}
- Facilidade de fechamento: ${lead.closingEase ?? 'N/A'}
- Dores (planilha): ${lead.painPoints ?? 'N/A'}
- Serviço ideal (planilha): ${lead.idealService ?? 'N/A'}
- Website: ${lead.website ? 'Sim' : 'Não'}
- Instagram: ${lead.instagram ? 'Sim' : 'Não'}

CONTEXTO i9:
Vendemos: gestão de redes sociais, Google Meu Negócio, tráfego pago (Meta/Google Ads),
sites, email marketing, WhatsApp Business, SEO local.
ICP: PMEs da Zona Leste com ticket médio R$500-2000/mês.

Retorne APENAS o JSON, sem markdown, sem explicações fora do JSON:
{
  "score": <0-100>,
  "classification": "<HOT|WARM|COLD>",
  "painPoints": "<dores identificadas, 1-2 frases>",
  "idealService": "<serviço mais adequado>",
  "whatsappAngle": "<frase de abertura personalizada, máx 2 frases>",
  "reasoning": "<raciocínio resumido, máx 3 frases>"
}`;
}
async function scoreLead(leadId) {
    const lead = await database_js_1.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead)
        throw new Error(`Lead ${leadId} não encontrado`);
    const client = getClient();
    const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(lead) }],
    });
    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
    // Parse robusto — extrai JSON mesmo se vier com texto extra
    let result;
    try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            throw new Error('Nenhum JSON encontrado na resposta');
        result = JSON.parse(jsonMatch[0]);
    }
    catch (err) {
        logger_js_1.logger.error({ leadId, rawText, err }, 'Falha ao parsear resposta do Claude');
        throw new Error('Resposta do Claude inválida');
    }
    // Validações de segurança
    result.score = Math.max(0, Math.min(100, Number(result.score) || 0));
    if (!['HOT', 'WARM', 'COLD'].includes(result.classification)) {
        result.classification = result.score >= 80 ? 'HOT' : result.score >= 60 ? 'WARM' : 'COLD';
    }
    // Persiste no banco
    await database_js_1.prisma.lead.update({
        where: { id: leadId },
        data: {
            score: result.score,
            classification: result.classification,
            painPoints: result.painPoints || lead.painPoints,
            idealService: result.idealService || lead.idealService,
            whatsappAngle: result.whatsappAngle,
        },
    });
    // Log do reasoning para auditoria
    logger_js_1.logger.info({ leadId, businessName: lead.businessName, score: result.score, classification: result.classification, reasoning: result.reasoning }, 'Lead rescorado');
    return result;
}
async function bulkScoreLeads(leadIds) {
    // Máximo 20 por chamada para não estourar rate limit
    const ids = leadIds.slice(0, 20);
    const results = [];
    for (const id of ids) {
        try {
            const result = await scoreLead(id);
            results.push({ id, result });
            // Delay entre chamadas para respeitar rate limit (60 req/min)
            await new Promise((r) => setTimeout(r, 1100));
        }
        catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            results.push({ id, error });
            logger_js_1.logger.warn({ id, error }, 'Erro ao rescorar lead');
        }
    }
    return results;
}
//# sourceMappingURL=scoring.service.js.map