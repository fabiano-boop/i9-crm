import cron from 'node-cron';
import { runLeadScraper } from '../services/leadScraper.service.js';

// Roda todo dia às 11:00 UTC = 08:00 horário de Brasília
export function startDailyLeadScraperJob(): void {
  console.log('[Job] Agendador de leads ativado — executa diariamente às 11:00 UTC (08:00 BRT)');

  cron.schedule('0 11 * * *', async () => {
    console.log('[Job] Disparando scraper de leads...');
    try {
      await runLeadScraper();
    } catch (error) {
      console.error('[Job] Erro no scraper de leads:', error);
    }
  });
}

// Execução imediata para testes (remova em produção)
export async function runScraperNow(): Promise<void> {
  console.log('[Job] Executando scraper manualmente...');
  await runLeadScraper();
}
