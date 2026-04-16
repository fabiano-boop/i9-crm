import { Router, Request, Response } from 'express'
import axios from 'axios'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { env } from '../config/env.js'

const router = Router()
router.use(requireAuth)

/**
 * GET /api/whatsapp/status
 * Retorna o estado de conexão da instância WhatsApp via Evolution API.
 */
router.get('/status', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  if (!env.EVOLUTION_API_URL || !env.EVOLUTION_API_KEY) {
    res.json({
      connected: false,
      instance: env.EVOLUTION_INSTANCE_NAME,
      state: 'NOT_CONFIGURED',
      message: 'Evolution API não configurada',
    })
    return
  }

  try {
    const evolutionHttp = axios.create({
      baseURL: env.EVOLUTION_API_URL,
      headers: { apikey: env.EVOLUTION_API_KEY },
      timeout: 5000,
    })

    const { data } = await evolutionHttp.get(
      `/instance/connectionState/${env.EVOLUTION_INSTANCE_NAME}`
    )

    const state = (data?.instance?.state ?? data?.state ?? 'unknown') as string
    const connected = state === 'open'

    res.json({
      connected,
      instance: env.EVOLUTION_INSTANCE_NAME,
      state,
      evolutionUrl: env.EVOLUTION_API_URL,
    })
  } catch (err: unknown) {
    const e = err as { response?: { status?: number }; message?: string }
    res.json({
      connected: false,
      instance: env.EVOLUTION_INSTANCE_NAME,
      state: 'UNREACHABLE',
      message: e?.response?.status === 404
        ? 'Instância não encontrada na Evolution API'
        : `Evolution API inacessível: ${e?.message ?? 'timeout'}`,
    })
  }
}))

export default router
