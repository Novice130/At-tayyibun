import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

export interface AuditLogData {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit logging service for sensitive actions.
 * IMPORTANT: Never log secrets, passwords, or plaintext biodata.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit event
   */
  async log(data: AuditLogData): Promise<void> {
    // Sanitize metadata - remove any sensitive fields
    const sanitizedMetadata = data.metadata
      ? (this.sanitizeMetadata(data.metadata) as Prisma.InputJsonValue)
      : undefined;

    await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        metadata: sanitizedMetadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent?.substring(0, 500), // Truncate long user agents
      },
    });
  }

  /**
   * Sanitize metadata to remove sensitive fields
   */
  private sanitizeMetadata(
    metadata: Record<string, unknown>
  ): Record<string, unknown> {
    const sensitiveFields = [
      "password",
      "passwordHash",
      "token",
      "secret",
      "key",
      "biodata",
      "bio",
      "lastName",
      "phone",
      "email",
      "content",
      "message",
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      // Skip sensitive fields
      if (
        sensitiveFields.some((field) =>
          key.toLowerCase().includes(field.toLowerCase())
        )
      ) {
        sanitized[key] = "[REDACTED]";
        continue;
      }

      // Recursively sanitize nested objects
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        sanitized[key] = this.sanitizeMetadata(
          value as Record<string, unknown>
        );
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Log user login
   */
  async logLogin(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: "LOGIN",
      resourceType: "auth",
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log info request actions
   */
  async logInfoRequest(
    userId: string,
    action:
      | "REQUEST_SENT"
      | "REQUEST_APPROVED"
      | "REQUEST_DENIED"
      | "REQUEST_EXPIRED",
    targetUserId: string,
    requestId: string,
    allowedShares?: string[]
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resourceType: "info_request",
      resourceId: requestId,
      metadata: {
        targetUserId,
        allowedShares: allowedShares || [],
      },
    });
  }

  /**
   * Log admin actions
   */
  async logAdminAction(
    adminId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      userId: adminId,
      action: `ADMIN_${action}`,
      resourceType,
      resourceId,
      metadata,
    });
  }

  /**
   * Log data export
   */
  async logDataExport(userId: string, exportType: string): Promise<void> {
    await this.log({
      userId,
      action: "DATA_EXPORT",
      resourceType: "user_data",
      metadata: { exportType },
    });
  }

  /**
   * Log account deletion
   */
  async logAccountDeletion(userId: string, deletedBy: string): Promise<void> {
    await this.log({
      userId,
      action: "ACCOUNT_DELETED",
      resourceType: "user",
      resourceId: userId,
      metadata: { deletedBy },
    });
  }
}
