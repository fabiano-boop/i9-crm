"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReport = generateReport;
exports.sendReport = sendReport;
exports.generateWeeklyReportsForAllClients = generateWeeklyReportsForAllClients;
exports.sendPendingWeeklyReports = sendPendingWeeklyReports;
exports.getReportHtml = getReportHtml;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const resend_1 = require("resend");
const database_js_1 = require("../config/database.js");
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../utils/logger.js");
// __dirname is a CJS global (package.json has no "type": "module")
const TEMPLATE_PATH = path_1.default.resolve(__dirname, '../templates/weeklyReport.hbs');
const REPORTS_DIR = path_1.default.resolve('/tmp/i9crm-reports');
// ─── Helpers do Handlebars ────────────────────────────────────────────────────
handlebars_1.default.registerHelper('index_plus_1', function (options) {
    const index = options.data?.['index'];
    return (index ?? 0) + 1;
});
// ─── Garantir diretório de relatórios ────────────────────────────────────────
function ensureReportsDir() {
    if (!fs_1.default.existsSync(REPORTS_DIR)) {
        fs_1.default.mkdirSync(REPORTS_DIR, { recursive: true });
    }
}
// ─── Compilar template ───────────────────────────────────────────────────────
function compileTemplate() {
    const source = fs_1.default.readFileSync(TEMPLATE_PATH, 'utf-8');
    return handlebars_1.default.compile(source);
}
async function generateReportContent(client, metrics) {
    if (!env_js_1.env.ANTHROPIC_API_KEY) {
        return {
            highlights: 'Semana com boa performance. Métricas de engajamento dentro do esperado.',
            recommendations: '1. Aumentar frequência de envios. 2. Testar novos templates. 3. Revisar horários de disparo.',
            nextWeekPlan: 'A equipe i9 irá otimizar os fluxos de atendimento e preparar novos conteúdos para a próxima semana.',
        };
    }
    const anthropic = new sdk_1.default({ apiKey: env_js_1.env.ANTHROPIC_API_KEY });
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
}`;
    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 800,
            system: 'Você é analista de marketing digital especializado em PMEs da Zona Leste de SP. Responda apenas com JSON válido.',
            messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    }
    catch (err) {
        logger_js_1.logger.warn({ err }, 'weeklyReport: falha ao chamar Claude — usando fallback');
    }
    return {
        highlights: `Taxa de leitura de ${metrics.readRate}% indica boa entregabilidade.\nForam recebidas ${metrics.repliesReceived} respostas, demonstrando engajamento.\nTotal de ${metrics.messagesSent} mensagens disparadas na semana.`,
        recommendations: `Testar novos horários de envio para aumentar abertura.\nCriar mensagem de acompanhamento para leads sem resposta.\nRevisar template com base nas respostas recebidas.`,
        nextWeekPlan: `A equipe i9 irá analisar os resultados desta semana e ajustar a estratégia de comunicação para maximizar o engajamento e conversões do ${client.businessName}.`,
    };
}
// ─── Gerar PDF com Puppeteer ──────────────────────────────────────────────────
async function generatePdf(html, filename) {
    ensureReportsDir();
    const pdfPath = path_1.default.join(REPORTS_DIR, filename);
    try {
        // Import dinâmico — puppeteer é opcional (pode não estar disponível em todos os ambientes)
        const puppeteer = await import('puppeteer').catch(() => null);
        if (!puppeteer) {
            logger_js_1.logger.warn('puppeteer não instalado — PDF não será gerado');
            return null;
        }
        const launchOptions = {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        };
        if (env_js_1.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions['executablePath'] = env_js_1.env.PUPPETEER_EXECUTABLE_PATH;
        }
        const browser = await puppeteer.default.launch(launchOptions);
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
        await browser.close();
        logger_js_1.logger.info({ pdfPath }, 'PDF do relatório semanal gerado');
        return pdfPath;
    }
    catch (err) {
        logger_js_1.logger.warn({ err }, 'Falha ao gerar PDF — relatório salvo sem PDF');
        return null;
    }
}
function buildTemplateData(client, weekStart, weekEnd, metrics, content) {
    const readRate = metrics.messagesSent > 0
        ? ((metrics.messagesRead / metrics.messagesSent) * 100).toFixed(1)
        : '0';
    const maxBar = Math.max(metrics.messagesSent, 1);
    const toBarPct = (val) => Math.round((val / maxBar) * 100).toString();
    const highlightItems = content.highlights
        .split(/\n[-•*]?\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
    const recommendationItems = content.recommendations
        .split(/\n[-•*\d.]+\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3);
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
    };
}
// ─── API PÚBLICA ──────────────────────────────────────────────────────────────
/**
 * Gera o relatório semanal de um cliente, salva no banco e opcionalmente cria o PDF.
 */
async function generateReport(clientId, weekStart) {
    const client = await database_js_1.prisma.client.findUnique({ where: { id: clientId } });
    if (!client)
        throw new Error(`Cliente não encontrado: ${clientId}`);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    // Métricas: nesta versão usamos valores zerados (a integrar com dados reais do WhatsApp/CRM)
    const metrics = {
        messagesSent: 0,
        messagesRead: 0,
        repliesReceived: 0,
        newLeadsGen: 0,
        appointmentsSet: 0,
        conversionRate: 0,
    };
    const readRate = metrics.messagesSent > 0
        ? parseFloat(((metrics.messagesRead / metrics.messagesSent) * 100).toFixed(1))
        : 0;
    // Gerar conteúdo via Claude
    const content = await generateReportContent(client, { ...metrics, readRate });
    // Gerar HTML do relatório
    const template = compileTemplate();
    const templateData = buildTemplateData(client, weekStart, weekEnd, metrics, content);
    const html = template(templateData);
    // Gerar PDF
    const filename = `report-${clientId}-${weekStart.toISOString().slice(0, 10)}.pdf`;
    const pdfPath = await generatePdf(html, filename);
    // Salvar no banco
    const report = await database_js_1.prisma.weeklyReport.create({
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
    });
    logger_js_1.logger.info({ reportId: report.id, clientId, weekStart }, 'Relatório semanal gerado');
    return report;
}
/**
 * Envia o relatório por email e WhatsApp.
 */
async function sendReport(reportId) {
    const report = await database_js_1.prisma.weeklyReport.findUnique({
        where: { id: reportId },
        include: { client: true },
    });
    if (!report)
        throw new Error(`Relatório não encontrado: ${reportId}`);
    const client = report.client;
    const readRate = report.messagesSent > 0
        ? ((report.messagesRead / report.messagesSent) * 100).toFixed(1)
        : '0';
    // ── Email via Resend ──────────────────────────────────────────────────────
    if (client.email && env_js_1.env.RESEND_API_KEY) {
        try {
            const resend = new resend_1.Resend(env_js_1.env.RESEND_API_KEY);
            const attachments = [];
            if (report.pdfPath && fs_1.default.existsSync(report.pdfPath)) {
                attachments.push({
                    filename: path_1.default.basename(report.pdfPath),
                    content: fs_1.default.readFileSync(report.pdfPath),
                });
            }
            await resend.emails.send({
                from: `${env_js_1.env.EMAIL_FROM_NAME} <${env_js_1.env.EMAIL_FROM}>`,
                to: client.email,
                subject: `📊 Relatório Semanal ${report.weekStart.toLocaleDateString('pt-BR')} — ${client.businessName}`,
                html: buildEmailHtml(client, report, readRate),
                attachments,
            });
            await database_js_1.prisma.weeklyReport.update({ where: { id: reportId }, data: { sentViaEmail: true } });
            logger_js_1.logger.info({ reportId, clientEmail: client.email }, 'Relatório enviado por email');
        }
        catch (err) {
            logger_js_1.logger.warn({ err, reportId }, 'Falha ao enviar relatório por email');
        }
    }
    // ── WhatsApp ──────────────────────────────────────────────────────────────
    // [LEGADO Evolution API removido — substituído pelo Whapi]
    // TODO: reimplementar envio de relatório via Whapi quando necessário.
    /*
    if (client.whatsapp && env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY) {
      try {
        const pdfUrl = report.pdfPath
          ? `${env.REPORTS_BASE_URL}/api/clients/${client.id}/reports/${reportId}/pdf`
          : null
  
        const message = buildWhatsAppMessage(client, report, readRate, pdfUrl)
  
        const axios = (await import('axios')).default
        await axios.post(
          `${env.EVOLUTION_API_URL}/message/sendText/${env.EVOLUTION_INSTANCE_NAME}`,
          { number: client.whatsapp, text: message },
          { headers: { apikey: env.EVOLUTION_API_KEY, 'Content-Type': 'application/json' } },
        )
  
        await prisma.weeklyReport.update({ where: { id: reportId }, data: { sentViaWhatsApp: true, sentAt: new Date() } })
        logger.info({ reportId, whatsapp: client.whatsapp }, 'Relatório enviado por WhatsApp')
      } catch (err) {
        logger.warn({ err, reportId }, 'Falha ao enviar relatório por WhatsApp')
      }
    }
    */
}
// ─── Helpers de mensagem ──────────────────────────────────────────────────────
// [LEGADO Evolution API] — helper usado apenas pelo envio via WhatsApp que foi
// removido. Mantido comentado para eventual reativação via Whapi.
/*
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
*/
function buildEmailHtml(client, report, readRate) {
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
</body></html>`;
}
/**
 * Gera relatórios para todos os clientes ativos com data de início da semana.
 */
async function generateWeeklyReportsForAllClients() {
    const clients = await database_js_1.prisma.client.findMany({ where: { status: 'active' } });
    const friday = new Date();
    friday.setHours(0, 0, 0, 0);
    // Calcular segunda-feira da semana atual
    const day = friday.getDay();
    const monday = new Date(friday);
    monday.setDate(friday.getDate() - ((day + 6) % 7));
    let generated = 0;
    let errors = 0;
    for (const client of clients) {
        try {
            // Evita duplicata para a mesma semana
            const existing = await database_js_1.prisma.weeklyReport.findFirst({
                where: { clientId: client.id, weekStart: monday },
            });
            if (existing)
                continue;
            await generateReport(client.id, monday);
            generated++;
        }
        catch (err) {
            errors++;
            logger_js_1.logger.error({ err, clientId: client.id }, 'Erro ao gerar relatório semanal');
        }
    }
    logger_js_1.logger.info({ generated, errors }, 'Geração semanal concluída');
    return { generated, errors };
}
/**
 * Envia todos os relatórios gerados na semana atual ainda não enviados.
 */
async function sendPendingWeeklyReports() {
    const reports = await database_js_1.prisma.weeklyReport.findMany({
        where: {
            sentViaEmail: false,
            sentViaWhatsApp: false,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
    });
    let sent = 0;
    let errors = 0;
    for (const report of reports) {
        try {
            await sendReport(report.id);
            sent++;
        }
        catch (err) {
            errors++;
            logger_js_1.logger.error({ err, reportId: report.id }, 'Erro ao enviar relatório semanal');
        }
    }
    logger_js_1.logger.info({ sent, errors }, 'Envio semanal concluído');
    return { sent, errors };
}
/**
 * Retorna o HTML do relatório para servir como preview ou gerar PDF sob demanda.
 */
async function getReportHtml(reportId) {
    const report = await database_js_1.prisma.weeklyReport.findUnique({
        where: { id: reportId },
        include: { client: true },
    });
    if (!report)
        throw new Error(`Relatório não encontrado: ${reportId}`);
    const content = {
        highlights: report.highlights ?? '',
        recommendations: report.recommendations ?? '',
        nextWeekPlan: report.nextWeekPlan ?? '',
    };
    const template = compileTemplate();
    const templateData = buildTemplateData(report.client, report.weekStart, report.weekEnd, {
        messagesSent: report.messagesSent,
        messagesRead: report.messagesRead,
        repliesReceived: report.repliesReceived,
        newLeadsGen: report.newLeadsGen,
        appointmentsSet: report.appointmentsSet,
        conversionRate: report.conversionRate,
    }, content);
    return template(templateData);
}
//# sourceMappingURL=weeklyClientReport.service.js.map