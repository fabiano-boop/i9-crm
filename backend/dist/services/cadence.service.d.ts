import type { LeadCadence } from '@prisma/client';
export declare function startCadence(leadId: string, sequenceId: string): Promise<LeadCadence>;
export declare function pauseCadence(cadenceId: string, reason: string): Promise<LeadCadence>;
export declare function resumeCadence(cadenceId: string): Promise<LeadCadence>;
export declare function cancelCadence(cadenceId: string): Promise<LeadCadence>;
export declare function processStep(cadenceId: string): Promise<void>;
export declare function pauseActiveCadencesForLead(leadId: string, reason: string): Promise<number>;
//# sourceMappingURL=cadence.service.d.ts.map