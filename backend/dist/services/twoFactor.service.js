"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSecret = generateSecret;
exports.verifyToken = verifyToken;
exports.isEnabled = isEnabled;
exports.disable = disable;
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
const database_js_1 = require("../config/database.js");
const logger_js_1 = require("../utils/logger.js");
async function generateSecret(userId, userEmail) {
    const secret = speakeasy_1.default.generateSecret({
        name: `i9 CRM:${userEmail}`,
        issuer: 'i9 CRM',
        length: 20,
    });
    await database_js_1.prisma.twoFactorSecret.upsert({
        where: { userId },
        create: { userId, secret: secret.base32, verified: false },
        update: { secret: secret.base32, verified: false },
    });
    const qrCode = await qrcode_1.default.toDataURL(secret.otpauth_url);
    logger_js_1.logger.info({ userId }, '2FA secret gerado');
    return { qrCode, secret: secret.base32 };
}
async function verifyToken(userId, token) {
    const record = await database_js_1.prisma.twoFactorSecret.findUnique({ where: { userId } });
    if (!record)
        return false;
    const valid = speakeasy_1.default.totp.verify({
        secret: record.secret,
        encoding: 'base32',
        token,
        window: 1,
    });
    if (valid && !record.verified) {
        await database_js_1.prisma.twoFactorSecret.update({ where: { userId }, data: { verified: true } });
        logger_js_1.logger.info({ userId }, '2FA ativado com sucesso');
    }
    return valid;
}
async function isEnabled(userId) {
    try {
        const record = await database_js_1.prisma.twoFactorSecret.findUnique({ where: { userId } });
        return record?.verified === true;
    }
    catch (err) {
        // Se a tabela ainda não foi migrada em produção, trata como 2FA desativado
        logger_js_1.logger.warn({ userId, err }, '2FA isEnabled falhou — tabela ausente ou erro de DB; assumindo desativado');
        return false;
    }
}
async function disable(userId) {
    await database_js_1.prisma.twoFactorSecret.deleteMany({ where: { userId } });
    logger_js_1.logger.info({ userId }, '2FA desativado');
}
//# sourceMappingURL=twoFactor.service.js.map