import { SetMetadata } from '@nestjs/common';
import { Role } from '../types/role';

export const ROLES_KEY = 'roles';

/**
 * Decorator to set required roles for a route
 * Usage: @Roles(Role.ADMIN, Role.SUPER_ADMIN)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
