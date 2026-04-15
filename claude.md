# CLAUDE.md — i9 CRM · Sprint 1: Fundação de Conversão
# Semanas 1–3 · 5 entregas · Execute após o CRM base estar rodando

## CONTEXTO
Você está evoluindo o i9 CRM, já construído conforme o CLAUDE.md principal.
O backend roda em Node.js + Express + Prisma + PostgreSQL + Redis (BullMQ).
O frontend usa React 18 + Vite + Shadcn/ui + Tailwind.
Não recrie o projeto — evolua o código existente.

## REGRAS GERAIS DESTE SPRINT
- Sempre rode `npx prisma migrate dev --name ` após alterar o schema
- Sempre adicione variáveis novas ao .env.example com comentário explicativo
- Mantenha TypeScript strict — nenhum `any` sem justificativa
- Todos os jobs BullMQ devem ter onFailed com log estruturado (Pino)
- Testes mínimos: ao menos um teste de integração por endpoint novo (Jest + Supertest)
- Commits semânticos: feat:, fix:, chore:, test:

## ORDEM DE IMPLEMENTAÇÃO
Execute exatamente nesta ordem. Confirme "ok, próximo" após cada etapa.

---

## ETAPA 1 — 2FA com TOTP + Audit Log (3–4 dias)

### 1.1 Schema Prisma — adicionar ao schema.prisma existente:
```prisma
model TwoFactorSecret {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  secret    String
  verified  Boolean  @default(false)
  createdAt DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  userEmail String?
  action    String
  entity    String
  entityId  String?
  before    Json?
  after     Json?
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([entity, entityId])
  @@index([createdAt])
}
```

### 1.2 Pacotes a instalar:
```bash
cd backend
npm install speakeasy qrcode @types/speakeasy @types/qrcode
```

### 1.3 Criar backend/src/services/twoFactor.service.ts:
- generateSecret(userId): gera secret via speakeasy, salva na tabela TwoFactorSecret, retorna QR code como data URL
- verifyToken(userId, token): valida TOTP com janela de 1 step, marca verified=true
- isEnabled(userId): retorna boolean
- disable(userId): deleta TwoFactorSecret

### 1.4 Criar backend/src/middleware/auditLog.middleware.ts:
- Middleware Express que intercepta POST, PUT, PATCH, DELETE
- Extrai userId do JWT decoded
- Captura req.body (sanitizado — remover passwordHash, secret)
- Após res.json(), salva AuditLog assincronamente (não bloquear resposta)
- Aplica em todas as rotas após autenticação

### 1.5 Rotas a criar em backend/src/routes/auth.routes.ts (adicionar):
```
POST /api/auth/2fa/setup    → retorna { qrCode: string, secret: string }
POST /api/auth/2fa/verify   → body: { token: string } → ativa 2FA
POST /api/auth/2fa/validate → body: { token: string } → valida no login
POST /api/auth/2fa/disable  → desativa 2FA do usuário autenticado
GET  /api/auth/2fa/status   → retorna { enabled: boolean }
```

### 1.6 Alterar fluxo de login em auth.controller.ts:
- Se usuário tem 2FA ativo: login retorna { requiresTwoFactor: true, tempToken: string }
- tempToken é JWT com expiração de 5 min e claim { step: "2fa" }
- POST /api/auth/2fa/validate valida tempToken + TOTP → retorna JWT definitivo

### 1.7 Frontend — criar src/pages/Settings/TwoFactor.tsx:
- Botão "Ativar 2FA" → exibe QR code + campo para digitar primeiro código
- Após verificar: badge "2FA ativo" + botão desativar
- Na tela de login: se requiresTwoFactor, exibir campo de 6 dígitos
- Adicionar seção "2FA" em Settings page

### 1.8 Frontend — criar src/pages/Settings/AuditLog.tsx:
- Tabela com colunas: data/hora, usuário, ação, entidade, IP
- Filtro por usuário, ação e período
- Botão exportar CSV (client-side com Papa Parse)
- Visível apenas para role=ADMIN

### 1.9 Testes:
- test/auth/twoFactor.test.ts: setup → verify → login flow → disable
- test/middleware/auditLog.test.ts: verifica que mutações geram log

---

## ETAPA 2 — Backup Automático Diário (2–3 dias)

### 2.1 Pacotes:
```bash
npm install node-cron googleapis @google-cloud/storage
# pg_dump já disponível se PostgreSQL está instalado
```

### 2.2 Variáveis novas no .env.example:
```
BACKUP_GOOGLE_DRIVE_FOLDER_ID=   # ID da pasta no Drive para backups
BACKUP_RETENTION_DAYS=30         # dias de retenção
GOOGLE_SERVICE_ACCOUNT_JSON=     # mesma do Sheets (reutilizar)
```

### 2.3 Criar backend/src/services/backup.service.ts:
```typescript
// Funções a implementar:
async runBackup(): Promise<{ filename: string, sizeKb: number, driveFileId: string }>
// 1. Executa: pg_dump $DATABASE_URL | gzip > /tmp/i9crm-YYYY-MM-DD-HHmm.sql.gz
// 2. Faz upload para Google Drive via googleapis (stream, não carrega tudo na memória)
// 3. Deleta arquivo local após upload bem-sucedido
// 4. Registra em BackupLog (ver schema abaixo)
// 5. Deleta backups no Drive com mais de BACKUP_RETENTION_DAYS dias

async listBackups(): Promise
async triggerManual(userId: string): Promise
```

### 2.4 Schema adicional:
```prisma
model BackupLog {
  id          String   @id @default(cuid())
  filename    String
  sizeKb      Int
  driveFileId String?
  status      String   @default("success")
  errorMsg    String?
  triggeredBy String   @default("auto")
  createdAt   DateTime @default(now())
}
```

### 2.5 Criar job em backend/src/jobs/backup.job.ts:
- BullMQ com cron "0 2 * * *" (toda madrugada às 02h)
- onFailed: logar erro + enviar email de alerta via Resend para ADMIN_EMAIL
- Adicionar ao worker principal

### 2.6 Rotas (apenas ADMIN):
```
POST /api/admin/backup/trigger   → executa backup manual, retorna BackupLog
GET  /api/admin/backup/history   → lista BackupLog com paginação
```

### 2.7 Frontend — adicionar card em Settings/Admin.tsx:
- Último backup: data + tamanho
- Botão "Executar backup agora"
- Histórico de backups em tabela simples

---

## ETAPA 3 — Cadência Automática de Follow-up (5–6 dias)

### 3.1 Schema:
```prisma
model FollowUpSequence {
  id          String           @id @default(cuid())
  name        String
  description String?
  steps       Json             // FollowUpStep[]
  isActive    Boolean          @default(true)
  createdAt   DateTime         @default(now())
  leadCadences LeadCadence[]
}

// steps JSON shape:
// [{ day: number, channel: "whatsapp"|"email", templateKey: string, message: string }]

model LeadCadence {
  id              String           @id @default(cuid())
  lead            Lead             @relation(fields: [leadId], references: [id])
  leadId          String
  sequence        FollowUpSequence @relation(fields: [sequenceId], references: [id])
  sequenceId      String
  currentStep     Int              @default(0)
  status          String           @default("active") // active | paused | completed | cancelled
  startedAt       DateTime         @default(now())
  nextActionAt    DateTime?
  pausedAt        DateTime?
  pauseReason     String?
  completedAt     DateTime?
  updatedAt       DateTime         @updatedAt

  @@unique([leadId, sequenceId])
}
```

### 3.2 Criar backend/src/services/cadence.service.ts:
```typescript
// Funções:
startCadence(leadId, sequenceId): Promise
// - Valida se lead já está nesta sequência
// - Cria LeadCadence com nextActionAt = now() + step[0].day * 24h

pauseCadence(leadCadenceId, reason): Promise
// - Atualiza status=paused, pausedAt=now(), pauseReason

resumeCadence(leadCadenceId): Promise

cancelCadence(leadCadenceId): Promise

processStep(leadCadenceId): Promise
// - Busca LeadCadence + Lead + próximo step
// - Personaliza mensagem com variáveis do lead (nome, negocio, bairro, angulo)
// - Envia via canal correto (whatsapp ou email service)
// - Cria Interaction no histórico
// - Avança currentStep ou marca completed se último step
// - Define nextActionAt = now() + próximo step.day * 24h
```

### 3.3 Criar job backend/src/jobs/cadence.job.ts:
- Cron "0 * * * *" (a cada hora)
- Busca LeadCadence onde status=active AND nextActionAt <= now()
- Para cada uma: adiciona à fila BullMQ "cadence-queue"
- Worker processa com rate limit: max 30/min
- onFailed: marcar step como erro, tentar novamente em 2h (max 3 tentativas)

### 3.4 Auto-pausa ao receber resposta:
- Sempre que Interaction é criada com direction="IN" E leadId:
  - Buscar LeadCadences ativas do lead
  - Pausar todas com pauseReason="lead_replied"
  - Emitir WebSocket "cadence:paused" para o agente

### 3.5 Sequências padrão a criar no seed:
```typescript
const sequences = [
  {
    name: "Sequência HOT — 5 contatos",
    steps: [
      { day: 1,  channel: "whatsapp", message: "{{angulo}}" },
      { day: 3,  channel: "email",    message: "Email de apresentação i9 com case do nicho {{nicho}}" },
      { day: 7,  channel: "whatsapp", message: "Follow-up: resultado que um cliente similar obteve" },
      { day: 14, channel: "email",    message: "Proposta de diagnóstico gratuito para {{negocio}}" },
      { day: 30, channel: "whatsapp", message: "Última tentativa: oferta especial de entrada" }
    ]
  },
  {
    name: "Sequência WARM — 3 contatos",
    steps: [
      { day: 1,  channel: "whatsapp", message: "{{angulo}}" },
      { day: 7,  channel: "email",    message: "Conteúdo útil para {{nicho}} + convite para conversar" },
      { day: 21, channel: "whatsapp", message: "Check-in simples: ainda faz sentido conversar?" }
    ]
  }
]
```

### 3.6 Rotas:
```
GET    /api/cadences/sequences          → listar sequências disponíveis
POST   /api/cadences/sequences          → criar nova sequência
GET    /api/leads/:id/cadences          → cadências do lead
POST   /api/leads/:id/cadences          → iniciar cadência { sequenceId }
PUT    /api/leads/:id/cadences/:cid/pause
PUT    /api/leads/:id/cadences/:cid/resume
DELETE /api/leads/:id/cadences/:cid     → cancelar
```

### 3.7 Frontend:
- LeadDetail: seção "Cadências ativas" com status de cada step (feito/pendente/falhou)
- Modal "Iniciar cadência": selecionar sequência + prévia dos steps
- Badge no kanban card: "Em cadência" quando tem LeadCadence ativa
- Settings/Cadences.tsx: gerenciar sequências (CRUD)

---

## ETAPA 4 — Alertas de Janela de Oportunidade (3–4 dias)

### 4.1 Schema:
```prisma
model OpportunityAlert {
  id          String   @id @default(cuid())
  lead        Lead     @relation(fields: [leadId], references: [id])
  leadId      String
  type        String   // hot_engagement | cooling_lead | no_contact_week
  title       String
  description String
  urgency     Int      @default(5)
  isRead      Boolean  @default(false)
  isDismissed Boolean  @default(false)
  readAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([isRead, isDismissed, createdAt])
}
```

### 4.2 Criar backend/src/services/opportunityAlert.service.ts:
```typescript
// Detecções a implementar:

checkHotEngagement(leadId): Promise
// - >= 2 TrackingEvents type='open' nas últimas 4h → urgency 9
// - >= 1 TrackingEvent type='click' → urgency 10
// - Criar OpportunityAlert se não criou nas últimas 12h para este lead/tipo

checkCoolingLeads(): Promise
// - Leads classification=HOT sem Interaction nos últimos 5 dias
// - Criar alerta type='cooling_lead', urgency 7

checkNoContactWeek(): Promise
// - Leads classification=HOT ou WARM sem nenhum contato em 7+ dias
// - Criar alerta type='no_contact_week', urgency 6

generateMorningDigest(): Promise
// - Top 5 alertas por urgency desc, createdAt desc
// - Claude gera texto do digest em linguagem natural
// - Envia via Resend para todos os agentes
```

### 4.3 Jobs:
- "alert-check-engagement": cron "0 * * * *" → checkHotEngagement para todos leads com TrackingEvent recente
- "alert-check-cooling": cron "0 9 * * *" → checkCoolingLeads + checkNoContactWeek
- "morning-digest": cron "0 8 * * 1-6" → generateMorningDigest (seg a sáb)

### 4.4 Integração com tracking existente:
- Em tracking.controller.ts, após registrar TrackingEvent type='click':
  → chamar opportunityAlertService.checkHotEngagement(leadId)
  → emitir WebSocket "lead:hot_alert" com dados do lead e alerta

### 4.5 Rotas:
```
GET  /api/alerts              ?isRead, type, page, limit
PUT  /api/alerts/:id/read
PUT  /api/alerts/:id/dismiss
GET  /api/alerts/unread-count → retorna { count: number }
```

### 4.6 Frontend:
- Topbar: badge com unread-count, atualiza via polling a cada 60s ou WebSocket
- Dropdown de alertas (últimos 10) com link para o lead
- Dashboard: widget "Janelas de hoje" — top 5 alertas de urgência alta
- Toast automático ao receber WebSocket "lead:hot_alert"

---

## ETAPA 5 — Detecção e Merge de Duplicatas (3 dias)

### 5.1 Criar backend/src/services/duplicate.service.ts:
```typescript
// Funções:

normalizePhone(phone: string): string
// Remove: +55, espaços, traços, parênteses, código de país
// Ex: "+55 (11) 98765-4321" → "11987654321"

levenshteinDistance(a: string, b: string): number
// Implementar algoritmo ou usar 'fast-levenshtein' npm

similarityScore(a: string, b: string): number
// Retorna 0-1. Threshold para duplicata: >= 0.85

findDuplicates(): Promise
// - Agrupa por telefone normalizado igual → duplicata certa
// - Compara nomes: similaridade >= 0.85 E mesmo bairro → possível duplicata
// - Retorna: [{ leads: Lead[], confidence: 'certain'|'possible' }]

mergeLead(keepId: string, mergeIds: string[]): Promise
// - Transfere: Interactions, CampaignLeads, TrackingEvents, LeadCadences
// - Mescla campos: mantém keepId como base, preenche campos vazios com mergeIds
// - Deleta mergeIds após transferência
// - Registra AuditLog da operação de merge
```

### 5.2 Integração com sync do Sheets:
- Em sheets.service.ts, antes de criar novo lead:
  → checar duplicata por telefone normalizado
  → se encontrar: logar aviso, retornar lead existente (upsert em vez de insert)

### 5.3 Rotas:
```
GET  /api/leads/duplicates         → lista grupos de duplicatas
POST /api/leads/merge              → body: { keepId, mergeIds }
```

### 5.4 Frontend — criar src/pages/Leads/Duplicates.tsx:
- Acessível em /leads/duplicates
- Grupos lado a lado: comparação de campos com diferenças destacadas
- Botão "Manter este" define o keepId
- Checkbox nos outros para selecionar mergeIds
- Confirmação antes de executar o merge
- Link na sidebar com badge de contagem de possíveis duplicatas

---

## DEFINIÇÃO DE "SPRINT 1 CONCLUÍDO"

Antes de marcar o sprint como feito, verificar:

[ ] 2FA funcionando do setup ao login com código TOTP
[ ] Audit log registrando toda mutação com usuário e IP
[ ] Backup rodando às 02h e subindo para Google Drive
[ ] Cadência HOT e WARM funcionando com auto-pausa ao responder
[ ] Alertas sendo gerados ao clicar em link rastreado
[ ] Digest matinal enviado às 08h
[ ] Detecção de duplicatas retornando grupos corretos
[ ] Merge transferindo todas as interações sem perda de dados
[ ] Todos os endpoints com autenticação JWT
[ ] Nenhum `any` solto no TypeScript
[ ] Migrations rodando sem erro em banco limpo

---

## COMANDO DE INÍCIO DO SPRINT 1

Após salvar este arquivo como CLAUDE.md na raiz do i9-crm/:

```bash
claude "Leia o CLAUDE.md. Estamos iniciando o Sprint 1 do i9 CRM. \
Execute a ETAPA 1 completa (2FA + Audit Log): crie o schema Prisma, \
rode a migration, implemente o twoFactor.service.ts, o middleware de \
auditLog e todas as rotas listadas. Me mostre o código antes de salvar \
cada arquivo e aguarde minha confirmação."
```
