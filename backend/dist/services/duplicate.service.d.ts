import type { Lead } from '@prisma/client';
export declare function normalizePhone(phone: string): string;
export declare function levenshteinDistance(a: string, b: string): number;
export declare function similarityScore(a: string, b: string): number;
export interface DuplicateGroup {
    leads: Pick<Lead, 'id' | 'name' | 'businessName' | 'phone' | 'whatsapp' | 'email' | 'neighborhood' | 'niche' | 'score' | 'classification' | 'importedAt'>[];
    confidence: 'certain' | 'possible';
    reason: string;
}
export declare function findDuplicates(): Promise<DuplicateGroup[]>;
export declare function mergeLead(keepId: string, mergeIds: string[]): Promise<Lead>;
//# sourceMappingURL=duplicate.service.d.ts.map