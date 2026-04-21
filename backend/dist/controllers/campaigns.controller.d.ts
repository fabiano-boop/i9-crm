import { Request, Response } from 'express';
export declare function listCampaigns(req: Request, res: Response): Promise<void>;
export declare function getCampaign(req: Request, res: Response): Promise<void>;
export declare function createCampaign(req: Request, res: Response): Promise<void>;
export declare function updateCampaign(req: Request, res: Response): Promise<void>;
export declare function deleteCampaign(req: Request, res: Response): Promise<void>;
export declare function addLeadsToCampaign(req: Request, res: Response): Promise<void>;
export declare function removeLeadFromCampaign(req: Request, res: Response): Promise<void>;
export declare function getCampaignStats(req: Request, res: Response): Promise<void>;
export declare function sendCampaign(req: Request, res: Response): Promise<void>;
export declare function pauseCampaign(req: Request, res: Response): Promise<void>;
export declare function getEngagedLeads(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=campaigns.controller.d.ts.map