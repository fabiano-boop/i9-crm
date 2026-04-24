/**
 * invoice.service.ts — Sprint 2
 *
 * Responsável por:
 *   1. Criar fatura avulsa ao converter lead em cliente (auto_conversion)
 *   2. Gerar faturas recorrentes mensais para clientes ativos (auto_recurring)
 *   3. Marcar faturas vencidas (PENDING → OVERDUE)
 */

import { prisma } from '../config/database.js'
import { logger } from '../utils/logger.js'

// ─── Tipos internos ───────────────────────────────────────────────────────────

export interface InvoiceCreateInput {
  clientId:       string
  description:    string
  amount:         number
  dueDate:        Date
  origin:         'manual' | 'auto_recurring' | 'auto_conversion'
  referenceMonth?: string  // YYYY-MM
}

// ─── Criar fatura individual ──────────────────────────────────────────────────

export async function createInvoice(data: InvoiceCreateInput) {
  const invoice = await prisma.invoice.create({
    data: {
      clientId:       data.clientId,
      description:    data.description,
      amount:         data.amount,
      dueDate:        data.dueDate,
      status:         'PENDING',
      origin:         data.origin,
      referenceMonth: data.referenceMonth ?? null,
    },
  })
  logger.info({ invoiceId: invoice.id, clientId: data.clientId, origin: data.origin }, 'Fatura criada')
  return invoice
}

// ─── Fatura de conversão (lead → cliente) ────────────────────────────────────

export async function createConversionInvoice(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client || !client.monthlyValue) return

  // Vencimento: dia recurringBillingDay do próximo mês
  const billingDay = client.recurringBillingDay ?? 5
  const dueDate    = nextBillingDate(billingDay)
  const refMonth   = formatYearMonth(dueDate)

  // Evita duplicata
  const exists = await prisma.invoice.findFirst({
    where: { clientId, referenceMonth: refMonth, origin: 'auto_conversion' },
  })
  if (exists) return

  await createInvoice({
    clientId,
    description:    `Primeira mensalidade — ${client.businessName} (${formatMonthLabel(dueDate)})`,
    amount:         client.monthlyValue,
    dueDate,
    origin:         'auto_conversion',
    referenceMonth: refMonth,
  })
}

// ─── Geração mensal automática ────────────────────────────────────────────────

export async function generateMonthlyInvoices(): Promise<{ generated: number; skipped: number; errors: number }> {
  const today      = new Date()
  const todayDay   = today.getDate()
  const refMonth   = formatYearMonth(today)

  // Clientes ativos cujo dia de cobrança é hoje
  const clients = await prisma.client.findMany({
    where: {
      status:             'active',
      monthlyValue:       { gt: 0 },
      recurringBillingDay: todayDay,
    },
  })

  let generated = 0
  let skipped   = 0
  let errors    = 0

  for (const client of clients) {
    try {
      // Evita duplicata no mesmo mês
      const exists = await prisma.invoice.findFirst({
        where: { clientId: client.id, referenceMonth: refMonth, origin: 'auto_recurring' },
      })
      if (exists) { skipped++; continue }

      const dueDate = nextBillingDate(client.recurringBillingDay ?? 5)

      await createInvoice({
        clientId:       client.id,
        description:    `Mensalidade ${formatMonthLabel(today)} — ${client.businessName}`,
        amount:         client.monthlyValue!,
        dueDate,
        origin:         'auto_recurring',
        referenceMonth: refMonth,
      })
      generated++
    } catch (err) {
      errors++
      logger.error({ err, clientId: client.id }, 'Erro ao gerar fatura recorrente')
    }
  }

  logger.info({ generated, skipped, errors }, 'generateMonthlyInvoices concluído')
  return { generated, skipped, errors }
}

// ─── Marcar faturas vencidas ──────────────────────────────────────────────────

export async function markOverdueInvoices(): Promise<number> {
  const now = new Date()

  const result = await prisma.invoice.updateMany({
    where: {
      status:  'PENDING',
      dueDate: { lt: now },
    },
    data: { status: 'OVERDUE' },
  })

  if (result.count > 0) {
    logger.info({ count: result.count }, 'Faturas marcadas como OVERDUE')
  }
  return result.count
}

// ─── Buscar faturas vencidas para alertas ─────────────────────────────────────

export async function getOverdueInvoices() {
  return prisma.invoice.findMany({
    where:   { status: 'OVERDUE' },
    include: { client: { select: { businessName: true, whatsapp: true } } },
    orderBy: { dueDate: 'asc' },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextBillingDate(day: number): Date {
  const now   = new Date()
  const year  = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
  const month = (now.getMonth() + 1) % 12  // próximo mês
  const safeDay = Math.min(day, 28)         // evita dia inválido em fevereiro
  return new Date(year, month, safeDay, 12, 0, 0)
}

function formatYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
