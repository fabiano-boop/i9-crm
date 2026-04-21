import { Queue } from 'bullmq';
export declare function getBackupQueue(): Queue;
export declare function scheduleBackupJob(): Promise<void>;
export declare function startBackupWorker(): Promise<void>;
//# sourceMappingURL=backup.job.d.ts.map