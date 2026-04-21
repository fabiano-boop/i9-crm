"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsEvents = void 0;
exports.initWebSocket = initWebSocket;
exports.broadcast = broadcast;
exports.broadcastToUser = broadcastToUser;
const ws_1 = require("ws");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../utils/logger.js");
let wss = null;
function initWebSocket(server) {
    wss = new ws_1.WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws, req) => {
        // Autentica via query param token
        const url = new URL(req.url || '', `http://localhost`);
        const token = url.searchParams.get('token');
        if (!token) {
            ws.close(4001, 'Unauthorized');
            return;
        }
        try {
            const payload = jsonwebtoken_1.default.verify(token, env_js_1.env.JWT_SECRET);
            ws.userId = payload.sub;
            ws.isAlive = true;
            logger_js_1.logger.info({ userId: ws.userId }, 'WebSocket client conectado');
        }
        catch {
            ws.close(4001, 'Invalid token');
            return;
        }
        ws.on('pong', () => {
            ws.isAlive = true;
        });
        ws.on('close', () => {
            logger_js_1.logger.info({ userId: ws.userId }, 'WebSocket client desconectado');
        });
        ws.on('error', (err) => {
            logger_js_1.logger.error({ err }, 'WebSocket error');
        });
        // Mensagem de boas-vindas
        ws.send(JSON.stringify({ type: 'connected', data: { userId: ws.userId } }));
    });
    // Heartbeat: verifica clientes a cada 30s, encerra os mortos
    const interval = setInterval(() => {
        wss?.clients.forEach((client) => {
            const ws = client;
            if (!ws.isAlive) {
                ws.terminate();
                return;
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30_000);
    wss.on('close', () => clearInterval(interval));
    logger_js_1.logger.info('WebSocket server inicializado no path /ws');
    return wss;
}
function broadcast(message) {
    if (!wss)
        return;
    const payload = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(payload);
        }
    });
}
function broadcastToUser(userId, message) {
    if (!wss)
        return;
    const payload = JSON.stringify(message);
    wss.clients.forEach((client) => {
        const ws = client;
        if (ws.readyState === ws_1.WebSocket.OPEN && ws.userId === userId) {
            ws.send(payload);
        }
    });
}
// Emissores de eventos convenientes para uso interno
exports.wsEvents = {
    hotAlert: (lead, eventType) => {
        broadcast({
            type: 'lead:hot_alert',
            data: { lead, eventType, timestamp: new Date().toISOString() },
        });
    },
    campaignSent: (campaign, stats) => {
        broadcast({
            type: 'campaign:sent',
            data: { campaign, stats, timestamp: new Date().toISOString() },
        });
    },
    leadReplied: (lead, campaignId) => {
        broadcast({
            type: 'lead:replied',
            data: { lead, campaignId, timestamp: new Date().toISOString() },
        });
    },
    syncComplete: (stats) => {
        broadcast({
            type: 'sync:complete',
            data: { stats, timestamp: new Date().toISOString() },
        });
    },
    opportunityAlert: (alert) => {
        broadcast({
            type: 'opportunity:alert',
            data: { alert, timestamp: new Date().toISOString() },
        });
    },
};
//# sourceMappingURL=websocket.service.js.map