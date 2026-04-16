/**
 * ROTA TEMPORÁRIA DE EMERGÊNCIA — remover após confirmar que o admin está no banco.
 * Protegida por query string secreta para evitar uso não autorizado.
 */
import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../config/database.js'
import { logger } from '../utils/logger.js'

const router = Router()

const SETUP_SECRET = 'i9setup2024'
const ADMIN_EMAIL  = 'admin@i9solucoes.com.br'
const ADMIN_PASS   = 'admin123'

// Diagnóstico: verifica usuário + compara senha direto no banco
router.get('/diagnose', async (req: Request, res: Response): Promise<void> => {
  if (req.query.secret !== SETUP_SECRET) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  try {
    const user = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
    if (!user) {
      res.json({ found: false })
      return
    }
    const passwordMatch = await bcrypt.compare(ADMIN_PASS, user.passwordHash)
    res.json({
      found: true,
      id: user.id,
      email: user.email,
      role: user.role,
      hashPrefix: user.passwordHash.substring(0, 10) + '...',
      passwordMatch,
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

router.get('/create-admin', async (req: Request, res: Response): Promise<void> => {
  if (req.query.secret !== SETUP_SECRET) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASS, 10)

    const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })

    if (existing) {
      await prisma.user.update({
        where: { email: ADMIN_EMAIL },
        data: { passwordHash },
      })
      logger.info({ email: ADMIN_EMAIL }, 'Setup: admin password updated')
      res.json({ success: true, message: 'Admin atualizado com nova senha', id: existing.id })
    } else {
      const user = await prisma.user.create({
        data: {
          id: 'user_admin_01',
          email: ADMIN_EMAIL,
          name: 'Admin i9',
          passwordHash,
          role: 'ADMIN',
        },
      })
      logger.info({ email: ADMIN_EMAIL, id: user.id }, 'Setup: admin criado')
      res.json({ success: true, message: 'Admin criado com sucesso', id: user.id })
    }
  } catch (err) {
    logger.error({ err }, 'Setup: erro ao criar/atualizar admin')
    res.status(500).json({ error: String(err) })
  }
})

// Debug completo: CORS, DB, admin — sem secret para acesso rápido
router.get('/login-debug', async (_req: Request, res: Response): Promise<void> => {
  let dbConnected = false
  let adminExists = false
  let adminHash = ''
  let adminPasswordMatch = false

  try {
    await prisma.$queryRaw`SELECT 1`
    dbConnected = true

    const user = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
    if (user) {
      adminExists = true
      adminHash = user.passwordHash.substring(0, 20)
      adminPasswordMatch = await bcrypt.compare(ADMIN_PASS, user.passwordHash)
    }
  } catch (_err) { /* silencioso */ }

  res.json({
    corsOrigins:         process.env.FRONTEND_URL ?? '(não definido)',
    nodeEnv:             process.env.NODE_ENV,
    dbConnected,
    adminExists,
    adminHash,
    adminPasswordMatch,
  })
})

export default router
