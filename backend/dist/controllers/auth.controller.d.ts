import { Request, Response } from 'express';
export declare function login(req: Request, res: Response): Promise<void>;
export declare function refresh(req: Request, res: Response): Promise<void>;
export declare function logout(_req: Request, res: Response): Promise<void>;
export declare function me(req: Request, res: Response): Promise<void>;
export declare function setup2FA(req: Request, res: Response): Promise<void>;
export declare function verify2FA(req: Request, res: Response): Promise<void>;
export declare function validate2FA(req: Request, res: Response): Promise<void>;
export declare function disable2FA(req: Request, res: Response): Promise<void>;
export declare function get2FAStatus(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=auth.controller.d.ts.map