import type { OpportunityAlert } from '@prisma/client';
export declare function checkHotEngagement(leadId: string): Promise<OpportunityAlert | null>;
export declare function checkCoolingLeads(): Promise<number>;
export declare function checkNoContactWeek(): Promise<number>;
export declare function generateMorningDigest(): Promise<void>;
//# sourceMappingURL=opportunityAlert.service.d.ts.map