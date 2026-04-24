# CLAUDE.md — i9 CRM · Sprint 3: Crescimento
# Semanas 5–6 · 6 entregas · Requer Sprints 1 e 2 concluídos

## REGRA CRÍTICA
Mantenha INTEGRALMENTE a estrutura de código e design existente.
Nunca reescrever do zero, nunca mudar design — apenas adicionar/corrigir
dentro do padrão já estabelecido.

## CONTEXTO
Sprint 1 corrigiu a base (conversão, CPL, custo interno, APIs de anúncios).
Sprint 2 automatizou (faturas automáticas, recorrência, agendamento de relatório, Maya nas Integrações).
Sprint 3 escala o produto: relatório no WhatsApp, comparativos, NRR, metas, histórico e GA4.

## PRÉ-REQUISITOS
- Sprints 1 e 2 concluídos e em produção
- Whapi (Maya) funcionando e testado
- Google Ads + Meta Ads integrados (Sprint 1)
- Relatório PDF gerado e enviado via email (Sprint 2)
- GA4: projeto Google Cloud com Analytics Data API e Search Console API habilitadas
- OAuth2 credentials para GA4 (pode reusar o mesmo projeto do Calendar se já existir)

## NOVAS VARIÁVEIS NO .ENV.EXAMPLE
GA4_CLIENT_ID=               # mesmo projeto OAuth do Google Calendar
GA4_CLIENT_SECRET=
GA4_REDIRECT_URI=https://i9-crm-production.up.railway.app/api/integrations/ga4/callback
SEARCH_CONSOLE_REDIRECT_URI=https://i9-crm-production.up.railway.app/api/integrations/search-console/callback

## ORDEM DE IMPLEMENTAÇÃO
Execute exatamente nesta ordem. Confirme "ok, próximo" após cada etapa.

---

## ETAPA 3.1 — Relatório via WhatsApp (Maya) (2–3 dias)

### Objetivo:
Ao disparar o relatório mensal (agendado ou manual), além do PDF por email,
o Maya envia o documento + resumo em texto pelo WhatsApp do cliente.

### Backend — alterar reportService.ts (NÃO reescrever, apenas adicionar):
Após o bloco de envio por email (Resend), adicionar:

```typescript
// Envio via WhatsApp (Maya)
if (client.whatsappPhone) {
  const summary = buildReportSummary(reportData);
  // 1. Enviar mensagem de texto com resumo executivo
  await whapiService.sendMessage(client.whatsappPhone, summary);
  // 2. Enviar o PDF como documento
  await whapiService.sendDocument(client.whatsappPhone, pdfBuffer, `Relatório_${monthYear}.pdf`);
  // 3. Registrar no histórico
  await interactionService.create({
    clientId: client.id,
    type: 'REPORT_SENT',
    channel: 'WHATSAPP',
    content: `Relatório ${monthYear} enviado via WhatsApp`
  });
}
```

### buildReportSummary(data): string
Gerar texto curto com as 3 métricas mais relevantes:
"📊 *Relatório {{mes}} — {{nomeCliente}}*

✅ Leads gerados: {{leads}} ({{delta_leads}} vs mês anterior)
💰 Investimento: R${{investimento}}
🎯 CPL: R${{cpl}}

Segue o relatório completo em PDF 👆"

### whapiService — adicionar método sendDocument():
```typescript
async sendDocument(phone: string, buffer: Buffer, filename: string): Promise
// POST para Whapi endpoint de envio de documento/arquivo
// Usar multipart/form-data com o buffer do PDF
```

### Verificação:
- Disparar relatório manual e confirmar PDF chegando no WhatsApp
- Interaction registrada no histórico do cliente

---

## ETAPA 3.2 — Comparativo mês anterior em cada métrica (2 dias)

### Backend — novo endpoint:
GET /api/dashboard/comparison
Response:
```json
{
  "current": { "mrr": 4500, "leads": 28, "deals": 5, "revenue": 4500 },
  "previous": { "mrr": 3800, "leads": 20, "deals": 3, "revenue": 3800 },
  "deltas": {
    "mrr": { "value": 700, "percent": 18.4, "direction": "up" },
    "leads": { "value": 8, "percent": 40.0, "direction": "up" },
    "deals": { "value": 2, "percent": 66.7, "direction": "up" },
    "revenue": { "value": 700, "percent": 18.4, "direction": "up" }
  }
}
```

### Frontend — componente MetricDelta:
```tsx
// components/MetricDelta.tsx
// Props: value: number, direction: 'up'|'down'|'neutral', showPercent?: boolean
// Renderiza: ↑18% em verde ou ↓3% em vermelho
// Usar em: todos os cards do Dashboard principal
```

Adicionar MetricDelta embaixo do valor principal em cada card do Dashboard.
NÃO refatorar os cards existentes — apenas adicionar o componente abaixo.

### Relatório PDF — adicionar seção "vs Mês Anterior":
Tabela comparativa simples: Métrica | Mês Anterior | Mês Atual | Variação
Posicionar após o bloco de métricas principais no template do PDF.

---

## ETAPA 3.3 — NRR no módulo Métricas SaaS (1–2 dias)

### Cálculo:
NRR = (MRR_inicio + expansion_MRR - contraction_MRR - churned_MRR) / MRR_inicio * 100

Onde:
- MRR_inicio = MRR total no início do mês
- expansion_MRR = receita adicional de upgrades no mês
- contraction_MRR = receita perdida por downgrades no mês
- churned_MRR = MRR de clientes que cancelaram no mês

### Backend — adicionar ao endpoint de métricas SaaS:
GET /api/metrics/saas (já existe) — adicionar campo nrr ao response:
```typescript
const nrr = mrrStart > 0
  ? ((mrrStart + expansionMrr - contractionMrr - churnedMrr) / mrrStart) * 100
  : 100;
```

### Frontend — adicionar card NRR à página de Métricas SaaS:
- Card com valor em % (ex: 112%)
- Linha de referência visual em 100% (break-even)
- Cor verde se > 100%, amarelo se 90–100%, vermelho se < 90%
- Tooltip: "NRR > 100% significa que sua base cresce mesmo sem novos clientes"
- Posicionar ao lado dos cards MRR / Churn / LTV (NÃO reorganizar layout inteiro)

---

## ETAPA 3.4 — Dashboard: meta mensal + alertas inteligentes (2–3 dias)

### 3.4.1 Meta mensal de MRR:

Schema — adicionar ao model User (ou Settings):
```prisma
monthlyMrrGoal Float @default(0)
```

Endpoint PUT /api/settings/mrr-goal { goal: number }
Endpoint GET /api/settings → incluir monthlyMrrGoal no response

Frontend — Settings: campo "Meta de MRR Mensal (R$)" com save.
Dashboard: barra de progresso abaixo do card MRR:
```
MRR Atual: R$4.500 / Meta: R$5.000 [======    ] 90%
```

### 3.4.2 Alertas inteligentes:

Endpoint GET /api/alerts/smart retorna array de alertas:
```typescript
interface SmartAlert {
  type: 'DEAL_STALLED' | 'OVERDUE_INVOICE' | 'HOT_LEAD_IDLE';
  severity: 'high' | 'medium';
  entityId: string;
  entityName: string;
  message: string;
  daysSince: number;
  actionUrl: string;
}
```

Queries a implementar:
- DEAL_STALLED: deals em andamento sem updatedAt > 7 dias
- OVERDUE_INVOICE: faturas com dueDate < hoje e status != PAID, vencidas > 5 dias
- HOT_LEAD_IDLE: leads com classification=HOT sem Interaction nos últimos 48h

Frontend — painel de alertas no Dashboard:
- Exibir acima ou ao lado dos cards principais
- Cada alerta com ícone, mensagem e botão "Ver" linkando para a entidade
- Badge na topbar com contagem de alertas ativos
- NÃO remover ou reorganizar cards existentes — adicionar o painel

---

## ETAPA 3.5 — Histórico de vendas por serviço (1–2 dias)

### Backend:
Endpoint GET /api/services/:id/sales-history:
```json
{
  "serviceId": "...",
  "serviceName": "Gestão de Tráfego",
  "totalRevenue": 28500,
  "totalContracts": 7,
  "monthlyRevenue": [
    { "month": "2025-10", "revenue": 1500 },
    { "month": "2025-11", "revenue": 2000 },
    ...
  ],
  "contracts": [
    { "clientName": "Salão X", "startDate": "...", "monthlyValue": 497, "status": "ACTIVE" },
    ...
  ]
}
```

Busca: deals com status=WON vinculados ao serviceId + faturas pagas.

### Frontend — aba "Histórico" no ServiceDetail:
- Gráfico de barras: receita por mês (últimos 12 meses)
- Card de resumo: Total faturado | Contratos ativos | Ticket médio
- Tabela: Cliente | Data início | Valor/mês | Status
- Adicionar aba sem remover as abas existentes

---

## ETAPA 3.6 — Google Analytics 4 + Search Console (3–4 dias)

### 3.6.1 Schema — adicionar ao model Client:
```prisma
ga4PropertyId        String?
ga4AccessToken       String?  // criptografado AES-256
ga4RefreshToken      String?  // criptografado AES-256
ga4TokenExpiresAt    DateTime?
searchConsoleUrl     String?  // URL do site (ex: sc-domain:cliente.com.br)
```

### 3.6.2 Serviço backend/src/services/ga4.service.ts:
```typescript
getAuthUrl(clientId): string
  // scope: analytics.readonly + webmasters.readonly
  // state: clientId

handleCallback(code, state): Promise
  // Salvar tokens criptografados no Client

getMetrics(clientId, startDate, endDate): Promise
  // GA4 Data API v1: sessions, activeUsers, bounceRate, newUsers
  // Período: mês atual e mês anterior para comparativo

getSearchConsoleMetrics(clientId, startDate, endDate): Promise
  // Search Console API: impressions, clicks, ctr, position
  // Por período mensal
```

### 3.6.3 Rotas:
```
GET  /api/integrations/ga4/auth/:clientId    → { authUrl }
GET  /api/integrations/ga4/callback          → OAuth2 callback
GET  /api/clients/:id/ga4/metrics            → { sessions, users, bounceRate, vs_previous }
GET  /api/clients/:id/search-console/metrics → { impressions, clicks, ctr, position }
DELETE /api/clients/:id/ga4                  → desconectar
```

### 3.6.4 Relatório PDF — adicionar seção "Orgânico":
Após seção de Google Ads, inserir bloco:
"📊 Resultados Orgânicos (Google)"
- GA4: Sessões | Usuários | Taxa de Rejeição (com delta mês anterior)
- Search Console: Impressões | Cliques | Posição Média

### 3.6.5 Frontend — ClientDetail / Settings:
- Card "Google Analytics 4" com botão conectar/desconectar
- Ao conectar: campo para o GA4 Property ID (ex: 123456789)
- Preview das métricas GA4 no perfil do cliente

---

## VERIFICAÇÃO FINAL
Após cada etapa, confirme:
[ ] TypeScript sem erros (tsc --noEmit)
[ ] Migration rodou sem erros (se houve schema change)
[ ] Variáveis novas documentadas no .env.example
[ ] Funcionalidade testada com dados reais (não mock)
[ ] Deploy no Railway/Vercel funcionando