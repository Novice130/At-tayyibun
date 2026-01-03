import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark an endpoint as public (no authentication required)
 * Use sparingly - deny-by-default is the security model
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
