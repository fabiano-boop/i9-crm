import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { prisma } from '../config/database.js'
import { logger } from '../utils/logger.js'

export async function generateSecret(userId: string, userEmail: string): Promise<{ qrCode: string; secret: string }> {
  const secret = speakeasy.generateSecret({
    name: `i9 CRM:${userEmail}`,
    issuer: 'i9 CRM',
    length: 20,
  })

  await prisma.twoFactorSecret.upsert({
    where: { userId },
    create: { userId, secret: secret.base32, verified: false },
    update: { secret: secret.base32, verified: false },
  })

  const qrCode = await QRCode.toDataURL(secret.otpauth_url!)
  logger.info({ userId }, '2FA secret gerado')
  return { qrCode, secret: secret.base32 }
}

export async function verifyToken(userId: string, token: string): Promise<boolean> {
  const record = await prisma.twoFactorSecret.findUnique({ where: { userId } })
  if (!record) return false

  const valid = speakeasy.totp.verify({
    secret: record.secret,
    encoding: 'base32',
    token,
    window: 1,
  })

  if (valid && !record.verified) {
    await prisma.twoFactorSecret.update({ where: { userId }, data: { verified: true } })
    logger.info({ userId }, '2FA ativado com sucesso')
  }

  return valid
}

export async function isEnabled(userId: string): Promise<boolean> {
  try {
    const record = await prisma.twoFactorSecret.findUnique({ where: { userId } })
    return record?.verified === true
  } catch (err) {
    // Se a tabela ainda não foi migrada em produção, trata como 2FA desativado
    logger.warn({ userId, err }, '2FA isEnabled falhou — tabela ausente ou erro de DB; assumindo desativado')
    return false
  }
}

export async function disable(userId: string): Promise<void> {
  await prisma.twoFactorSecret.deleteMany({ where: { userId } })
  logger.info({ userId }, '2FA desativado')
}
