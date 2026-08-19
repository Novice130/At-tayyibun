// Express request augmentation. The BetterAuthGuard attaches the verified
// session row and a flattened user object (with their profile) to the
// request for downstream handlers.
import 'express';

declare global {
  namespace Express {
    interface Request {
      session?: Record<string, any>;
      user?: Record<string, any>;
    }
  }
}

export {};
