/**
 * Ponto central de inicializacao de todos os workers e agendamentos de jobs.
 * Importado uma unica vez em server.ts.
 *
 * Todos os registros passam por safeSchedule() - se o Redis estiver
 * indisponivel ou a funcao lancar erro, apenas loga warning e segue.
 * Isso garante que uma falha em um job (ex: Redis caiu) nao derrube os outros.
 */

import { logger } from '../utils/logger.js'
import { scheduleDailySync, startSheetsWorker } from './sheetsSync.job.js'
import { scheduleBackupJob, startBackupWorker } from './backup.job.js'
import { scheduleCadenceJob, startCadenceWorker } from './cadence.job.js'
import { scheduleAlertJobs, startAlertWorkers } from './alerts.job.js'
import { scheduleClientReportJobs, startClientReportWorkers } from './clientReport.job.js'
import { scheduleInvoiceJobs, startInvoiceWorkers } from './invoice.job.js'

async function safeSchedule(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn()
    logger.info({ job: name }, 'Job "' + name + '" registrado com sucesso')
  } catch (err) {
    logger.warn({ err, job: name }, 'Falha ao registrar job "' + name + '"')
  }
}

export async function startAllWorkers(): Promise<void> {
  await Promise.allSettled([
    safeSchedule('sheets-worker',        () => startSheetsWorker()),
    safeSchedule('backup-worker',        () => startBackupWorker()),
    safeSchedule('cadence-worker',       () => startCadenceWorker()),
    safeSchedule('alert-workers',        () => startAlertWorkers()),
    safeSchedule('client-report-workers',() => startClientReportWorkers()),
    safeSchedule('invoice-workers',      () => startInvoiceWorkers()),  // SPRINT 2
  ])
  logger.info('Inicializacao de workers concluida')
}

export async function scheduleAllJobs(): Promise<void> {
  await Promise.allSettled([
    safeSchedule('daily-sync',        () => scheduleDailySync()),
    safeSchedule('backup-job',        () => scheduleBackupJob()),
    safeSchedule('cadence-job',       () => scheduleCadenceJob()),
    safeSchedule('alert-jobs',        () => scheduleAlertJobs()),
    safeSchedule('client-report-jobs',() => scheduleClientReportJobs()),
    safeSchedule('invoice-jobs',      () => scheduleInvoiceJobs()),     // SPRINT 2
  ])
  logger.info('Agendamento de jobs concluido')
}
