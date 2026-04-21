export declare function setAgentEnabled(enabled: boolean): void;
export declare function getAgentEnabled(): boolean;
interface AgentStats {
    totalProcessed: number;
    totalHandoffs: number;
    totalSent: number;
    intentCounts: Record<string, number>;
    stageCounts: Record<string, number>;
    startedAt: string;
}
export declare function getAgentStats(): AgentStats;
export type ConversationStage = 'first_contact' | 'qualifying' | 'presenting' | 'handling_objection' | 'scheduling' | 'human_needed';
export type Intent = 'interested' | 'not_interested' | 'has_objection' | 'wants_price' | 'wants_meeting' | 'already_has' | 'unclear';
export interface AgentResponse {
    message: string;
    stage: ConversationStage;
    intent: Intent;
    shouldHandoff: boolean;
    handoffReason?: string;
    suggestedPackage?: string;
}
export declare function getAgentSessions(): Map<string, ConversationStage>;
export declare function getHandoffQueue(): Map<string, {
    reason: string;
    timestamp: Date;
    suggestedPackage?: string;
    leadName: string;
    businessName: string;
    phone?: string | null;
}>;
export declare function isAgentManaged(leadId: string): boolean;
export declare function takeoverFromAgent(leadId: string): void;
export declare function processMessage(leadId: string, incomingMessage: string): Promise<AgentResponse>;
export declare function handleLeadReply(leadId: string): Promise<void>;
export {};
//# sourceMappingURL=whatsappAgent.service.d.ts.map