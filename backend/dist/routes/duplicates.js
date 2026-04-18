"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const duplicate_service_js_1 = require("../services/duplicate.service.js");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
router.use(auth_js_1.requireAuth);
// GET /api/leads/duplicates
router.get('/', async (_req, res) => {
    const groups = await (0, duplicate_service_js_1.findDuplicates)();
    res.json({ groups, total: groups.length });
});
// POST /api/leads/duplicates/merge
router.post('/merge', async (req, res) => {
    const schema = zod_1.z.object({
        keepId: zod_1.z.string().cuid(),
        mergeIds: zod_1.z.array(zod_1.z.string().cuid()).min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'keepId e mergeIds[] são obrigatórios', details: parsed.error.flatten() });
        return;
    }
    const { keepId, mergeIds } = parsed.data;
    if (mergeIds.includes(keepId)) {
        res.status(400).json({ error: 'keepId não pode estar em mergeIds' });
        return;
    }
    try {
        const lead = await (0, duplicate_service_js_1.mergeLead)(keepId, mergeIds);
        res.json({ lead, merged: mergeIds.length });
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao realizar merge' });
    }
});
exports.default = router;
//# sourceMappingURL=duplicates.js.map