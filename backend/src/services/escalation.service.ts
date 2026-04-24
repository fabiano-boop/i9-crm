import { Resend } from 'resend'
import { prisma } from '../config/database.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { broadcast } from './websocket.service.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EscalationPayload {
  leadId: string
  leadName: string
  businessName: string
  neighborhood: string
  phone?: string | null
  reason: string
  lastMessage: string
  agentLastReply: string
  suggestedPackage?: string
  urgencyLevel?: 'low' | 'medium' | 'high'
}

export type EscalationTrigger =
  | 'wants_proposal'    // pediu proposta formal
  | 'wants_owner'       // quer falar com responsável
  | 'ready_to_close'    // pronto para fechar
  | 'price_negotiation' // quer desconto / negociar preço
  | 'frustrated'        // frustrado / irritado
  | 'repeated_failure'  // 3+ tentativas sem agendar
  | 'agent_decision'    // decisão geral do agente

// ─── Urgency map ──────────────────────────────────────────────────────────────

const URGENCY_LABELS: Record<string, string> = {
  high:   '🔴 URGENTE',
  medium: '🟡 Médio',
  low:    '🟢 Rotina',
}

const URGENCY_COLORS: Record<string, string> = {
  high:   '#ef4444',
  medium: '#eab308',
  low:    '#10b981',
}

const PACKAGE_LABELS: Record<string, string> = {
  start:   'Start — R$750/mês (promo) / R$997/mês normal',
  growth:  'Growth — R$1.097/mês (promo) / R$1.497/mês normal',
  premium: 'Premium — R$1.797/mês (promo) / R$2.497/mês normal',
}

// ─── Core trigger ─────────────────────────────────────────────────────────────

export async function triggerEscalation(payload: EscalationPayload): Promise<void> {
  const urgency = payload.urgencyLevel ?? 'medium'

  logger.info(
    { leadId: payload.leadId, reason: payload.reason, urgency },
    'Escalação: lead encaminhado para humano',
  )

  // Emite evento WebSocket (já feito no agent service, mas reforçamos aqui)
  broadcast({
    type: 'agent:handoff_needed',
    data: {
      ...payload,
      urgency,
      timestamp: new Date().toISOString(),
    },
  })

  // Envia email de alerta para todos os usuários do sistema
  if (env.RESEND_API_KEY) {
    await sendEscalationEmail(payload, urgency).catch((err) =>
      logger.warn({ err }, 'Escalação: falha ao enviar email — continuando'),
    )
  } else {
    logger.warn('Escalação: RESEND_API_KEY não configurado — email de alerta não enviado')
  }
}

// ─── Email alert ──────────────────────────────────────────────────────────────

async function sendEscalationEmail(
  payload: EscalationPayload,
  urgency: string,
): Promise<void> {
  const resend = new Resend(env.RESEND_API_KEY)

  // Busca todos os usuários do sistema para notificar
  const users = await prisma.user.findMany({
    select: { email: true, name: true },
  })

  if (users.length === 0) return

  const recipients = users.map((u) => u.email)
  const urgencyLabel = URGENCY_LABELS[urgency] ?? URGENCY_LABELS.medium
  const urgencyColor = URGENCY_COLORS[urgency] ?? URGENCY_COLORS.medium
  const packageLabel = payload.suggestedPackage
    ? PACKAGE_LABELS[payload.suggestedPackage] ?? payload.suggestedPackage
    : null

  const html = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:600px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">

      <!-- Header -->
      <div style="background:${urgencyColor};padding:20px 24px;">
        <p style="margin:0;color:rgba(255,255,255,.85);font-size:12px;text-transform:uppercase;letter-spacing:.8px;">${urgencyLabel}</p>
        <h1 style="margin:6px 0 0;color:white;font-size:20px;font-weight:700;">
          🤖 Maya → Handoff para Humano
        </h1>
      </div>

      <!-- Lead info -->
      <div style="padding:24px;border-bottom:1px solid #f0f0f0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px;">Lead</td>
            <td style="padding:6px 0;font-size:13px;font-weight:600;color:#111827;">${payload.leadName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Negócio</td>
            <td style="padding:6px 0;font-size:13px;color:#374151;">${payload.businessName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Bairro</td>
            <td style="padding:6px 0;font-size:13px;color:#374151;">${payload.neighborhood}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">WhatsApp</td>
            <td style="padding:6px 0;font-size:13px;color:#374151;">${payload.phone ?? 'não informado'}</td>
          </tr>
          ${packageLabel ? `
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Pacote sugerido</td>
            <td style="padding:6px 0;font-size:13px;font-weight:600;color:#3b82f6;">${packageLabel}</td>
          </tr>` : ''}
        </table>
      </div>

      <!-- Reason -->
      <div style="padding:20px 24px;border-bottom:1px solid #f0f0f0;">
        <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.6px;">Motivo da escalação</p>
        <p style="margin:0;font-size:14px;color:#374151;background:#fef9c3;padding:12px;border-radius:6px;border-left:3px solid #eab308;">
          ${payload.reason}
        </p>
      </div>

      <!-- Conversation -->
      <div style="padding:20px 24px;border-bottom:1px solid #f0f0f0;">
        <p style="margin:0 0 12px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.6px;">Último trecho da conversa</p>

        <div style="margin-bottom:10px;">
          <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;">Lead disse:</p>
          <div style="background:#f3f4f6;padding:12px;border-radius:8px;font-size:14px;color:#374151;">
            "${payload.lastMessage}"
          </div>
        </div>

        <div>
          <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;">Maya respondeu:</p>
          <div style="background:#eff6ff;padding:12px;border-radius:8px;font-size:14px;color:#1d4ed8;">
            "${payload.agentLastReply}"
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div style="padding:24px;text-align:center;">
        <a href="${env.FRONTEND_URL}/agent"
           style="display:inline-block;background:#3b82f6;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
          Abrir Painel do Agente →
        </a>
        <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
          Clique em "Assumir conversa" para tomar o controle do atendimento
        </p>
      </div>

    </div>
  </body>
  </html>`

  await resend.emails.send({
    from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
    to: recipients,
    subject: `${URGENCY_LABELS[urgency]} | Maya → ${payload.leadName} (${payload.businessName}) precisa de atendimento`,
    html,
  })

  logger.info(
    { leadId: payload.leadId, recipients: recipients.length },
    'Escalação: email enviado com sucesso',
  )
}
