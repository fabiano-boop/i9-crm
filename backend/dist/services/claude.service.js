"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePitch = generatePitch;
exports.generateCampaignTemplate = generateCampaignTemplate;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const env_js_1 = require("../config/env.js");
const BASE_SYSTEM = `Você é o especialista de growth da i9 Soluções Digitais, empresa de marketing
digital para PMEs da Zona Leste de SP. Tom: direto, consultivo, sem promessas
vazias. Foco em dor real do negócio + solução concreta. Nunca use linguagem
genérica de marketing. Sempre mencione algo específico do negócio ou bairro.`;
function getClient() {
    if (!env_js_1.env.ANTHROPIC_API_KEY)
        throw new Error('ANTHROPIC_API_KEY não configurado');
    return new sdk_1.default({ apiKey: env_js_1.env.ANTHROPIC_API_KEY });
}
async function generatePitch(lead) {
    const client = getClient();
    const prompt = `Gere materiais de vendas para este lead. Retorne APENAS JSON válido.

LEAD:
- Negócio: ${lead.businessName} (${lead.niche})
- Bairro: ${lead.neighborhood}
- Score: ${lead.score} | Classificação: ${lead.classification}
- Dores: ${lead.painPoints ?? 'não informado'}
- Serviço ideal: ${lead.idealService ?? 'não informado'}
- Ângulo WA atual: ${lead.whatsappAngle ?? 'nenhum'}
- Google Rating: ${lead.googleRating ?? 'N/A'} (${lead.reviewCount ?? 0} reviews)

Retorne:
{
  "whatsappMessage": "<mensagem WhatsApp completa, máx 300 chars, informal mas profissional>",
  "emailSubject": "<assunto do email, até 60 chars>",
  "emailBody": "<corpo do email em texto, 3-4 parágrafos>",
  "callScript": "<roteiro de ligação em tópicos, máx 200 chars>"
}`;
    const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: BASE_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
    });
    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        throw new Error('Resposta inválida do Claude');
    return JSON.parse(jsonMatch[0]);
}
async function generateCampaignTemplate(context) {
    const client = getClient();
    const prompt = `Crie um template de campanha. Retorne APENAS JSON válido.

CONTEXTO:
- Campanha: ${context.campaignName}
- Canal: ${context.channel}
- Nicho alvo: ${context.targetNiche}
- Bairros: ${context.targetNeighborhoods.join(', ')}
- Serviço: ${context.mainService}
- Gancho: ${context.hook}

Use variáveis: {{nome}}, {{negocio}}, {{bairro}}

Retorne:
{
  "template": "<mensagem com variáveis, tom consultivo>",
  "subjectLine": "<assunto para email, até 60 chars>"
}`;
    const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: BASE_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
    });
    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        throw new Error('Resposta inválida do Claude');
    return JSON.parse(jsonMatch[0]);
}
//# sourceMappingURL=claude.service.js.map