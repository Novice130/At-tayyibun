import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  CanActivate,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * BetterAuth Session Cookie Guard - applied globally
 * Validates the `better-auth.session_token` cookie against the Session table.
 * All routes require authentication unless marked with @Public().
 */
@Injectable()
export class BetterAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Extract session token from cookie
    const sessionToken =
      request.cookies?.["better-auth.session_token"] ||
      request.cookies?.["better-auth.session_token"];

    if (!sessionToken) {
      throw new UnauthorizedException("Authentication required");
    }

    // Look up the session in the database
    const session = await this.prisma.session.findUnique({
      where: { token: sessionToken },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException("Invalid session");
    }

    // Check if session has expired
    if (new Date(session.expiresAt) < new Date()) {
      throw new UnauthorizedException("Session expired");
    }

    // Attach user to request (same shape downstream code expects)
    request.user = session.user;

    return true;
  }
}
