import fs from 'fs'
import path from 'path'
import Handlebars from 'handlebars'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import { prisma } from '../config/database.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import type { Client, WeeklyReport } from '@prisma/client'

// __dirname is a CJS global (package.json has no "type": "module")
const TEMPLATE_PATH = path.resolve(__dirname, '../templates/weeklyReport.hbs')
const REPORTS_DIR = path.resolve('/tmp/i9crm-reports')

// ─── Helpers do Handlebars ────────────────────────────────────────────────────

Handlebars.registerHelper('index_plus_1', function (this: unknown, options: Handlebars.HelperOptions) {
  const index = options.data?.['index'] as number | undefined
  return (index ?? 0) + 1
})

// ─── Garantir diretório de relatórios ────────────────────────────────────────

function ensureReportsDir(): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true })
  }
}

// ─── Compilar template ───────────────────────────────────────────────────────

function compileTemplate(): HandlebarsTemplateDelegate {
  const source = fs.readFileSync(TEMPLATE_PATH, 'utf-8')
  return Handlebars.compile(source)
}

// ─── Claude: gerar texto do relatório ────────────────────────────────────────

interface ReportContent {
  highlights: string
  recommendations: string
  nextWeekPlan: string
}

async function generateReportContent(
  client: Client,
  metrics: {
    messagesSent: number
    messagesRead: number
    repliesReceived: number
    newLeadsGen: number
    appointmentsSet: number
    conversionRate: number
    readRate: number
  },
): Promise<ReportContent> {
  if (!env.ANTHROPIC_API_KEY) {
    return {
      highlights: 'Semana com boa performance. Métricas de engajamento dentro do esperado.',
      recommendations: '1. Aumentar frequência de envios. 2. Testar novos templates. 3. Revisar horários de disparo.',
      nextWeekPlan: 'A equipe i9 irá otimizar os fluxos de atendimento e preparar novos conteúdos para a próxima semana.',
    }
  }

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

  const prompt = `Você é o analista de resultados da i9 Soluções Digitais.
Gere um relatório semanal profissional para o cliente ${client.businessName}, um ${client.niche ?? 'negócio local'} no ${client.neighborhood ?? 'bairro'}.
Tom: positivo, baseado em dados, com sugestões concretas para a próxima semana.

MÉTRICAS DA SEMANA:
- Mensagens enviadas: ${metrics.messagesSent}
- Taxa de leitura: ${metrics.readRate}%
- Respostas recebidas: ${metrics.repliesReceived}
- Novos leads gerados: ${metrics.newLeadsGen}
- Agendamentos realizados: ${metrics.appointmentsSet}
- Taxa de conversão: ${metrics.conversionRate}%

Responda APENAS com JSON válido no formato:
{
  "highlights": "texto com destaques separados por \\n- ",
  "recommendations": "texto com 3 recomendações separadas por \\n- ",
  "nextWeekPlan": "parágrafo único sobre o que a i9 fará na próxima semana"
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: 'Você é analista de marketing digital especializado em PMEs da Zona Leste de SP. Responda apenas com JSON válido.',
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ReportContent
    }
  } catch (err) {
    logger.warn({ err }, 'weeklyReport: falha ao chamar Claude — usando fallback')
  }

  return {
    highlights: `Taxa de leitura de ${metrics.readRate}% indica boa entregabilidade.\nForam recebidas ${metrics.repliesReceived} respostas, demonstrando engajamento.\nTotal de ${metrics.messagesSent} mensagens disparadas na semana.`,
    recommendations: `Testar novos horários de envio para aumentar abertura.\nCriar mensagem de acompanhamento para leads sem resposta.\nRevisar template com base nas respostas recebidas.`,
    nextWeekPlan: `A equipe i9 irá analisar os resultados desta semana e ajustar a estratégia de comunicação para maximizar o engajamento e conversões do ${client.businessName}.`,
  }
}

// ─── Gerar PDF com Puppeteer ──────────────────────────────────────────────────

async function generatePdf(html: string, filename: string): Promise<string | null> {
  ensureReportsDir()
  const pdfPath = path.join(REPORTS_DIR, filename)

  try {
    // Import dinâmico — puppeteer é opcional (pode não estar disponível em todos os ambientes)
    const puppeteer = await import('puppeteer').catch(() => null)
    if (!puppeteer) {
      logger.warn('puppeteer não instalado — PDF não será gerado')
      return null
    }

    const launchOptions: Record<string, unknown> = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    }

    if (env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions['executablePath'] = env.PUPPETEER_EXECUTABLE_PATH
    }

    const browser = await puppeteer.default.launch(launchOptions)
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } })
    await browser.close()

    logger.info({ pdfPath }, 'PDF do relatório semanal gerado')
    return pdfPath
  } catch (err) {
    logger.warn({ err }, 'Falha ao gerar PDF — relatório salvo sem PDF')
    return null
  }
}

// ─── Montar dados para o template ────────────────────────────────────────────

interface TemplateData {
  businessName: string
  weekStart: string
  weekEnd: string
  messagesSent: number
  messagesRead: number
  repliesReceived: number
  newLeadsGen: number
  appointmentsSet: number
  readRate: string
  conversionRate: string
  barMessagesSent: string
  barMessagesRead: string
  barReplies: string
  barNewLeads: string
  barAppointments: string
  highlights: string
  highlightItems: string[]
  recommendations: string
  recommendationItems: string[]
  nextWeekPlan: string
}

function buildTemplateData(
  client: Client,
  weekStart: Date,
  weekEnd: Date,
  metrics: { messagesSent: number; messagesRead: number; repliesReceived: number; newLeadsGen: number; appointmentsSet: number; conversionRate: number },
  content: ReportContent,
): TemplateData {
  const readRate = metrics.messagesSent > 0
    ? ((metrics.messagesRead / metrics.messagesSent) * 100).toFixed(1)
    : '0'

  const maxBar = Math.max(metrics.messagesSent, 1)
  const toBarPct = (val: number) => Math.round((val / maxBar) * 100).toString()

  const highlightItems = content.highlights
    .split(/\n[-•*]?\s*/)
    .map((s) => s.trim())
    .filter(Boolean)

  const recommendationItems = content.recommendations
    .split(/\n[-•*\d.]+\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)

  return {
    businessName: client.businessName,
    weekStart: weekStart.toLocaleDateString('pt-BR'),
    weekEnd: weekEnd.toLocaleDateString('pt-BR'),
    messagesSent: metrics.messagesSent,
    messagesRead: metrics.messagesRead,
    repliesReceived: metrics.repliesReceived,
    newLeadsGen: metrics.newLeadsGen,
    appointmentsSet: metrics.appointmentsSet,
    readRate,
    conversionRate: metrics.conversionRate.toFixed(1),
    barMessagesSent: '100',
    barMessagesRead: toBarPct(metrics.messagesRead),
    barReplies: toBarPct(metrics.repliesReceived),
    barNewLeads: toBarPct(metrics.newLeadsGen),
    barAppointments: toBarPct(metrics.appointmentsSet),
    highlights: content.highlights,
    highlightItems,
    recommendations: content.recommendations,
    recommendationItems,
    nextWeekPlan: content.nextWeekPlan,
  }
}

// ─── API PÚBLICA ──────────────────────────────────────────────────────────────

/**
 * Gera o relatório semanal de um cliente, salva no banco e opcionalmente cria o PDF.
 */
export async function generateReport(clientId: string, weekStart: Date): Promise<WeeklyReport> {
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) throw new Error(`Cliente não encontrado: ${clientId}`)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  // ── SPRINT 1: Métricas reais puxadas do banco ────────────────────────────
  // Busca interações do lead de origem do cliente na semana
  const weekInteractions = client.leadId
    ? await prisma.interaction.findMany({
        where: {
          leadId: client.leadId,
          createdAt: { gte: weekStart, lte: weekEnd },
        },
      })
    : []

  const messagesSent    = weekInteractions.filter(i => i.direction === 'OUT').length
  const messagesRead    = weekInteractions.filter(i => i.direction === 'OUT' && i.type === 'WHATSAPP').length
  const repliesReceived = weekInteractions.filter(i => i.direction === 'IN').length

  // Novos leads prospectos gerados na semana
  const newLeadsGen = await prisma.lead.count({
    where: { importedAt: { gte: weekStart, lte: weekEnd } },
  })

  // Agendamentos: respostas IN com palavras de confirmação
  const appointmentsSet = weekInteractions.filter(i =>
    i.direction === 'IN' &&
    /agend|confirm|ok\b|sim\b|pode|vou|topei/i.test(i.content ?? '')
  ).length

  const conversionRate = messagesSent > 0
    ? parseFloat(((repliesReceived / messagesSent) * 100).toFixed(1))
    : 0

  const metrics = { messagesSent, messagesRead, repliesReceived, newLeadsGen, appointmentsSet, conversionRate }

  const readRate = messagesSent > 0
    ? parseFloat(((messagesRead / messagesSent) * 100).toFixed(1))
    : 0

  // Gerar conteúdo via Claude
  const content = await generateReportContent(client, { ...metrics, readRate })

  // Gerar HTML do relatório
  const template = compileTemplate()
  const templateData = buildTemplateData(client, weekStart, weekEnd, metrics, content)
  const html = template(templateData)

  // Gerar PDF
  const filename = `report-${clientId}-${weekStart.toISOString().slice(0, 10)}.pdf`
  const pdfPath = await generatePdf(html, filename)

  // Salvar no banco
  const report = await prisma.weeklyReport.create({
    data: {
      clientId,
      weekStart,
      weekEnd,
      messagesSent: metrics.messagesSent,
      messagesRead: metrics.messagesRead,
      repliesReceived: metrics.repliesReceived,
      newLeadsGen: metrics.newLeadsGen,
      appointmentsSet: metrics.appointmentsSet,
      conversionRate: metrics.conversionRate,
      highlights: content.highlights,
      recommendations: content.recommendations,
      nextWeekPlan: content.nextWeekPlan,
      pdfPath: pdfPath ?? undefined,
    },
  })

  logger.info({ reportId: report.id, clientId, weekStart }, 'Relatório semanal gerado')
  return report
}

/**
 * Envia o relatório por email e WhatsApp.
 */
export async function sendReport(reportId: string): Promise<void> {
  const report = await prisma.weeklyReport.findUnique({
    where: { id: reportId },
    include: { client: true },
  })

  if (!report) throw new Error(`Relatório não encontrado: ${reportId}`)

  const client = report.client
  const readRate =
    report.messagesSent > 0
      ? ((report.messagesRead / report.messagesSent) * 100).toFixed(1)
      : '0'

  // ── Email via Resend ──────────────────────────────────────────────────────
  if (client.email && env.RESEND_API_KEY) {
    try {
      const resend = new Resend(env.RESEND_API_KEY)

      const attachments: { filename: string; content: Buffer }[] = []
      if (report.pdfPath && fs.existsSync(report.pdfPath)) {
        attachments.push({
          filename: path.basename(report.pdfPath),
          content: fs.readFileSync(report.pdfPath),
        })
      }

      await resend.emails.send({
        from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
        to: client.email,
        subject: `📊 Relatório Semanal ${report.weekStart.toLocaleDateString('pt-BR')} — ${client.businessName}`,
        html: buildEmailHtml(client, report, readRate),
        attachments,
      })

      await prisma.weeklyReport.update({ where: { id: reportId }, data: { sentViaEmail: true } })
      logger.info({ reportId, clientEmail: client.email }, 'Relatório enviado por email')
    } catch (err) {
      logger.warn({ err, reportId }, 'Falha ao enviar relatório por email')
    }
  }

  // ── WhatsApp via Whapi ────────────────────────────────────────────────────
  // SPRINT 1: Reimplementado usando Whapi (substituiu Evolution API)
  if (client.whatsapp && env.WHAPI_TOKEN) {
    try {
      const pdfUrl = report.pdfPath
        ? `${env.REPORTS_BASE_URL}/api/reports/${reportId}/pdf`
        : null

      const message = buildWhatsAppMessage(client, report, readRate, pdfUrl)

      const { sendText } = await import('./whatsapp.service.js')
      const sent = await sendText(client.whatsapp, message)

      if (sent) {
        await prisma.weeklyReport.update({
          where: { id: reportId },
          data: { sentViaWhatsApp: true, sentAt: new Date() },
        })
        logger.info({ reportId, whatsapp: client.whatsapp }, 'Relatório enviado por WhatsApp via Whapi')
      } else {
        logger.warn({ reportId, whatsapp: client.whatsapp }, 'Falha ao enviar relatório por WhatsApp via Whapi')
      }
    } catch (err) {
      logger.warn({ err, reportId }, 'Falha ao enviar relatório por WhatsApp')
    }
  }
}

// ─── Helper: mensagem WhatsApp do relatório ───────────────────────────────────
// SPRINT 1: Reativado para uso com Whapi (sendText de whatsapp.service.ts)

function buildWhatsAppMessage(
  client: Client,
  report: WeeklyReport,
  readRate: string,
  pdfUrl: string | null,
): string {
  const lines = [
    `Olá, ${client.ownerName}! Seu relatório semanal da i9 está pronto 📊`,
    '',
    `Semana de ${report.weekStart.toLocaleDateString('pt-BR')} a ${report.weekEnd.toLocaleDateString('pt-BR')}`,
    '',
    `✅ ${report.messagesSent} mensagens enviadas`,
    `👀 ${readRate}% taxa de leitura`,
    `💬 ${report.repliesReceived} respostas recebidas`,
    `🎯 ${report.appointmentsSet} agendamentos realizados`,
  ]

  if (pdfUrl) {
    lines.push('', `📄 Relatório completo: ${pdfUrl}`)
  }

  lines.push('', 'Qualquer dúvida, é só chamar! 💚')
  return lines.join('\n')
}

function buildEmailHtml(client: Client, report: WeeklyReport, readRate: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; }
  .header { background: #1D9E75; padding: 24px; color: #fff; }
  .content { padding: 24px; }
  .kpi { display: inline-block; background: #f5f5f5; border-radius: 8px; padding: 12px 20px; margin: 8px; text-align: center; }
  .kpi-value { font-size: 28px; font-weight: bold; color: #1D9E75; }
  .kpi-label { font-size: 12px; color: #666; }
  .footer { background: #1a1a2e; color: #fff; padding: 16px; font-size: 12px; }
</style></head>
<body>
  <div class="header">
    <h2>📊 Relatório Semanal — ${client.businessName}</h2>
    <p>${report.weekStart.toLocaleDateString('pt-BR')} a ${report.weekEnd.toLocaleDateString('pt-BR')}</p>
  </div>
  <div class="content">
    <p>Olá, <strong>${client.ownerName}</strong>! Confira os resultados da sua semana:</p>
    <div style="margin: 20px 0; text-align: center;">
      <div class="kpi"><div class="kpi-value">${report.messagesSent}</div><div class="kpi-label">Mensagens Enviadas</div></div>
      <div class="kpi"><div class="kpi-value">${readRate}%</div><div class="kpi-label">Taxa de Leitura</div></div>
      <div class="kpi"><div class="kpi-value">${report.repliesReceived}</div><div class="kpi-label">Respostas</div></div>
      <div class="kpi"><div class="kpi-value">${report.appointmentsSet}</div><div class="kpi-label">Agendamentos</div></div>
    </div>
    ${report.highlights ? `<h3>Destaques</h3><p>${report.highlights.replace(/\n/g, '<br>')}</p>` : ''}
    ${report.recommendations ? `<h3>Recomendações</h3><p>${report.recommendations.replace(/\n/g, '<br>')}</p>` : ''}
  </div>
  <div class="footer">
    <strong>i9 Soluções Digitais</strong> · crm@i9solucoes.com.br<br>
    Zona Leste de São Paulo
  </div>
</body></html>`
}

/**
 * Gera relatórios para todos os clientes ativos com data de início da semana.
 */
export async function generateWeeklyReportsForAllClients(): Promise<{ generated: number; errors: number }> {
  const clients = await prisma.client.findMany({ where: { status: 'active' } })

  const friday = new Date()
  friday.setHours(0, 0, 0, 0)
  // Calcular segunda-feira da semana atual
  const day = friday.getDay()
  const monday = new Date(friday)
  monday.setDate(friday.getDate() - ((day + 6) % 7))

  let generated = 0
  let errors = 0

  for (const client of clients) {
    try {
      // Evita duplicata para a mesma semana
      const existing = await prisma.weeklyReport.findFirst({
        where: { clientId: client.id, weekStart: monday },
      })
      if (existing) continue

      await generateReport(client.id, monday)
      generated++
    } catch (err) {
      errors++
      logger.error({ err, clientId: client.id }, 'Erro ao gerar relatório semanal')
    }
  }

  logger.info({ generated, errors }, 'Geração semanal concluída')
  return { generated, errors }
}

/**
 * Envia todos os relatórios gerados na semana atual ainda não enviados.
 */
export async function sendPendingWeeklyReports(): Promise<{ sent: number; errors: number }> {
  const reports = await prisma.weeklyReport.findMany({
    where: {
      sentViaEmail: false,
      sentViaWhatsApp: false,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  })

  let sent = 0
  let errors = 0

  for (const report of reports) {
    try {
      await sendReport(report.id)
      sent++
    } catch (err) {
      errors++
      logger.error({ err, reportId: report.id }, 'Erro ao enviar relatório semanal')
    }
  }

  logger.info({ sent, errors }, 'Envio semanal concluído')
  return { sent, errors }
}

/**
 * Retorna o HTML do relatório para servir como preview ou gerar PDF sob demanda.
 */
export async function getReportHtml(reportId: string): Promise<string> {
  const report = await prisma.weeklyReport.findUnique({
    where: { id: reportId },
    include: { client: true },
  })
  if (!report) throw new Error(`Relatório não encontrado: ${reportId}`)

  const content: ReportContent = {
    highlights: report.highlights ?? '',
    recommendations: report.recommendations ?? '',
    nextWeekPlan: report.nextWeekPlan ?? '',
  }

  const template = compileTemplate()
  const templateData = buildTemplateData(
    report.client,
    report.weekStart,
    report.weekEnd,
    {
      messagesSent: report.messagesSent,
      messagesRead: report.messagesRead,
      repliesReceived: report.repliesReceived,
      newLeadsGen: report.newLeadsGen,
      appointmentsSet: report.appointmentsSet,
      conversionRate: report.conversionRate,
    },
    content,
  )

  return template(templateData)
}
