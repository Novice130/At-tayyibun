import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';

/**
 * CSRF defense for cookie-authenticated state-changing requests.
 *
 * Browsers always attach an Origin header to cross-origin (and most
 * same-origin) POST/PUT/PATCH/DELETE requests, so an Origin that does not
 * match WEB_URL is rejected outright. Non-browser clients (the Flutter app,
 * curl, tests) send no Origin — they must present the X-Requested-With marker
 * header that a plain cross-site HTML form can never set.
 *
 * Only enforced when a better-auth session cookie is present: CSRF only
 * matters for cookie-authenticated requests. Unauthenticated mutations
 * (public endpoints) are not affected.
 */
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  private readonly webUrl: string;

  constructor(config: ConfigService) {
    this.webUrl = (config.get<string>('WEB_URL') || 'http://localhost:3000').replace(/\/+$/, '');
  }

  use(req: Request, res: Response, next: NextFunction) {
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next();
    }

    const hasSessionCookie = !!(
      req.cookies?.['better-auth.session_token'] ||
      req.cookies?.['__Secure-better-auth.session_token']
    );
    if (!hasSessionCookie) {
      return next();
    }

    const origin = req.headers.origin;
    if (origin) {
      if (origin === this.webUrl) {
        return next();
      }
      throw new ForbiddenException('Cross-origin request rejected');
    }

    if (!req.headers['x-requested-with']) {
      throw new ForbiddenException(
        'State-changing requests with a session cookie must declare an Origin or X-Requested-With header',
      );
    }
    next();
  }
}
