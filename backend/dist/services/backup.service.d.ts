import type { BackupLog } from '@prisma/client';
export declare function runBackup(triggeredBy?: string): Promise<BackupLog>;
export declare function listBackups(page?: number, limit?: number): Promise<{
    data: BackupLog[];
    total: number;
}>;
//# sourceMappingURL=backup.service.d.ts.map