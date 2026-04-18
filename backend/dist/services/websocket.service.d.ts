import { WebSocketServer } from 'ws';
import { Server } from 'http';
interface WSMessage {
    type: string;
    data: unknown;
}
export declare function initWebSocket(server: Server): WebSocketServer;
export declare function broadcast(message: WSMessage): void;
export declare function broadcastToUser(userId: string, message: WSMessage): void;
export declare const wsEvents: {
    hotAlert: (lead: {
        id: string;
        name: string;
        businessName: string;
        score: number;
        classification: string;
    }, eventType: "open" | "click") => void;
    campaignSent: (campaign: {
        id: string;
        name: string;
    }, stats: {
        sent: number;
        failed: number;
    }) => void;
    leadReplied: (lead: {
        id: string;
        name: string;
        businessName: string;
    }, campaignId: string) => void;
    syncComplete: (stats: {
        rowsImported: number;
        rowsUpdated: number;
        status: string;
    }) => void;
    opportunityAlert: (alert: {
        id: string;
        leadId: string;
        type: string;
        title: string;
        urgency: number;
    }) => void;
};
export {};
//# sourceMappingURL=websocket.service.d.ts.map