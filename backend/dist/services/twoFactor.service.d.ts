export declare function generateSecret(userId: string, userEmail: string): Promise<{
    qrCode: string;
    secret: string;
}>;
export declare function verifyToken(userId: string, token: string): Promise<boolean>;
export declare function isEnabled(userId: string): Promise<boolean>;
export declare function disable(userId: string): Promise<void>;
//# sourceMappingURL=twoFactor.service.d.ts.map