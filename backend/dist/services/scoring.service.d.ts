interface ScoringResult {
    score: number;
    classification: 'HOT' | 'WARM' | 'COLD';
    painPoints: string;
    idealService: string;
    whatsappAngle: string;
    reasoning: string;
}
export declare function scoreLead(leadId: string): Promise<ScoringResult>;
export declare function bulkScoreLeads(leadIds: string[]): Promise<{
    id: string;
    result?: ScoringResult;
    error?: string;
}[]>;
export {};
//# sourceMappingURL=scoring.service.d.ts.map