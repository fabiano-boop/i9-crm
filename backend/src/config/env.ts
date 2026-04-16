import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_SHEETS_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  EVOLUTION_API_URL: z.string().default('http://localhost:8080'),
  EVOLUTION_API_KEY: z.string().default(''),
  EVOLUTION_INSTANCE_NAME: z.string().default('i9crm'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('crm@i9solucoes.com.br'),
  EMAIL_FROM_NAME: z.string().default('i9 Soluções Digitais'),
  DIRECT_URL: z.string().url().optional(),
  BACKUP_GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  BACKUP_RETENTION_DAYS: z.coerce.number().default(30),
  ADMIN_EMAIL: z.string().email().optional(),
  TRACKING_BASE_URL: z.string().default('http://localhost:3001'),
  TRACKING_SECRET: z.string().min(16).default('tracking-secret-change-me'),
  PORT: z.coerce.number().default(3000),
  TRACKING_PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173,http://localhost:5174'),
  LOG_LEVEL: z.string().default('info'),
  WHATSAPP_AGENT_ENABLED: z.coerce.boolean().default(false),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
