/**
 * Router de clientes ativos e seus relatórios semanais.
 *
 * CLIENTES
 *   GET    /api/clients                       → listar (filtros: status, niche, neighborhood, package)
 *   GET    /api/clients/metrics/overview      → KPIs gerais (MRR, churn, etc.)
 *   GET    /api/clients/metrics/mrr-projection → projeção de MRR 6 meses
 *   GET    /api/clients/:id                   → detalhes + métricas acumuladas
 *   POST   /api/clients                       → criar (Zod validation)
 *   PUT    /api/clients/:id                   → atualizar campos
 *   PATCH  /api/clients/:id/status            → mudar status + registrar cancelamento
 *   DELETE /api/clients/:id                   → soft delete (marca como cancelled)
 *
 * RELATÓRIOS (nested)
 *   GET    /api/clients/:id/reports           → listar relatórios do cliente
 *   POST   /api/clients/:id/reports/generate  → gerar relatório (enfileira com prio máxima)
 *   GET    /api/clients/:id/reports/:rid/pdf  → PDF ou HTML do relatório
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=clients.d.ts.map