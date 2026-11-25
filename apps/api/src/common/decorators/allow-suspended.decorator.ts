import { SetMetadata } from '@nestjs/common';

export const ALLOW_SUSPENDED_KEY = 'allowSuspended';

/**
 * Let a route run for a suspended account. Reserve this for deleting the
 * account: a suspended member keeps the right to erase their data.
 */
export const AllowSuspended = () => SetMetadata(ALLOW_SUSPENDED_KEY, true);
