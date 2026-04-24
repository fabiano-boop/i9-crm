import { google } from 'googleapis'
import crypto from 'crypto'
import { prisma } from '../config/database.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

// ─── Criptografia AES-256-CBC — chave derivada do JWT_SECRET ─────────────────

function encKey(): Buffer {
  return crypto.createHash('sha256').update(env.JWT_SECRET).digest()
}

export function encryptToken(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', encKey(), iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${enc.toString('hex')}`
}

export function decryptToken(data: string): string {
  const [ivHex, encHex] = data.split(':')
  const decipher = crypto.createDecipheriv('aes-256-cbc', encKey(), Buffer.from(ivHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8')
}

// ─── OAuth2 client factory ────────────────────────────────────────────────────

function makeOAuth2(redirectUri?: string) {
  return new google.auth.OAuth2(
    env.GA4_CLIENT_ID,
    env.GA4_CLIENT_SECRET,
    redirectUri ?? env.GA4_REDIRECT_URI,
  )
}

// ─── Auth URL ─────────────────────────────────────────────────────────────────

export function getAuthUrl(clientId: string): string {
  if (!env.GA4_CLIENT_ID || !env.GA4_CLIENT_SECRET) {
    throw new Error('GA4_CLIENT_ID e GA4_CLIENT_SECRET não configurados no .env')
  }
  const oauth2 = makeOAuth2()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/webmasters.readonly',
    ],
    state: clientId,
  })
}

// ─── OAuth2 callback ──────────────────────────────────────────────────────────

export async function handleCallback(code: string, clientId: string): Promise<void> {
  const oauth2 = makeOAuth2()
  const { tokens } = await oauth2.getToken(code)

  await prisma.client.update({
    where: { id: clientId },
    data: {
      ga4AccessToken:    tokens.access_token  ? encryptToken(tokens.access_token)  : undefined,
      ga4RefreshToken:   tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined,
      ga4TokenExpiresAt: tokens.expiry_date   ? new Date(tokens.expiry_date)       : undefined,
    },
  })
  logger.info({ clientId }, 'GA4: tokens salvos com sucesso')
}

// ─── Authenticated OAuth2 client for a given client ──────────────────────────

async function getClientAuth(clientId: string) {
  const rec = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      ga4AccessToken: true, ga4RefreshToken: true,
      ga4TokenExpiresAt: true, ga4PropertyId: true, searchConsoleUrl: true,
    },
  })

  if (!rec?.ga4AccessToken || !rec.ga4RefreshToken) {
    throw new Error('GA4 não conectado para este cliente')
  }

  const oauth2 = makeOAuth2()
  oauth2.setCredentials({
    access_token:  decryptToken(rec.ga4AccessToken),
    refresh_token: decryptToken(rec.ga4RefreshToken),
    expiry_date:   rec.ga4TokenExpiresAt?.getTime(),
  })

  // Persiste tokens renovados automaticamente
  oauth2.on('tokens', (newTokens) => {
    if (newTokens.access_token) {
      prisma.client.update({
        where: { id: clientId },
        data: {
          ga4AccessToken:    encryptToken(newTokens.access_token),
          ga4TokenExpiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : undefined,
        },
      }).catch((err) => logger.warn({ err }, 'GA4: falha ao persistir token renovado'))
    }
  })

  return { oauth2, propertyId: rec.ga4PropertyId, searchConsoleUrl: rec.searchConsoleUrl }
}

// ─── GA4 Data API ─────────────────────────────────────────────────────────────

export interface Ga4Metrics {
  sessions: number
  activeUsers: number
  bounceRate: number
  newUsers: number
  vs_previous: {
    sessions: number; activeUsers: number; bounceRate: number; newUsers: number
  }
}

export async function getMetrics(clientId: string, startDate: string, endDate: string): Promise<Ga4Metrics> {
  const { oauth2, propertyId } = await getClientAuth(clientId)
  if (!propertyId) throw new Error('GA4 Property ID não configurado — defina-o no perfil do cliente')

  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth: oauth2 })

  // Período anterior com mesma duração
  const start = new Date(startDate)
  const end   = new Date(endDate)
  const dur   = end.getTime() - start.getTime()
  const prevEnd   = new Date(start.getTime() - 86_400_000)
  const prevStart = new Date(prevEnd.getTime() - dur)

  const metricNames = ['sessions', 'activeUsers', 'bounceRate', 'newUsers']
  const metrics = metricNames.map(name => ({ name }))

  const [cur, prev] = await Promise.all([
    analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: { metrics, dateRanges: [{ startDate, endDate }] },
    }),
    analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        metrics,
        dateRanges: [{
          startDate: prevStart.toISOString().slice(0, 10),
          endDate:   prevEnd.toISOString().slice(0, 10),
        }],
      },
    }),
  ])

  const parse = (res: typeof cur) => {
    const vals = res.data.rows?.[0]?.metricValues ?? []
    return {
      sessions:    parseInt(vals[0]?.value ?? '0'),
      activeUsers: parseInt(vals[1]?.value ?? '0'),
      bounceRate:  parseFloat(vals[2]?.value ?? '0') * 100,
      newUsers:    parseInt(vals[3]?.value ?? '0'),
    }
  }

  const current  = parse(cur)
  const previous = parse(prev)

  return { ...current, vs_previous: previous }
}

// ─── Search Console API ───────────────────────────────────────────────────────

export interface SearchConsoleMetrics {
  impressions: number
  clicks: number
  ctr: number
  position: number
}

export async function getSearchConsoleMetrics(
  clientId: string,
  startDate: string,
  endDate: string,
): Promise<SearchConsoleMetrics> {
  const { oauth2, searchConsoleUrl } = await getClientAuth(clientId)
  if (!searchConsoleUrl) throw new Error('Search Console URL não configurada para este cliente')

  const webmasters = google.webmasters({ version: 'v3', auth: oauth2 })

  const res = await webmasters.searchanalytics.query({
    siteUrl: searchConsoleUrl,
    requestBody: { startDate, endDate, dimensions: [] },
  })

  const row = res.data.rows?.[0]
  return {
    impressions: Math.round(row?.impressions ?? 0),
    clicks:      Math.round(row?.clicks ?? 0),
    ctr:         parseFloat(((row?.ctr ?? 0) * 100).toFixed(2)),
    position:    parseFloat((row?.position ?? 0).toFixed(1)),
  }
}

// ─── Desconectar ──────────────────────────────────────────────────────────────

export async function disconnect(clientId: string): Promise<void> {
  await prisma.client.update({
    where: { id: clientId },
    data: {
      ga4AccessToken:    null,
      ga4RefreshToken:   null,
      ga4TokenExpiresAt: null,
      ga4PropertyId:     null,
    },
  })
  logger.info({ clientId }, 'GA4: desconectado')
}
