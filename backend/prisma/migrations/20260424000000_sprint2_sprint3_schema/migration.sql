-- Sprint 2 + Sprint 3: campos adicionados via db push, registrados aqui para histórico

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- AlterTable: Client — campos Sprint 2 (faturamento, relatório) e Sprint 3 (GA4, Search Console)
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "internalCost"         DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "recurringBillingDay"  INTEGER          DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "reportSendDay"        INTEGER          DEFAULT 6,
  ADD COLUMN IF NOT EXISTS "serviceId"            TEXT,
  ADD COLUMN IF NOT EXISTS "ga4PropertyId"        TEXT,
  ADD COLUMN IF NOT EXISTS "ga4AccessToken"       TEXT,
  ADD COLUMN IF NOT EXISTS "ga4RefreshToken"      TEXT,
  ADD COLUMN IF NOT EXISTS "ga4TokenExpiresAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "searchConsoleUrl"     TEXT;

-- AlterTable: Service — campo billingType
ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "billingType" TEXT NOT NULL DEFAULT 'RECURRING';

-- AlterTable: User — meta mensal de MRR (Sprint 3.4)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "monthlyMrrGoal" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable: Invoice (Sprint 2)
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id"             TEXT             NOT NULL,
    "clientId"       TEXT             NOT NULL,
    "description"    TEXT             NOT NULL,
    "amount"         DOUBLE PRECISION NOT NULL,
    "dueDate"        TIMESTAMP(3)     NOT NULL,
    "status"         "InvoiceStatus"  NOT NULL DEFAULT 'PENDING',
    "paidAt"         TIMESTAMP(3),
    "referenceMonth" TEXT,
    "origin"         TEXT             NOT NULL DEFAULT 'manual',
    "createdAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)     NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_clientId_status_idx" ON "Invoice"("clientId", "status");
CREATE INDEX IF NOT EXISTS "Invoice_dueDate_status_idx"  ON "Invoice"("dueDate",  "status");
CREATE INDEX IF NOT EXISTS "Client_serviceId_idx"        ON "Client"("serviceId");

-- AddForeignKey (idempotente)
ALTER TABLE "Client"
  ADD CONSTRAINT IF NOT EXISTS "Client_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT IF NOT EXISTS "Invoice_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
