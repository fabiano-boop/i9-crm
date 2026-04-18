import type { Lead } from '@prisma/client';
export interface PitchResult {
    whatsappMessage: string;
    emailSubject: string;
    emailBody: string;
    callScript: string;
}
export declare function generatePitch(lead: Lead): Promise<PitchResult>;
export interface CampaignTemplateResult {
    template: string;
    subjectLine: string;
}
export declare function generateCampaignTemplate(context: {
    campaignName: string;
    channel: string;
    targetNiche: string;
    targetNeighborhoods: string[];
    mainService: string;
    hook: string;
}): Promise<CampaignTemplateResult>;
//# sourceMappingURL=claude.service.d.ts.map