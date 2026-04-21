export interface SyncResult {
    rowsImported: number;
    rowsUpdated: number;
    rowsSkipped: number;
    errors: string[];
}
export declare function syncFromSheets(): Promise<SyncResult>;
//# sourceMappingURL=sheets.service.d.ts.map