import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { AUDIT_ACTION_KEY } from '../decorators/audit.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Audit logging interceptor
 * Logs sensitive actions to the audit_logs table
 * IMPORTANT: Never logs secrets, plaintext biodata, or message content
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditAction = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());

    // Only log if @Audit() decorator is present
    if (!auditAction) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (response) => {
        try {
          await this.createAuditLog(request, auditAction, response);
        } catch (error) {
          // Don't fail the request if audit logging fails
          console.error('Audit log error:', error);
        }
      }),
    );
  }

  private async createAuditLog(request: any, action: string, response: any) {
    const user = request.user;

    // Sanitize metadata - never include sensitive data
    const safeMetadata = this.sanitizeMetadata({
      method: request.method,
      path: request.path,
      params: request.params,
      // Only include safe query params
      query: this.sanitizeQuery(request.query),
      responseId: response?.id,
      duration: Date.now() - request.startTime,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user?.id,
        action,
        entityType: this.getEntityType(request.path),
        entityId: request.params?.id || response?.id,
        metadata: safeMetadata,
        ipAddress: this.getClientIp(request),
        userAgent: request.headers['user-agent']?.substring(0, 255),
      },
    });
  }

  private sanitizeMetadata(data: any): object {
    // Remove any potentially sensitive fields
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'biodata',
      'lastName',
      'dateOfBirth',
      'phone',
      'email',
      'content',
      'message',
    ];

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue;
      
      const keyLower = key.toLowerCase();
      if (sensitiveFields.some(field => keyLower.includes(field))) {
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeQuery(query: any): object {
    if (!query) return {};
    
    // Only include safe query parameters
    const safeParams = ['page', 'limit', 'sort', 'order', 'ethnicity', 'gender', 'minAge', 'maxAge'];
    const filtered: Record<string, any> = {};
    
    for (const key of safeParams) {
      if (query[key] !== undefined) {
        filtered[key] = query[key];
      }
    }
    
    return filtered;
  }

  private getEntityType(path: string): string {
    const segments = path.split('/').filter(Boolean);
    
    if (segments.includes('requests')) return 'InfoRequest';
    if (segments.includes('profiles')) return 'Profile';
    if (segments.includes('users')) return 'User';
    if (segments.includes('photos')) return 'Photo';
    if (segments.includes('messages')) return 'Message';
    if (segments.includes('admin')) return 'Admin';
    if (segments.includes('ads')) return 'Ad';
    if (segments.includes('coupons')) return 'Coupon';
    
    return 'Unknown';
  }

  private getClientIp(request: any): string | null {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.connection?.remoteAddress || null;
  }
}
