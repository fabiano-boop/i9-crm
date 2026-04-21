/**
 * Ponto central de inicialização de todos os workers e agendamentos de jobs.
 * Importado uma única vez em server.ts.
 *
 * Todos os registros passam por `safeSchedule()` — se o Redis estiver
 * indisponível ou a função lançar erro, apenas loga warning e segue.
 * Isso garante que uma falha em um job (ex: Redis caiu) não derrube os outros.
 */

import { logger } from '../utils/logger.js'
import { scheduleDailySync, startSheetsWorker } from './sheetsSync.job.js'
import { scheduleBackupJob, startBackupWorker } from './backup.job.js'
import { scheduleCadenceJob, startCadenceWorker } from './cadence.job.js'
import { scheduleAlertJobs, startAlertWorkers } from './alerts.job.js'
import { scheduleClientReportJobs, startClientReportWorkers } from './clientReport.job.js'

/**
 * Executa uma função de agendamento/worker protegendo contra falhas individuais.
 * Se a função lançar erro (ex: Redis indisponível), loga warning estruturado
 * e retorna normalmente — os demais jobs continuam sendo registrados.
 */
async function safeSchedule(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn()
    logger.info({ job: name }, `Job "${name}" registrado com sucesso`)
  } catch (err) {
    logger.warn({ err, job: name }, `Falha ao registrar job "${name}" — seguindo sem ele`)
  }
}

export async function startAllWorkers(): Promise<void> {
  await Promise.allSettled([
    safeSchedule('sheets-worker', () => startSheetsWorker()),
    safeSchedule('backup-worker', () => startBackupWorker()),
    s