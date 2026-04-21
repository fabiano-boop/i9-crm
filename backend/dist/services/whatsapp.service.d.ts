export declare function sendText(phone: string, message: string, retries?: number): Promise<boolean>;
export declare function sendCampaignWhatsApp(campaignId: string): Promise<void>;
export declare function processWhatsAppWebhook(body: Record<string, unknown>): Promise<void>;
//# sourceMappingURL=whatsapp.service.d.ts.map