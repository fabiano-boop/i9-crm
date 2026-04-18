"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const auth_js_1 = require("../middleware/auth.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const env_js_1 = require("../config/env.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.requireAuth);
/**
 * GET /api/whatsapp/status
 * Retorna o estado de conexão da instância WhatsApp via Evolution API.
 */
router.get('/status', (0, asyncHandler_js_1.asyncHandler)(async (_req, res) => {
    if (!env_js_1.env.EVOLUTION_API_URL || !env_js_1.env.EVOLUTION_API_KEY) {
        res.json({
            connected: false,
            instance: env_js_1.env.EVOLUTION_INSTANCE_NAME,
            state: 'NOT_CONFIGURED',
            message: 'Evolution API não configurada',
        });
        return;
    }
    try {
        const evolutionHttp = axios_1.default.create({
            baseURL: env_js_1.env.EVOLUTION_API_URL,
            headers: { apikey: env_js_1.env.EVOLUTION_API_KEY },
            timeout: 5000,
        });
        const { data } = await evolutionHttp.get(`/instance/connectionState/${env_js_1.env.EVOLUTION_INSTANCE_NAME}`);
        const state = (data?.instance?.state ?? data?.state ?? 'unknown');
        const connected = state === 'open';
        res.json({
            connected,
            instance: env_js_1.env.EVOLUTION_INSTANCE_NAME,
            state,
            evolutionUrl: env_js_1.env.EVOLUTION_API_URL,
        });
    }
    catch (err) {
        const e = err;
        res.json({
            connected: false,
            instance: env_js_1.env.EVOLUTION_INSTANCE_NAME,
            state: 'UNREACHABLE',
            message: e?.response?.status === 404
                ? 'Instância não encontrada na Evolution API'
                : `Evolution API inacessível: ${e?.message ?? 'timeout'}`,
        });
    }
}));
exports.default = router;
//# sourceMappingURL=whatsapp.js.map