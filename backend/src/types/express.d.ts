import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        phoneHash: string;
        userId?: string;
      };
    }
  }
}
