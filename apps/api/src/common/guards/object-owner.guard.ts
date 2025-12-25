import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

/**
 * Object-level authorization guard
 * Ensures users can only access their own resources
 * This prevents IDOR (Insecure Direct Object Reference) attacks
 * 
 * Usage: Apply to routes where user should only access their own data
 * The guard checks if request.params.userId matches the authenticated user's ID
 */
@Injectable()
export class ObjectOwnerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    // Admins can access any resource
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
      return true;
    }

    // Check various param names that might contain user ID
    const resourceUserId = 
      request.params.userId || 
      request.params.id ||
      request.body?.userId;

    // If no user ID in params, check if it's a "me" endpoint
    if (!resourceUserId) {
      return true; // Let other guards or controller logic handle
    }

    // Check ownership
    if (resourceUserId !== user.id && resourceUserId !== user.publicId) {
      throw new ForbiddenException('You can only access your own resources');
    }

    return true;
  }
}
