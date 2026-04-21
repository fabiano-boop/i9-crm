"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().url(),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    JWT_SECRET: zod_1.z.string().min(16),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16),
    JWT_EXPIRES_IN: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('7d'),
    ANTHROPIC_API_KEY: zod_1.z.string().optional(),
    GOOGLE_SHEETS_ID: zod_1.z.string().optional(),
    GOOGLE_SERVICE_ACCOUNT_JSON: zod_1.z.string().optional(),
    WHAPI_URL: zod_1.z.string().default('https://gate.whapi.cloud'),
    WHAPI_TOKEN: zod_1.z.string().default(''),
    RESEND_API_KEY: zod_1.z.string().optional(),
    EMAIL_FROM: zod_1.z.string().email().default('crm@i9solucoes.com.br'),
    EMAIL_FROM_NAME: zod_1.z.string().default('i9 Soluções Digitais'),
    DIRECT_URL: zod_1.z.string().url().optional(),
    BACKUP_GOOGLE_DRIVE_FOLDER_ID: zod_1.z.string().optional(),
    BACKUP_RETENTION_DAYS: zod_1.z.coerce.number().default(30),
    ADMIN_EMAIL: zod_1.z.string().email().optional(),
    TRACKING_BASE_URL: zod_1.z.string().default('http://localhost:3001'),
    TRACKING_SECRET: zod_1.z.string().min(16).default('tracking-secret-change-me'),
    PORT: zod_1.z.coerce.number().default(3000),
    TRACKING_PORT: zod_1.z.coerce.number().default(3001),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    FRONTEND_URL: zod_1.z.string().default('http://localhost:5173,http://localhost:5174'),
    LOG_LEVEL: zod_1.z.string().default('info'),
    WHATSAPP_AGENT_ENABLED: zod_1.z.coerce.boolean().default(false),
    REPORTS_BASE_URL: zod_1.z.string().default('http://localhost:3000'),
    PUPPETEER_EXECUTABLE_PATH: zod_1.z.string().optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('Variáveis de ambiente inválidas:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.env = parsed.data;
//# sourceMappingURL=env.js.map