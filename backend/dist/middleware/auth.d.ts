import { Request, Response, NextFunction } from 'express';
export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
export declare function requireAuth(req: Request, res: Response, next: NextFunction): void;
export declare function requireAdmin(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map