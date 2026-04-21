"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const database_js_1 = require("../config/database.js");
const backupService = __importStar(require("../services/backup.service.js"));
const router = (0, express_1.Router)();
// GET /api/admin/audit-log
router.get('/audit-log', auth_js_1.requireAuth, auth_js_1.requireAdmin, (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { userId, action, entity, startDate, endDate, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const where = {};
    if (userId)
        where.userId = userId;
    if (action)
        where.action = action;
    if (entity)
        where.entity = entity;
    if (startDate || endDate) {
        where.createdAt = {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
        };
    }
    const [total, logs] = await Promise.all([
        database_js_1.prisma.auditLog.count({ where }),
        database_js_1.prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
        }),
    ]);
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
    });
}));
// POST /api/admin/backup/trigger
router.post('/backup/trigger', auth_js_1.requireAuth, auth_js_1.requireAdmin, (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const log = await backupService.runBackup(req.user.sub);
    res.json(log);
}));
// GET /api/admin/backup/history
router.get('/backup/history', auth_js_1.requireAuth, auth_js_1.requireAdmin, (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const page = Math.max(1, parseInt(req.query['page'] ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query['limit'] ?? '20', 10)));
    const { data, total } = await backupService.listBackups(page, limit);
    res.json({
        data,
        meta: {
            total, page, limit,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
        },
    });
}));
exports.default = router;
//# sourceMappingURL=admin.js.map