"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpServer = exports.app = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const env_js_1 = require("./config/env.js");
const logger_js_1 = require("./utils/logger.js");
const database_js_1 = require("./config/database.js");
const index_js_1 = __importDefault(require("./routes/index.js"));
const index_js_2 = require("./jobs/index.js");
const websocket_service_js_1 = require("./services/websocket.service.js");
const app = (0, express_1.default)();
exports.app = app;
app.set('trust proxy', 1);
const httpServer = (0, http_1.createServer)(app);
exports.httpServer = httpServer;
// Health check — antes de qualquer middleware para garantir acesso irrestrito
// (probes do Railway enviam Origin do próprio domínio que não está na allowlist)
const healthHandler = (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env_js_1.env.NODE_ENV });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
// Middlewares globais
app.use((0, helmet_1.default)());
const allowedOrigins = env_js_1.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean);
// Padrão de preview do Vercel para o projeto i9-crm-frontend
const vercelPreviewPattern = /^https:\/\/i9-crm-frontend-[a-z0-9]+-i9-solucoes-digitais\.vercel\.app$/;
app.use((0, cors_1.default)({
    origin: (origin, cb) => {
        // Allow requests with no origin (e.g. mobile apps, curl, Postman)
        if (!origin)
            return cb(null, true);
        if (allowedOrigins.includes(origin))
            return cb(null, true);
        if (vercelPreviewPattern.test(origin))
            return cb(null, true);
        cb(new Error(`CORS: origin not allowed — ${origin}`));
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Rate limiting global (100 req/min por IP)
app.use((0, express_rate_limit_1.default)({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));
// Rotas da API
app.use('/api', index_js_1.default);
// Handler de erro global
app.use((err, _req, res, _next) => {
    logger_js_1.logger.error(err, 'Unhandled error');
    res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
});
// Graceful shutdown
async function shutdown() {
    logger_js_1.logger.info('Encerrando servidor...');
    await database_js_1.prisma.$disconnect();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// Inicializa WebSocket no mesmo servidor HTTP
(0, websocket_service_js_1.initWebSocket)(httpServer);
const PORT = Number(process.env.PORT) || 3000;
httpServer.listen(PORT, () => {
    logger_js_1.logger.info(`i9 CRM backend rodando na porta ${PORT}`);
    logger_js_1.logger.info(`Ambiente: ${env_js_1.env.NODE_ENV}`);
    // Inicia workers e agendamentos (falham silenciosamente sem Redis)
    (0, index_js_2.startAllWorkers)().catch((err) => logger_js_1.logger.warn({ err }, 'startAllWorkers falhou'));
    (0, index_js_2.scheduleAllJobs)().catch((err) => logger_js_1.logger.warn({ err }, 'scheduleAllJobs falhou'));
});
//# sourceMappingURL=server.js.map