"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDailyLeadScraperJob = startDailyLeadScraperJob;
exports.runScraperNow = runScraperNow;
const node_cron_1 = __importDefault(require("node-cron"));
const leadScraper_service_js_1 = require("../services/leadScraper.service.js");
// Roda todo dia às 11:00 UTC = 08:00 horário de Brasília
function startDailyLeadScraperJob() {
    console.log('[Job] Agendador de leads ativado — executa diariamente às 11:00 UTC (08:00 BRT)');
    node_cron_1.default.schedule('0 11 * * *', async () => {
        console.log('[Job] Disparando scraper de leads...');
        try {
            await (0, leadScraper_service_js_1.runLeadScraper)();
        }
        catch (error) {
            console.error('[Job] Erro no scraper de leads:', error);
        }
    });
}
// Execução imediata para testes (remova em produção)
async function runScraperNow() {
    console.log('[Job] Executando scraper manualmente...');
    await (0, leadScraper_service_js_1.runLeadScraper)();
}
//# sourceMappingURL=dailyLeadScraper.job.js.map