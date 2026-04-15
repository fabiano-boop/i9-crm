import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { prisma } from '../config/database.js'
import * as backupService from '../services/backup.service.js'

const router = Router()

// GET /api/admin/audit-log
router.get(
  '/audit-log',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { userId, action, entity, startDate, endDate, page = '1', limit = '50' } =
      req.query as Record<string, string>

    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)))

    const where: Prisma.AuditLogWhereInput = {}
    if (userId) where.userId = userId
    if (action) where.action = action
    if (entity) where.entity = entity
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ])

    res.json({
      data: logs,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    })
  })
)

// POST /api/admin/backup/trigger
router.post(
  '/backup/trigger',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const log = await backupService.runBackup(req.user!.sub)
    res.json(log)
  })
)

// GET /api/admin/backup/history
router.get(
  '/backup/history',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const page  = Math.max(1, parseInt((req.query['page']  as string) ?? '1',  10))
    const limit = Math.min(50, Math.max(1, parseInt((req.query['limit'] as string) ?? '20', 10)))
    const { data, total } = await backupService.listBackups(page, limit)
    res.json({
      data,
      meta: {
        total, page, limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  })
)

export default router
