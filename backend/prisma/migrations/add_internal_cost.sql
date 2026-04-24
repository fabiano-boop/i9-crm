-- Sprint 1: Adiciona custo interno ao modelo Client
-- Necessário para calcular margem real por cliente no módulo Financeiro

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "internalCost" DOUBLE PRECISION DEFAULT 0;

COMMENT ON COLUMN "Client"."internalCost" IS 'Custo interno mensal estimado (horas + ferramentas) para servir este cliente';
