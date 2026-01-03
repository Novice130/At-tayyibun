import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'auditAction';

/**
 * Decorator to mark an endpoint for audit logging
 * Example: @Audit('REQUEST_SENT')
 */
export const Audit = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
