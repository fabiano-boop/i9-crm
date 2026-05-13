# MISSÃO: Corrigir conexão Redis BullMQ com Upstash

## CONTEXTO
- Redis URL configurada no Railway: `rediss://default:...@darling-mastiff-121138.upstash.io:6379`
- Erro nos logs: `Error: Stream isn't writeable and enableOfflineQueue options is false`
- BullMQ workers registram mas falham ao processar jobs
- REGRA CRÍTICA: alteração cirúrgica — não reescrever nada além do necessário

---

## ETAPA 1 — Localizar a configuração do Redis

Leia e mostre os trechos relevantes de:
1. `backend/src/lib/redis.ts` ou onde Redis é configurado
2. `backend/src/lib/queue.ts` ou onde BullMQ é inicializado

Responda:
- Como o cliente Redis é criado? (ioredis, redis, bullmq nativo?)
- O `enableOfflineQueue` está configurado como `false`?
- A URL `rediss://` (com dois ss) está sendo aceita pelo cliente?

---

## ETAPA 2 — Corrigir configuração do Redis para Upstash

O Upstash requer TLS (`rediss://`) e configurações específicas. O cliente deve ser criado assim:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,  // obrigatório para BullMQ
  enableReadyCheck: false,
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
});
```

Mostrar o trecho atual e o trecho corrigido. Aguardar meu "ok" antes de salvar.

---

## ETAPA 3 — Corrigir configuração do BullMQ

O BullMQ precisa receber a instância Redis correta. Verificar se os workers e queues estão usando a instância corrigida:

```typescript
import { Queue, Worker } from 'bullmq';

const queue = new Queue('nome-da-fila', {
  connection: redis,
});

const worker = new Worker('nome-da-fila', async job => {
  // handler
}, {
  connection: redis,
});
```

Se estiver criando conexões separadas, consolidar para usar a mesma instância.

---

## ETAPA 4 — Commit e push

Após minha aprovação:

```bash
git add backend/src/lib/redis.ts
git add backend/src/lib/queue.ts  
git commit -m "fix(redis): configurar Upstash TLS corretamente para BullMQ"
git push origin master
```

Aguardar deploy no Railway (~2 min).

---

## ETAPA 5 — Validação

Após deploy, confirmar nos logs que NÃO aparece mais:
```
Error: Stream isn't writeable
Redis indisponível
```

E que aparece:
```
Redis conectado — filas BullMQ ativas ✅
```
