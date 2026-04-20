import Anthropic from '@anthropic-ai/sdk'
import axios from 'axios'
import { prisma } from '../config/database.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { pauseActiveCadencesForLead } from './cadence.service.js'
import { triggerEscalation } from './escalation.service.js'
import { getObjectionContext, requiresImmediateEscalation } from '../utils/objections.js'
import type { Lead, Interaction } from '@prisma/client'

// ─── Runtime toggle (sobrescreve env sem reiniciar o servidor) ────────────────

let _agentEnabled: boolean = env.WHATSAPP_AGENT_ENABLED

export function setAgentEnabled(enabled: boolean): void {
  _agentEnabled = enabled
  logger.info({ enabled }, `Agente Maya ${enabled ? 'ativado' : 'desativado'} em tempo de execução`)
}
export function getAgentEnabled(): boolean { return _agentEnabled }

// ─── Analytics counters (in-memory — Redis em produção) ───────────────────────

interface AgentStats {
  totalProcessed: number
  totalHandoffs: number
  totalSent: number
  intentCounts: Record<string, number>
  stageCounts: Record<string, number>
  startedAt: string
}

const agentStats: AgentStats = {
  totalProcessed: 0,
  totalHandoffs: 0,
  totalSent: 0,
  intentCounts: {},
  stageCounts: {},
  startedAt: new Date().toISOString(),
}

export function getAgentStats(): AgentStats {
  return { ...agentStats, intentCounts: { ...agentStats.intentCounts }, stageCounts: { ...agentStats.stageCounts } }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConversationStage =
  | 'first_contact'
  | 'qualifying'
  | 'presenting'
  | 'handling_objection'
  | 'scheduling'
  | 'human_needed'

export type Intent =
  | 'interested'
  | 'not_interested'
  | 'has_objection'
  | 'wants_price'
  | 'wants_meeting'
  | 'already_has'
  | 'unclear'

export interface AgentResponse {
  message: string
  stage: ConversationStage
  intent: Intent
  shouldHandoff: boolean
  handoffReason?: string
  suggestedPackage?: string
}

// ─── In-memory session state ───────────────────────────────────────────────────

const agentSessions = new Map<string, ConversationStage>()
const handoffQueue  = new Map<string, {
  reason: string
  timestamp: Date
  suggestedPackage?: string
  leadName: string
  businessName: string
  phone?: string | null
}>()

export function getAgentSessions(): Map<string, ConversationStage> { return agentSessions }
export function getHandoffQueue() { return handoffQueue }
export function isAgentManaged(leadId: string): boolean { return agentSessions.has(leadId) }

export function takeoverFromAgent(leadId: string): void {
  agentSessions.delete(leadId)
  handoffQueue.delete(leadId)
  logger.info({ leadId }, 'Agente: humano assumiu conversa')
}

// ─── Packages ─────────────────────────────────────────────────────────────────

const PACKAGES = {
  starter:   { name: 'Starter',    price: 'R$997/mês',   tagline: 'Presença digital + Google Meu Negócio' },
  growth:    { name: 'Growth',     price: 'R$1.997/mês', tagline: 'Tráfego pago + redes sociais gerenciadas' },
  dominacao: { name: 'Dominação',  price: 'R$3.497/mês', tagline: 'Estratégia completa + conteúdo profissional' },
} as const

function suggestPackage(lead: Lead): keyof typeof PACKAGES {
  if (lead.score >= 85) return 'dominacao'
  if (lead.score >= 60) return 'growth'
  return 'starter'
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
- Lead pediu para não ser contatado mais`

// ─── Claude client ────────────────────────────────────────────────────────────

function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurado')
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
}

function buildHistory(interactions: Interaction[]): Anthropic.Messages.MessageParam[] {
  return interactions
    .filter((i) => i.content?.trim())
    .slice(-12)
    .map((i) => ({
      role: (i.direction === 'IN' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: i.content ?? '',
    }))
}

// ─── Send via Evolution API (inline — evita import circular) ──────────────────

async function sendWhatsAppReply(phone: string, message: string): Promise<boolean> {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return false
  // Evita duplicar o DDI 55 se o número já vier com ele
  const to = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await axios.post(
        `${env.WHAPI_URL}/messages/text`,
        { to, body: message },
        { headers: { Authorization: `Bearer ${env.WHAPI_TOKEN}` }, timeout: 15_000 },
      )
      return true
    } catch (err) {
      logger.warn({ phone: to, attempt, err: err instanceof Error ? err.message : err }, 'Agente: falha ao enviar')
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
  return false
}

// ─── Core: processMessage ─────────────────────────────────────────────────────

export async function processMessage(
  leadId: string,
  incomingMessage: string,
): Promise<AgentResponse> {
  if (!_agentEnabled) {
    throw new Error('Agente Maya está desativado')
  }

  // 1. Carregar lead + histórico
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { interactions: { orderBy: { createdAt: 'asc' }, take: 20 } },
  })
  if (!lead) throw new Error(`Lead ${leadId} não encontrado`)

  // 2. Sessão e contexto
  const currentStage = agentSessions.get(leadId) ?? 'first_contact'
  agentSessions.set(leadId, currentStage)

  const pkgKey = suggestPackage(lead)
  const pkg = PACKAGES[pkgKey]
  const history = buildHistory(lead.interactions)

  // 3. Detectar objeção e verificar escalação imediata
  const objectionContext = getObjectionContext(incomingMessage)
  const forceEscalation  = requiresImmediateEscalation(incomingMessage)

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
}`

  // 4. Chamar Claude
  const client = getClient()
  const claudeResponse = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: MAYA_SYSTEM,
    messages: [...history, { role: 'user', content: contextPrompt }],
  })

  const raw = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '{}'
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Resposta inválida do Claude — JSON não encontrado')

  const parsed = JSON.parse(jsonMatch[0]) as {
    intent: Intent
    stage: ConversationStage
    message: string
    shouldHandoff: boolean
    handoffReason?: string | null
    suggestedPackage?: string | null
    newLeadInfo?: string | null
    urgencyLevel?: string | null
  }

  // Forçar handoff se a biblioteca de objeções indicar
  if (forceEscalation && !parsed.shouldHandoff) {
    parsed.shouldHandoff = true
    parsed.stage = 'human_needed'
    parsed.handoffReason = parsed.handoffReason ?? 'Objeção crítica detectada pela biblioteca de contornos'
  }

  // 5. Atualizar sessão
  agentSessions.set(leadId, parsed.stage)

  // 6. Persistir interação de saída + atualizar lead
  const noteAppend = parsed.newLeadInfo
    ? `\n[Maya ${new Date().toLocaleDateString('pt-BR')}]: ${parsed.newLeadInfo}`
    : ''

  await prisma.$transaction([
    prisma.interaction.create({
      data: { leadId, type: 'WHATSAPP', channel: 'whatsapp_agent', content: parsed.message, direction: 'OUT' },
    }),
    prisma.lead.update({
      where: { id: leadId },
      data: { lastContactAt: new Date(), ...(noteAppend ? { notes: (lead.notes ?? '') + noteAppend } : {}) },
    }),
  ])

  // 7. Enviar mensagem
  const phone = lead.whatsapp ?? lead.phone ?? ''
  const sent = phone ? await sendWhatsAppReply(phone, parsed.message) : false
  if (!sent && phone) logger.warn({ leadId, phone }, 'Agente: mensagem não enviada')

  // 8. Handoff
  if (parsed.shouldHandoff) {
    handoffQueue.set(leadId, {
      reason: parsed.handoffReason ?? 'Agente sinalizou necessidade de atendimento humano',
      timestamp: new Date(),
      suggestedPackage: parsed.suggestedPackage ?? pkgKey,
      leadName: lead.name,
      businessName: lead.businessName,
      phone: lead.whatsapp ?? lead.phone,
    })
    agentSessions.delete(leadId) // agente libera o lead

    // Escalação completa: WebSocket + email
    await triggerEscalation({
      leadId,
      leadName: lead.name,
      businessName: lead.businessName,
      neighborhood: lead.neighborhood,
      phone: lead.whatsapp ?? lead.phone,
      reason: parsed.handoffReason ?? 'Não especificado',
      lastMessage: incomingMessage,
      agentLastReply: parsed.message,
      suggestedPackage: parsed.suggestedPackage ?? pkgKey,
      urgencyLevel: (parsed.urgencyLevel as 'low' | 'medium' | 'high') ?? 'medium',
    }).catch((err) => logger.warn({ err }, 'Agente: erro na escalação — continuando'))

    agentStats.totalHandoffs++
  }

  // 9. Atualizar estatísticas
  agentStats.totalProcessed++
  if (sent) agentStats.totalSent++
  agentStats.intentCounts[parsed.intent] = (agentStats.intentCounts[parsed.intent] ?? 0) + 1
  agentStats.stageCounts[parsed.stage]   = (agentStats.stageCounts[parsed.stage]   ?? 0) + 1

  logger.info(
    { leadId, intent: parsed.intent, stage: parsed.stage, shouldHandoff: parsed.shouldHandoff },
    'Agente: mensagem processada',
  )

  return {
    message: parsed.message,
    stage: parsed.stage,
    intent: parsed.intent,
    shouldHandoff: parsed.shouldHandoff,
    handoffReason: parsed.handoffReason ?? undefined,
    suggestedPackage: parsed.suggestedPackage ?? undefined,
  }
}

// ─── Pausar cadências ao receber resposta ─────────────────────────────────────

export async function handleLeadReply(leadId: string): Promise<void> {
  try {
    const paused = await pauseActiveCadencesForLead(leadId, 'lead_replied_agent')
    if (paused > 0) logger.info({ leadId, paused }, 'Agente: cadências pausadas')
  } catch (err) {
    logger.warn({ err, leadId }, 'Agente: erro ao pausar cadências')
  }
}
