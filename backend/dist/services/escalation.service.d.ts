export interface EscalationPayload {
    leadId: string;
    leadName: string;
    businessName: string;
    neighborhood: string;
    phone?: string | null;
    reason: string;
    lastMessage: string;
    agentLastReply: string;
    suggestedPackage?: string;
    urgencyLevel?: 'low' | 'medium' | 'high';
}
export type EscalationTrigger = 'wants_proposal' | 'wants_owner' | 'ready_to_close' | 'price_negotiation' | 'frustrated' | 'repeated_failure' | 'agent_decision';
export declare function triggerEscalation(payload: EscalationPayload): Promise<void>;
//# sourceMappingURL=escalation.service.d.ts.map