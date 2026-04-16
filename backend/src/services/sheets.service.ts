import { google, sheets_v4 } from 'googleapis'
import crypto from 'crypto'
import { prisma } from '../config/database.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { wsEvents } from './websocket.service.js'
import { normalizePhone } from './duplicate.service.js'
import type { DigitalLevel, Classification, LeadStatus } from '@prisma/client'

// Mapeamento das colunas da planilha i9 Cowork → Lead
// A=dataCap, B=nome, C=nicho, D=bairro, E=endereco, F=telefone
// G=avalGoog, H=reviews, I=site, J=instagram, K=nivelDigital
// L=dores, M=servPrincipal, N=servUpsell, O=urgencia
// P=fatPotencial, Q=facilFechamento, R=score, S=classificacao
// T=anguloWha, U=status, V=responsavel, W=observacoes, X=nomeNegocio

interface SheetRow {
  rowIndex: number
  raw: string[]
}

interface ParsedLead {
  externalId: string
  name: string
  businessName: string
  niche: string
  neighborhood: string
  address: string
  phone: string
  whatsapp: string
  googleRating: number | null
  reviewCount: number | null
  website: string
  instagram: string
  digitalLevel: DigitalLevel
  painPoints: string
  idealService: string
  upsellService: string
  urgency: number
  revenuePotential: string
  closingEase: string
  score: number
  classification: Classification
  whatsappAngle: string
  source: string
  status: LeadStatus
  notes: string
  dataHash: string
}

function getSheets(): sheets_v4.Sheets {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado')
  }

  let credentials: Record<string, unknown>
  try {
    credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON inválido — JSON malformado. Verifique se não há quebras de linha.')
  }

  // Detecta credencial de aplicação web (type != service_account) — erro comum
  if (credentials.type !== 'service_account') {
    const got = credentials.type ?? (credentials.web ? 'web (OAuth client)' : 'desconhecido')
    throw new Error(
      `GOOGLE_SERVICE_ACCOUNT_JSON inválido — tipo "${got}". ` +
      `Precisa ser uma Service Account JSON (type: "service_account"). ` +
      `Acesse Google Cloud Console → IAM → Contas de serviço → Criar chave JSON.`,
    )
  }

  // Corrige \n escapados no private_key (problema comum ao colar JSON em env vars)
  if (typeof credentials.private_key === 'string') {
    credentials = { ...credentials, private_key: credentials.private_key.replace(/\\n/g, '\n') }
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

function normalizeDigitalLevel(val: string): DigitalLevel {
  const v = val?.toLowerCase()
  if (v === 'alto' || v === 'high') return 'HIGH'
  if (v === 'médio' || v === 'medio' || v === 'medium') return 'MEDIUM'
  return 'LOW'
}

function normalizeClassification(val: string): Classification {
  const v = val?.toUpperCase()
  if (v === 'HOT' || v === 'QUENTE') return 'HOT'
  if (v === 'WARM' || v === 'MORNO') return 'WARM'
  return 'COLD'
}

function normalizeStatus(val: string): LeadStatus {
  const map: Record<string, LeadStatus> = {
    novo: 'NEW', new: 'NEW',
    contatado: 'CONTACTED', contacted: 'CONTACTED',
    respondeu: 'REPLIED', replied: 'REPLIED',
    proposta: 'PROPOSAL', proposal: 'PROPOSAL',
    negociação: 'NEGOTIATION', negociacao: 'NEGOTIATION', negotiation: 'NEGOTIATION',
    fechado: 'CLOSED', closed: 'CLOSED',
    perdido: 'LOST', lost: 'LOST',
  }
  return map[val?.toLowerCase()] ?? 'NEW'
}

function parseRow(row: SheetRow): ParsedLead | null {
  const r = row.raw
  // Linha vazia ou sem nome — pular
  if (!r[1]?.trim()) return null

  const raw = r.map((v) => v?.trim() ?? '')
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
    source: raw[21] ?? '',       // coluna V = responsavel/origem (ex: Instagram, Google)
    notes: raw[22] ?? '',
    businessName: raw[23] ?? raw[1] ?? '', // coluna X ou fallback para nome
  }

  // Hash dos dados para detectar mudanças sem comparar campo a campo
  const dataHash = crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex')

  return { ...data, dataHash }
}

export interface SyncResult {
  rowsImported: number
  rowsUpdated: number
  rowsSkipped: number
  errors: string[]
}

export async function syncFromSheets(): Promise<SyncResult> {
  if (!env.GOOGLE_SHEETS_ID) {
    throw new Error('GOOGLE_SHEETS_ID não configurado')
  }

  const sheets = getSheets()
  const result: SyncResult = { rowsImported: 0, rowsUpdated: 0, rowsSkipped: 0, errors: [] }

  logger.info('Iniciando sync com Google Sheets...')

  // Lê aba "Leads Capturados" a partir da linha 2
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    range: 'Leads Capturados!A2:X',
  })

  const rows = response.data.values ?? []
  logger.info(`${rows.length} linhas encontradas na planilha`)

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 2 // linha 2 = índice 0 do array
    try {
      const parsed = parseRow({ rowIndex, raw: rows[i] ?? [] })
      if (!parsed) {
        result.rowsSkipped++
        continue
      }

      // Verifica se lead já existe e se os dados mudaram
      const existing = await prisma.lead.findUnique({
        where: { externalId: parsed.externalId },
        select: { id: true, notes: true },
      })

      const { dataHash, ...leadData } = parsed

      if (!existing) {
        // Antes de inserir: verifica duplicata por telefone
        const normalizedPhone = normalizePhone(leadData.phone ?? leadData.whatsapp ?? '')
        if (normalizedPhone) {
          const phoneMatch = await prisma.lead.findFirst({
            where: {
              OR: [
                { phone:    { endsWith: normalizedPhone } },
                { whatsapp: { endsWith: normalizedPhone } },
              ],
            },
            select: { id: true, businessName: true },
          })
          if (phoneMatch) {
            logger.warn(
              { externalId: parsed.externalId, matchId: phoneMatch.id, businessName: phoneMatch.businessName },
              'Sheets sync: possível duplicata por telefone — fazendo upsert no lead existente',
            )
            await prisma.lead.update({
              where: { id: phoneMatch.id },
              data: { ...leadData, externalId: phoneMatch.id }, // mantém ID existente
            })
            result.rowsUpdated++
            continue
          }
        }

        // Lead novo — inserir
        await prisma.lead.create({ data: leadData })
        result.rowsImported++
      } else {
        // Lead existente — atualizar (preserva notes manuais se não vier da planilha)
        await prisma.lead.update({
          where: { externalId: parsed.externalId },
          data: {
            ...leadData,
            // Preserva notes editadas manualmente no CRM se a planilha não tiver notes
            notes: leadData.notes || existing.notes,
          },
        })
        result.rowsUpdated++
      }
    } catch (err) {
      const msg = `Linha ${rowIndex}: ${err instanceof Error ? err.message : String(err)}`
      result.errors.push(msg)
      logger.warn(msg)
    }
  }

  // Registra o sync na tabela de histórico
  await prisma.sheetSync.create({
    data: {
      rowsImported: result.rowsImported,
      rowsUpdated: result.rowsUpdated,
      status: result.errors.length === 0 ? 'success' : result.errors.length < rows.length ? 'partial' : 'error',
      errorMsg: result.errors.length > 0 ? result.errors.slice(0, 5).join(' | ') : null,
    },
  })

  const syncStatus = result.errors.length === 0 ? 'success' : result.errors.length < rows.length ? 'partial' : 'error'
  logger.info(result, 'Sync Google Sheets concluído')

  // Notifica todos os clientes conectados via WebSocket
  wsEvents.syncComplete({
    rowsImported: result.rowsImported,
    rowsUpdated: result.rowsUpdated,
    status: syncStatus,
  })

  return result
}
