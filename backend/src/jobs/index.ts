/**
 * Ponto central de inicialização de todos os workers e agendamentos de jobs.
 * Importado uma única vez em server.ts.
 */

import { logger } from '../utils/logger.js'
import { scheduleDailySync, startSheetsWorker } from './sheetsSync.job.js'
import { scheduleBackupJob, startBackupWorker } from './backup.job.js'
import { scheduleCadenceJob, startCadenceWorker } from './cadence.job.js'
import { scheduleAlertJobs, startAlertWorkers } from './alerts.job.js'
import { scheduleClientReportJobs, startClientReportWorkers } from './clientReport.job.js'

export async function startAllWorkers(): Promise<void> {
  // Workers síncronos (sem Redis check interno)
  startSheetsWorker()
  startBackupWorker()
  startCadenceWorker()

  // Workers assíncronos (Redis-dependent)
  await Promise.allSettled([
    startAlertWorkers().catch((err) => logger.warn({ err }, 'Alert workers falhou ao iniciar')),
    startClientReportWorkers().catch((err) => logger.warn({ err }, 'Client report workers falhou ao iniciar')),
  ])

  logger.info('Todos os workers iniciados')
}

export async function scheduleAllJobs(): Promise<void> {
  // Agendamentos síncronos
  scheduleDailySync()
  scheduleBackupJob()
  scheduleCadenceJob()

  // Agendamentos assíncronos (Redis-dependent)
  await Promise.allSettled([
    scheduleAlertJobs().catch((err) => logger.warn({ err }, 'Alert jobs agendamento falhou')),
    scheduleClientReportJobs().catch((err) => logger.warn({ err }, 'Client report jobs agendamento falhou')),
  ])

  logger.info('Todos os jobs agendados')
}
