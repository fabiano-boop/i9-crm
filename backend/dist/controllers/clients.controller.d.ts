import { Request, Response } from 'express';
export declare function listClients(req: Request, res: Response): Promise<void>;
export declare function getClient(req: Request, res: Response): Promise<void>;
export declare function createClient(req: Request, res: Response): Promise<void>;
export declare function updateClient(req: Request, res: Response): Promise<void>;
export declare function patchClientStatus(req: Request, res: Response): Promise<void>;
export declare function deleteClient(req: Request, res: Response): Promise<void>;
export declare function listClientReports(req: Request, res: Response): Promise<void>;
export declare function generateClientReport(req: Request, res: Response): Promise<void>;
export declare function getClientsOverview(_req: Request, res: Response): Promise<void>;
export declare function getMrrProjection(_req: Request, res: Response): Promise<void>;
export declare function sendStandaloneReport(req: Request, res: Response): Promise<void>;
export declare function previewReport(req: Request, res: Response): Promise<void>;
export declare function downloadReportPdf(req: Request, res: Response): Promise<void>;
export declare function downloadNestedReportPdf(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=clients.controller.d.ts.map