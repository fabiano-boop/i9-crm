import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../config/database.js'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import type { JwtPayload } from '../middleware/auth.js'
import * as twoFactorService from '../services/twoFactor.service.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const tokenSchema = z.object({
  token: z.string().length(6),
})

function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions)
}

function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions)
}

function signTempToken(userId: string, email: string, role: string): string {
  return jwt.sign({ sub: userId, email, role, step: '2fa' }, env.JWT_SECRET, { expiresIn: '5m' })
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = loginSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: result.error.flatten() })
    return
  }

  const { email, password } = result.data

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    res.status(401).json({ error: 'Email ou senha incorretos', code: 'INVALID_CREDENTIALS' })
    return
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Email ou senha incorretos', code: 'INVALID_CREDENTIALS' })
    return
  }

  const twoFaEnabled = await twoFactorService.isEnabled(user.id)
  if (twoFaEnabled) {
    const tempToken = signTempToken(user.id, user.email, user.role)
    logger.info({ userId: user.id }, 'Login parcial — aguardando 2FA')
    res.json({ requiresTwoFactor: true, tempToken })
    return
  }

  const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)

  logger.info({ userId: user.id, email: user.email }, 'Login realizado')
  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  })
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken?: string }
  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken obrigatório', code: 'MISSING_TOKEN' })
    return
  }

  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtPayload
    const newPayload: JwtPayload = { sub: payload.sub, email: payload.email, role: payload.role }
    const accessToken = signAccessToken(newPayload)
    const newRefreshToken = signRefreshToken(newPayload)
    res.json({ accessToken, refreshToken: newRefreshToken })
  } catch {
    res.status(401).json({ error: 'Refresh token inválido ou expirado', code: 'INVALID_REFRESH_TOKEN' })
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.json({ message: 'Logout realizado com sucesso' })
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado', code: 'NOT_FOUND' })
    return
  }

  res.json(user)
}

// ── 2FA endpoints ──────────────────────────────────────────────

export async function setup2FA(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado', code: 'NOT_FOUND' })
    return
  }

  const { qrCode, secret } = await twoFactorService.generateSecret(userId, user.email)
  res.json({ qrCode, secret })
}

export async function verify2FA(req: Request, res: Response): Promise<void> {
  const result = tokenSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Token inválido', code: 'VALIDATION_ERROR' })
    return
  }

  const userId = req.user!.sub
  const valid = await twoFactorService.verifyToken(userId, result.data.token)
  if (!valid) {
    res.status(400).json({ error: 'Código TOTP inválido', code: 'INVALID_TOTP' })
    return
  }

  res.json({ message: '2FA ativado com sucesso', enabled: true })
}

export async function validate2FA(req: Request, res: Response): Promise<void> {
  const { tempToken, token } = req.body as { tempToken?: string; token?: string }

  if (!tempToken || !token) {
    res.status(400).json({ error: 'tempToken e token são obrigatórios', code: 'MISSING_FIELDS' })
    return
  }

  let decoded: JwtPayload & { step?: string }
  try {
    decoded = jwt.verify(tempToken, env.JWT_SECRET) as JwtPayload & { step?: string }
  } catch {
    res.status(401).json({ error: 'tempToken inválido ou expirado', code: 'INVALID_TEMP_TOKEN' })
    return
  }

  if (decoded.step !== '2fa') {
    res.status(401).json({ error: 'Token não é um tempToken de 2FA', code: 'INVALID_TEMP_TOKEN' })
    return
  }

  const valid = await twoFactorService.verifyToken(decoded.sub, token)
  if (!valid) {
    res.status(400).json({ error: 'Código TOTP inválido', code: 'INVALID_TOTP' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, name: true, email: true, role: true },
  })

  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado', code: 'NOT_FOUND' })
    return
  }

  const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)

  logger.info({ userId: user.id }, 'Login com 2FA concluído')
  res.json({ accessToken, refreshToken, user })
}

export async function disable2FA(req: Request, res: Response): Promise<void> {
  await twoFactorService.disable(req.user!.sub)
  res.json({ message: '2FA desativado com sucesso', enabled: false })
}

export async function get2FAStatus(req: Request, res: Response): Promise<void> {
  const enabled = await twoFactorService.isEnabled(req.user!.sub)
  res.json({ enabled })
}
