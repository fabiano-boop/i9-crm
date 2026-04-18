"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTrackingUrl = createTrackingUrl;
exports.verifyTrackingHash = verifyTrackingHash;
const crypto_1 = __importDefault(require("crypto"));
const env_js_1 = require("../config/env.js");
// Gera URL de tracking rastreada para links em campanhas
function createTrackingUrl(campaignLeadId, originalUrl) {
    const hash = crypto_1.default
        .createHmac('sha256', env_js_1.env.TRACKING_SECRET)
        .update(`${campaignLeadId}:${originalUrl}`)
        .digest('hex')
        .slice(0, 16);
    const encoded = Buffer.from(originalUrl).toString('base64url');
    return `${env_js_1.env.TRACKING_BASE_URL}/track/click/${campaignLeadId}/${hash}?u=${encoded}`;
}
// Verifica se o hash é válido (proteção contra falsificação)
function verifyTrackingHash(campaignLeadId, originalUrl, hash) {
    const expected = crypto_1.default
        .createHmac('sha256', env_js_1.env.TRACKING_SECRET)
        .update(`${campaignLeadId}:${originalUrl}`)
        .digest('hex')
        .slice(0, 16);
    return crypto_1.default.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
}
//# sourceMappingURL=tracking.service.js.map