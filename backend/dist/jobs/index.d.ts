/**
 * Ponto central de inicializacao de todos os workers e agendamentos de jobs.
 * Importado uma unica vez em server.ts.
 *
 * Todos os registros passam por safeSchedule() - se o Redis estiver
 * indisponivel ou a funcao lancar erro, apenas loga warning e segue.
 * Isso garante que uma falha em um job (ex: Redis caiu) nao derrube os outros.
 */
export declare function startAllWorkers(): Promise<void>;
export declare function scheduleAllJobs(): Promise<void>;
//# sourceMappingURL=index.d.ts.map