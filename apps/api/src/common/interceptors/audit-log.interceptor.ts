import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../services/audit.service';

/**
 * Audit log interceptor for sensitive actions.
 * Logs requests to specified endpoints automatically.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  // Actions to audit
  private readonly auditedPaths = [
    { method: 'POST', path: '/auth/login', action: 'LOGIN_ATTEMPT' },
    { method: 'POST', path: '/auth/signup', action: 'SIGNUP' },
    { method: 'POST', path: '/requests', action: 'INFO_REQUEST_CREATED' },
    { method: 'PUT', path: '/requests', action: 'INFO_REQUEST_RESPONSE' },
    { method: 'DELETE', path: '/users', action: 'ACCOUNT_DELETE' },
    { method: 'POST', path: '/admin', action: 'ADMIN_ACTION' },
    { method: 'PUT', path: '/admin', action: 'ADMIN_ACTION' },
    { method: 'DELETE', path: '/admin', action: 'ADMIN_ACTION' },
  ];

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, path, user, ip, headers } = request;

    // Check if this path should be audited
    const auditConfig = this.auditedPaths.find(
      (config) => config.method === method && path.includes(config.path),
    );

    if (!auditConfig) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          // Log successful action
          this.auditService.log({
            userId: user?.id,
            action: `${auditConfig.action}_SUCCESS`,
            resourceType: this.extractResourceType(path),
            ipAddress: ip,
            userAgent: headers['user-agent'],
            metadata: {
              path,
              method,
              duration: Date.now() - startTime,
            },
          });
        },
        error: (error) => {
          // Log failed action
          this.auditService.log({
            userId: user?.id,
            action: `${auditConfig.action}_FAILED`,
            resourceType: this.extractResourceType(path),
            ipAddress: ip,
            userAgent: headers['user-agent'],
            metadata: {
              path,
              method,
              duration: Date.now() - startTime,
              errorMessage: error.message,
              errorStatus: error.status,
            },
          });
        },
      }),
    );
  }

  private extractResourceType(path: string): string {
    const segments = path.split('/').filter(Boolean);
    return segments[1] || 'unknown';
  }
}
