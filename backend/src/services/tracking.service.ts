import crypto from 'crypto'
import { env } from '../config/env.js'

// Gera URL de tracking rastreada para links em campanhas
export function createTrackingUrl(campaignLeadId: string, originalUrl: string): string {
  const hash = crypto
    .createHmac('sha256', env.TRACKING_SECRET)
    .update(`${campaignLeadId}:${originalUrl}`)
    .digest('hex')
    .slice(0, 16)
  const encoded = Buffer.from(originalUrl).toString('base64url')
  return `${env.TRACKING_BASE_URL}/track/click/${campaignLeadId}/${hash}?u=${encoded}`
}

// Verifica se o hash é válido (proteção contra falsificação)
export function verifyTrackingHash(campaignLeadId: string, originalUrl: string, hash: string): boolean {
  const expected = crypto
    .createHmac('sha256', env.TRACKING_SECRET)
    .update(`${campaignLeadId}:${originalUrl}`)
    .digest('hex')
    .slice(0, 16)
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected))
}
