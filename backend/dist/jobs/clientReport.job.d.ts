/**
 * Jobs de relatório semanal de clientes.
 *
 * Queue: "report-queue"
 *   - generate-weekly-reports  → cron sex 18h (bulk)
 *   - send-weekly-reports      → cron sab 09h (bulk)
 *   - generate-report-manual   → disparado via endpoint com prioridade máxima
 *
 * Configurações:
 *   - concurrency: 2  (Puppeteer é CPU/memória intensivo)
 *   - limiter: max 5 jobs/min
 *   - retry: 3 tentativas com backoff fixo de 1h
 */
import { Queue } from 'bullmq';
export declare function getReportQueue(): Queue;
export declare function enqueueManualReport(clientId: string, weekStart: Date): Promise<string>;
export declare function enqueueSendReport(reportId: string, channels?: ('email' | 'whatsapp')[]): Promise<void>;
export declare function scheduleClientReportJobs(): Promise<void>;
export declare function startClientReportWorkers(): Promise<void>;
//# sourceMappingURL=clientReport.job.d.ts.map