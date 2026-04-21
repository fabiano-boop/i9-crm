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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.refresh = refresh;
exports.logout = logout;
exports.me = me;
exports.setup2FA = setup2FA;
exports.verify2FA = verify2FA;
exports.validate2FA = validate2FA;
exports.disable2FA = disable2FA;
exports.get2FAStatus = get2FAStatus;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const database_js_1 = require("../config/database.js");
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../utils/logger.js");
const twoFactorService = __importStar(require("../services/twoFactor.service.js"));
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const tokenSchema = zod_1.z.object({
    token: zod_1.z.string().length(6),
});
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_js_1.env.JWT_SECRET, { expiresIn: env_js_1.env.JWT_EXPIRES_IN });
}
function signRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, env_js_1.env.JWT_REFRESH_SECRET, { expiresIn: env_js_1.env.JWT_REFRESH_EXPIRES_IN });
}
function signTempToken(userId, email, role) {
    return jsonwebtoken_1.default.sign({ sub: userId, email, role, step: '2fa' }, env_js_1.env.JWT_SECRET, { expiresIn: '5m' });
}
async function login(req, res) {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: result.error.flatten() });
        return;
    }
    const { email, password } = result.data;
    const user = await database_js_1.prisma.user.findUnique({ where: { email } });
    if (!user) {
        res.status(401).json({ error: 'Email ou senha incorretos', code: 'INVALID_CREDENTIALS' });
        return;
    }
    const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!valid) {
        res.status(401).json({ error: 'Email ou senha incorretos', code: 'INVALID_CREDENTIALS' });
        return;
    }
    const twoFaEnabled = await twoFactorService.isEnabled(user.id);
    if (twoFaEnabled) {
        const tempToken = signTempToken(user.id, user.email, user.role);
        logger_js_1.logger.info({ userId: user.id }, 'Login parcial — aguardando 2FA');
        res.json({ requiresTwoFactor: true, tempToken });
        return;
    }
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    logger_js_1.logger.info({ userId: user.id, email: user.email }, 'Login realizado');
    res.json({
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
}
async function refresh(req, res) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(400).json({ error: 'refreshToken obrigatório', code: 'MISSING_TOKEN' });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(refreshToken, env_js_1.env.JWT_REFRESH_SECRET);
        const newPayload = { sub: payload.sub, email: payload.email, role: payload.role };
        const accessToken = signAccessToken(newPayload);
        const newRefreshToken = signRefreshToken(newPayload);
        res.json({ accessToken, refreshToken: newRefreshToken });
    }
    catch {
        res.status(401).json({ error: 'Refresh token inválido ou expirado', code: 'INVALID_REFRESH_TOKEN' });
    }
}
async function logout(_req, res) {
    res.json({ message: 'Logout realizado com sucesso' });
}
async function me(req, res) {
    const user = await database_js_1.prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado', code: 'NOT_FOUND' });
        return;
    }
    res.json(user);
}
// ── 2FA endpoints ──────────────────────────────────────────────
async function setup2FA(req, res) {
    const userId = req.user.sub;
    const user = await database_js_1.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado', code: 'NOT_FOUND' });
        return;
    }
    const { qrCode, secret } = await twoFactorService.generateSecret(userId, user.email);
    res.json({ qrCode, secret });
}
async function verify2FA(req, res) {
    const result = tokenSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: 'Token inválido', code: 'VALIDATION_ERROR' });
        return;
    }
    const userId = req.user.sub;
    const valid = await twoFactorService.verifyToken(userId, result.data.token);
    if (!valid) {
        res.status(400).json({ error: 'Código TOTP inválido', code: 'INVALID_TOTP' });
        return;
    }
    res.json({ message: '2FA ativado com sucesso', enabled: true });
}
async function validate2FA(req, res) {
    const { tempToken, token } = req.body;
    if (!tempToken || !token) {
        res.status(400).json({ error: 'tempToken e token são obrigatórios', code: 'MISSING_FIELDS' });
        return;
    }
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(tempToken, env_js_1.env.JWT_SECRET);
    }
    catch {
        res.status(401).json({ error: 'tempToken inválido ou expirado', code: 'INVALID_TEMP_TOKEN' });
        return;
    }
    if (decoded.step !== '2fa') {
        res.status(401).json({ error: 'Token não é um tempToken de 2FA', code: 'INVALID_TEMP_TOKEN' });
        return;
    }
    const valid = await twoFactorService.verifyToken(decoded.sub, token);
    if (!valid) {
        res.status(400).json({ error: 'Código TOTP inválido', code: 'INVALID_TOTP' });
        return;
    }
    const user = await database_js_1.prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, name: true, email: true, role: true },
    });
    if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado', code: 'NOT_FOUND' });
        return;
    }
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    logger_js_1.logger.info({ userId: user.id }, 'Login com 2FA concluído');
    res.json({ accessToken, refreshToken, user });
}
async function disable2FA(req, res) {
    await twoFactorService.disable(req.user.sub);
    res.json({ message: '2FA desativado com sucesso', enabled: false });
}
async function get2FAStatus(req, res) {
    const enabled = await twoFactorService.isEnabled(req.user.sub);
    res.json({ enabled });
}
//# sourceMappingURL=auth.controller.js.map