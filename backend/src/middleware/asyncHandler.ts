import { Request, Response, NextFunction, RequestHandler } from 'express'

// Wrapper para async route handlers — propaga erros ao error handler global
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
