-- Sprint 2: Faturas automáticas, recorrência e agendamento de relatório

-- 1. Campos novos no Client
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "recurringBillingDay" INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "reportSendDay"       INTEGER DEFAULT 6;

-- 2. Campo billingType no Service
ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "billingType" TEXT DEFAULT 'RECURRING';

-- 3. Tabela de Faturas
CREATE TABLE IF NOT EXISTS "Invoice" (
  "id"             TEXT         NOT NULL,
  "clientId"       TEXT         NOT NULL,
  "description"    TEXT         NOT NULL,
  "amount"         DOUBLE PRECISION NOT NULL,
  "dueDate"        TIMESTAMP(3) NOT NULL,
  "status"         TEXT         NOT NULL DEFAULT 'PENDING',
  "paidAt"         TIMESTAMP(3),
  "referenceMonth" TEXT,
  "origin"         TEXT         NOT NULL DEFAULT 'manual',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invoice_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Invoice_clientId_status_idx"  ON "Invoice"("clientId", "status");
CREATE INDEX IF NOT EXISTS "Invoice_dueDate_status_idx"   ON "Invoice"("dueDate",  "status");

COMMENT ON TABLE  "Invoice"                    IS 'Faturas dos clientes ativos — geradas manual ou automaticamente';
COMMENT ON COLUMN "Invoice"."origin"           IS 'manual | auto_recurring | auto_conversion';
COMMENT ON COLUMN "Invoice"."referenceMonth"   IS 'Mês de referência no formato YYYY-MM para recorrência';
COMMENT ON COLUMN "Client"."recurringBillingDay" IS 'Dia do mês (1-28) para geração da fatura recorrente';
COMMENT ON COLUMN "Client"."reportSendDay"       IS 'Dia do mês (1-28) para envio automático do relatório';
