import type { WeeklyReport } from '@prisma/client';
/**
 * Gera o relatório semanal de um cliente, salva no banco e opcionalmente cria o PDF.
 */
export declare function generateReport(clientId: string, weekStart: Date): Promise<WeeklyReport>;
/**
 * Envia o relatório por email e WhatsApp.
 */
export declare function sendReport(reportId: string): Promise<void>;
/**
 * Gera relatórios para todos os clientes ativos com data de início da semana.
 */
export declare function generateWeeklyReportsForAllClients(): Promise<{
    generated: number;
    errors: number;
}>;
/**
 * Envia todos os relatórios gerados na semana atual ainda não enviados.
 */
export declare function sendPendingWeeklyReports(): Promise<{
    sent: number;
    errors: number;
}>;
/**
 * Retorna o HTML do relatório para servir como preview ou gerar PDF sob demanda.
 */
export declare function getReportHtml(reportId: string): Promise<string>;
//# sourceMappingURL=weeklyClientReport.service.d.ts.map