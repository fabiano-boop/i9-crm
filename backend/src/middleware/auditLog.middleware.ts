import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database.js'
import { logger } from '../utils/logger.js'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const SENSITIVE_FIELDS = new Set(['passwordHash', 'secret', 'password', 'token', 'refreshToken'])

function sanitize(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value
  }
  return result
}

function parseEntityFromUrl(originalUrl: string): { entity: string; entityId: string | null } {
  // Remove query string, split path: /api/leads/abc123 → entity=leads, entityId=abc123
  const parts = originalUrl.split('?')[0].split('/').filter(Boolean)
  const start = parts[0] === 'api' ? 1 : 0
  const entity = parts[start] ?? 'unknown'
  const entityId = parts[start + 1] ?? null
  return { entity, entityId }
}

export function auditLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next()
    return
  }

  const originalJson = res.json.bind(res)

  res.json = function (body: unknown) {
    const result = originalJson(body)

    const { entity, entityId } = parseEntityFromUrl(req.originalUrl)
    const userId = req.user?.sub ?? null
    const userEmail = req.user?.email ?? null

    setImmediate(() => {
      prisma.auditLog
        .create({
          data: {
            userId,
            userEmail,
            action: req.method,
            entity,
            entityId,
            after: sanitize(req.body) as object,
            ip:
              (req.headers['x-forwarded-for'] as string)?.split(',')[0] ??
              req.socket?.remoteAddress ??
              null,
            userAgent: req.headers['user-agent'] ?? null,
          },
        })
        .catch((err) => logger.error({ err }, 'Falha ao salvar AuditLog'))
    })

    return result
  }

  next()
}
