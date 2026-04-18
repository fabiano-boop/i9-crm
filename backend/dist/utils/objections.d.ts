export interface ObjectionEntry {
    key: string;
    title: string;
    triggers: string[];
    strategy: string;
    escalate?: boolean;
}
export declare const OBJECTION_LIBRARY: ObjectionEntry[];
/** Detecta a objeção mais relevante na mensagem recebida */
export declare function detectObjection(message: string): ObjectionEntry | null;
/** Gera o bloco de contexto a injetar no prompt do Claude */
export declare function getObjectionContext(message: string): string;
/** Retorna se a objeção detectada requer escalação imediata */
export declare function requiresImmediateEscalation(message: string): boolean;
//# sourceMappingURL=objections.d.ts.map