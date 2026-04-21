"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_js_1 = require("../config/env.js");
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token não fornecido', code: 'MISSING_TOKEN' });
        return;
    }
    const token = header.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_js_1.env.JWT_SECRET);
        req.user = payload;
        next();
    }
    catch {
        res.status(401).json({ error: 'Token inválido ou expirado', code: 'INVALID_TOKEN' });
    }
}
function requireAdmin(req, res, next) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Acesso restrito a administradores', code: 'FORBIDDEN' });
        return;
    }
    next();
}
//# sourceMappingURL=auth.js.map