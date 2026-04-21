"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogMiddleware = auditLogMiddleware;
const database_js_1 = require("../config/database.js");
const logger_js_1 = require("../utils/logger.js");
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE_FIELDS = new Set(['passwordHash', 'secret', 'password', 'token', 'refreshToken']);
function sanitize(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj))
        return obj;
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value;
    }
    return result;
}
function parseEntityFromUrl(originalUrl) {
    // Remove query string, split path: /api/leads/abc123 → entity=leads, entityId=abc123
    const parts = originalUrl.split('?')[0].split('/').filter(Boolean);
    const start = parts[0] === 'api' ? 1 : 0;
    const entity = parts[start] ?? 'unknown';
    const entityId = parts[start + 1] ?? null;
    return { entity, entityId };
}
function auditLogMiddleware(req, res, next) {
    if (!MUTATING_METHODS.has(req.method)) {
        next();
        return;
    }
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        const result = originalJson(body);
        const { entity, entityId } = parseEntityFromUrl(req.originalUrl);
        const userId = req.user?.sub ?? null;
        const userEmail = req.user?.email ?? null;
        setImmediate(() => {
            database_js_1.prisma.auditLog
                .create({
                data: {
                    userId,
                    userEmail,
                    action: req.method,
                    entity,
                    entityId,
                    after: sanitize(req.body),
                    ip: req.headers['x-forwarded-for']?.split(',')[0] ??
                        req.socket?.remoteAddress ??
                        null,
                    userAgent: req.headers['user-agent'] ?? null,
                },
            })
                .catch((err) => logger_js_1.logger.error({ err }, 'Falha ao salvar AuditLog'));
        });
        return result;
    };
    next();
}
//# sourceMappingURL=auditLog.middleware.js.map