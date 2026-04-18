import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DrizzleService } from '../db/drizzle.service';
import { auditLogs } from '../db/schema';

export interface AuditLogData {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

const SENSITIVE_FIELDS = [
  'password', 'passwordHash', 'token', 'secret', 'key',
  'biodata', 'bio', 'lastName', 'phone', 'email', 'content', 'message',
];

@Injectable()
export class AuditService {
  constructor(private readonly drizzle: DrizzleService) {}

  async log(data: AuditLogData): Promise<void> {
    await this.drizzle.db.insert(auditLogs).values({
      id: randomUUID(),
      userId: data.userId ?? null,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId ?? null,
      metadata: data.metadata ? this.sanitizeMetadata(data.metadata) : null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent?.substring(0, 500) ?? null,
    });
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
        continue;
      }
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  async logLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.log({ userId, action: 'LOGIN', resourceType: 'auth', ipAddress, userAgent });
  }

  async logInfoRequest(
    userId: string,
    action: 'REQUEST_SENT' | 'REQUEST_APPROVED' | 'REQUEST_DENIED' | 'REQUEST_EXPIRED',
    targetUserId: string,
    requestId: string,
    allowedShares?: string[],
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resourceType: 'info_request',
      resourceId: requestId,
      metadata: { targetUserId, allowedShares: allowedShares ?? [] },
    });
  }

  async logAdminAction(
    adminId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({ userId: adminId, action: `ADMIN_${action}`, resourceType, resourceId, metadata });
  }

  async logDataExport(userId: string, exportType: string): Promise<void> {
    await this.log({ userId, action: 'DATA_EXPORT', resourceType: 'user_data', metadata: { exportType } });
  }

  async logAccountDeletion(userId: string, deletedBy: string): Promise<void> {
    await this.log({
      userId,
      action: 'ACCOUNT_DELETED',
      resourceType: 'user',
      resourceId: userId,
      metadata: { deletedBy },
    });
  }
}
