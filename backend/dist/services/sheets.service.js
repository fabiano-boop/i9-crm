"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncFromSheets = syncFromSheets;
const googleapis_1 = require("googleapis");
const crypto_1 = __importDefault(require("crypto"));
const database_js_1 = require("../config/database.js");
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../utils/logger.js");
const websocket_service_js_1 = require("./websocket.service.js");
const duplicate_service_js_1 = require("./duplicate.service.js");
const marketIntelligence_js_1 = require("../data/marketIntelligence.js");
/**
 * Enriquece os campos do lead com dados de inteligência de mercado.
 * Preenche apenas campos vazios — não sobrescreve dados da planilha.
 */
function enrichWithMarketIntelligence(niche, existing) {
    const segmento = (0, marketIntelligence_js_1.getSegmentoByNiche)(niche);
    if (!segmento)
        return existing;
    return {
        painPoints: existing.painPoints || segmento.dor,
        idealService: existing.idealService || segmento.servicoIdeal,
        revenuePotential: existing.revenuePotential || `R$ ${segmento.ticketMin} – R$ ${segmento.ticketMax}/mês`,
        recommendedPackage: segmento.pacoteRecomendado.toLowerCase().replace(/[áàã]/g, 'a'),
        conversionPotential: segmento.potencialConversao,
    };
}
function getSheets() {
    if (!env_js_1.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado');
    }
    let credentials;
    try {
        credentials = JSON.parse(env_js_1.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    }
    catch {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON inválido — JSON malformado. Verifique se não há quebras de linha.');
    }
    // Detecta credencial de aplicação web (type != service_account) — erro comum
    if (credentials.type !== 'service_account') {
        const got = credentials.type ?? (credentials.web ? 'web (OAuth client)' : 'desconhecido');
        throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON inválido — tipo "${got}". ` +
            `Precisa ser uma Service Account JSON (type: "service_account"). ` +
            `Acesse Google Cloud Console → IAM → Contas de serviço → Criar chave JSON.`);
    }
    // Corrige \n escapados no private_key (problema comum ao colar JSON em env vars)
    if (typeof credentials.private_key === 'string') {
        credentials = { ...credentials, private_key: credentials.private_key.replace(/\\n/g, '\n') };
    }
    const auth = new googleapis_1.google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return googleapis_1.google.sheets({ version: 'v4', auth });
}
function normalizeDigitalLevel(val) {
    const v = val?.toLowerCase();
    if (v === 'alto' || v === 'high')
        return 'HIGH';
    if (v === 'médio' || v === 'medio' || v === 'medium')
        return 'MEDIUM';
    return 'LOW';
}
function normalizeClassification(val) {
    const v = val?.toUpperCase();
    if (v === 'HOT' || v === 'QUENTE')
        return 'HOT';
    if (v === 'WARM' || v === 'MORNO')
        return 'WARM';
    return 'COLD';
}
function normalizeStatus(val) {
    const map = {
        novo: 'NEW', new: 'NEW',
        contatado: 'CONTACTED', contacted: 'CONTACTED',
        respondeu: 'REPLIED', replied: 'REPLIED',
        proposta: 'PROPOSAL', proposal: 'PROPOSAL',
        negociação: 'NEGOTIATION', negociacao: 'NEGOTIATION', negotiation: 'NEGOTIATION',
        fechado: 'CLOSED', closed: 'CLOSED',
        perdido: 'LOST', lost: 'LOST',
    };
    return map[val?.toLowerCase()] ?? 'NEW';
}
function parseRow(row) {
    const r = row.raw;
    // Linha vazia ou sem nome — pular
    if (!r[1]?.trim())
        return null;
    const raw = r.map((v) => v?.trim() ?? '');
    const data = {
        externalId: `sheet_row_${row.rowIndex}`,
        name: raw[1] ?? '',
        niche: raw[2] ?? '',
        neighborhood: raw[3] ?? '',
        address: raw[4] ?? '',
        phone: raw[5] ?? '',
        whatsapp: raw[5] ?? '', // mesmo campo de telefone por padrão
        googleRating: raw[6] ? parseFloat(raw[6].replace(',', '.')) : null,
        reviewCount: raw[7] ? parseInt(raw[7]) : null,
        website: raw[8] ?? '',
        instagram: raw[9] ?? '',
        digitalLevel: normalizeDigitalLevel(raw[10]),
        painPoints: raw[11] ?? '',
        idealService: raw[12] ?? '',
        upsellService: raw[13] ?? '',
        urgency: raw[14] ? parseInt(raw[14]) || 5 : 5,
        revenuePotential: raw[15] ?? '',
        closingEase: raw[16] ?? '',
        score: raw[17] ? parseInt(raw[17]) || 0 : 0,
        classification: normalizeClassification(raw[18]),
        whatsappAngle: raw[19] ?? '',
        status: normalizeStatus(raw[20]),
        source: raw[21] ?? '', // coluna V = responsavel/origem (ex: Instagram, Google)
        notes: raw[22] ?? '',
        businessName: raw[23] ?? raw[1] ?? '', // coluna X ou fallback para nome
    };
    // Enriquece com dados de inteligência de mercado (não sobrescreve dados da planilha)
    const enriched = enrichWithMarketIntelligence(data.niche, {
        painPoints: data.painPoints,
        idealService: data.idealService,
        revenuePotential: data.revenuePotential,
    });
    const finalData = { ...data, ...enriched };
    // Hash dos dados para detectar mudanças sem comparar campo a campo
    const dataHash = crypto_1.default
        .createHash('md5')
        .update(JSON.stringify(finalData))
        .digest('hex');
    return { ...finalData, dataHash };
}
async function syncFromSheets() {
    if (!env_js_1.env.GOOGLE_SHEETS_ID) {
        throw new Error('GOOGLE_SHEETS_ID não configurado');
    }
    const sheets = getSheets();
    const result = { rowsImported: 0, rowsUpdated: 0, rowsSkipped: 0, errors: [] };
    logger_js_1.logger.info('Iniciando sync com Google Sheets...');
    // Lê aba "Leads Capturados" a partir da linha 2
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: env_js_1.env.GOOGLE_SHEETS_ID,
        range: 'Leads!A2:X',
    });
    const rows = response.data.values ?? [];
    logger_js_1.logger.info(`${rows.length} linhas encontradas na planilha`);
    for (let i = 0; i < rows.length; i++) {
        const rowIndex = i + 2; // linha 2 = índice 0 do array
        try {
            const parsed = parseRow({ rowIndex, raw: rows[i] ?? [] });
            if (!parsed) {
                result.rowsSkipped++;
                continue;
            }
            // Verifica se lead já existe e se os dados mudaram
            const existing = await database_js_1.prisma.lead.findUnique({
                where: { externalId: parsed.externalId },
                select: { id: true, notes: true },
            });
            const { dataHash, ...leadData } = parsed;
            if (!existing) {
                // Antes de inserir: verifica duplicata por telefone
                const normalizedPhone = (0, duplicate_service_js_1.normalizePhone)(leadData.phone ?? leadData.whatsapp ?? '');
                if (normalizedPhone) {
                    const phoneMatch = await database_js_1.prisma.lead.findFirst({
                        where: {
                            OR: [
                                { phone: { endsWith: normalizedPhone } },
                                { whatsapp: { endsWith: normalizedPhone } },
                            ],
                        },
                        select: { id: true, businessName: true },
                    });
                    if (phoneMatch) {
                        logger_js_1.logger.warn({ externalId: parsed.externalId, matchId: phoneMatch.id, businessName: phoneMatch.businessName }, 'Sheets sync: possível duplicata por telefone — fazendo upsert no lead existente');
                        await database_js_1.prisma.lead.update({
                            where: { id: phoneMatch.id },
                            data: { ...leadData, externalId: phoneMatch.id }, // mantém ID existente
                        });
                        result.rowsUpdated++;
                        continue;
                    }
                }
                // Lead novo — inserir
                await database_js_1.prisma.lead.create({ data: leadData });
                result.rowsImported++;
            }
            else {
                // Lead existente — atualizar (preserva notes manuais se não vier da planilha)
                await database_js_1.prisma.lead.update({
                    where: { externalId: parsed.externalId },
                    data: {
                        ...leadData,
                        // Preserva notes editadas manualmente no CRM se a planilha não tiver notes
                        notes: leadData.notes || existing.notes,
                    },
                });
                result.rowsUpdated++;
            }
        }
        catch (err) {
            const msg = `Linha ${rowIndex}: ${err instanceof Error ? err.message : String(err)}`;
            result.errors.push(msg);
            logger_js_1.logger.warn(msg);
        }
    }
    // Registra o sync na tabela de histórico
    await database_js_1.prisma.sheetSync.create({
        data: {
            rowsImported: result.rowsImported,
            rowsUpdated: result.rowsUpdated,
            status: result.errors.length === 0 ? 'success' : result.errors.length < rows.length ? 'partial' : 'error',
            errorMsg: result.errors.length > 0 ? result.errors.slice(0, 5).join(' | ') : null,
        },
    });
    const syncStatus = result.errors.length === 0 ? 'success' : result.errors.length < rows.length ? 'partial' : 'error';
    logger_js_1.logger.info(result, 'Sync Google Sheets concluído');
    // Notifica todos os clientes conectados via WebSocket
    websocket_service_js_1.wsEvents.syncComplete({
        rowsImported: result.rowsImported,
        rowsUpdated: result.rowsUpdated,
        status: syncStatus,
    });
    return result;
}
//# sourceMappingURL=sheets.service.js.map