"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const database_js_1 = require("../config/database.js");
const pagination_js_1 = require("../utils/pagination.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.requireAuth);
// GET /api/alerts — lista alertas com filtros
router.get('/', async (req, res) => {
    const { isRead, isDismissed, type } = req.query;
    const { page, limit } = (0, pagination_js_1.getPaginationParams)(req.query);
    const where = {
        ...(isRead !== undefined && { isRead: isRead === 'true' }),
        ...(isDismissed !== undefined && { isDismissed: isDismissed === 'true' }),
        ...(type && { type }),
    };
    const skip = (page - 1) * limit;
    const [total, alerts] = await Promise.all([
        database_js_1.prisma.opportunityAlert.count({ where }),
        database_js_1.prisma.opportunityAlert.findMany({
            where,
            orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
            skip,
            take: limit,
            include: {
                lead: { select: { id: true, businessName: true, classification: true, whatsapp: true } },
            },
        }),
    ]);
    res.json((0, pagination_js_1.buildPaginatedResult)(alerts, total, { page, limit }));
});
// GET /api/alerts/unread-count — contagem de não lidos
router.get('/unread-count', async (_req, res) => {
    const count = await database_js_1.prisma.opportunityAlert.count({
        where: { isRead: false, isDismissed: false },
    });
    res.json({ count });
});
// PUT /api/alerts/:id/read — marcar como lido
router.put('/:id/read', async (req, res) => {
    const id = req.params['id'];
    const alert = await database_js_1.prisma.opportunityAlert.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
    });
    res.json(alert);
});
// PUT /api/alerts/:id/dismiss — dispensar alerta
router.put('/:id/dismiss', async (req, res) => {
    const id = req.params['id'];
    const alert = await database_js_1.prisma.opportunityAlert.update({
        where: { id },
        data: { isDismissed: true },
    });
    res.json(alert);
});
exports.default = router;
//# sourceMappingURL=alerts.js.map