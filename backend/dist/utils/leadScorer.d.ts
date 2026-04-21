interface PlaceData {
    name: string;
    phone?: string;
    website?: string;
    rating?: number;
    userRatingsTotal?: number;
}
export declare function calculateLeadScore(place: PlaceData): number;
export declare function getLeadTemperature(score: number): 'HOT' | 'WARM' | 'COLD';
export {};
//# sourceMappingURL=leadScorer.d.ts.map