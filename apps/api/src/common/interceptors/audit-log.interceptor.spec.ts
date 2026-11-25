import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';

const CF_EDGE = '162.158.10.20';
const VISITOR = '203.0.113.9';

function run(result: CallHandler['handle']) {
  const auditService = { log: jest.fn() };
  const interceptor = new AuditLogInterceptor(auditService as never);
  const request = {
    method: 'POST',
    path: '/api/requests',
    user: { id: 'u1' },
    ip: CF_EDGE,
    socket: { remoteAddress: '172.18.0.2' },
    headers: { 'cf-connecting-ip': VISITOR, 'user-agent': 'test' },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { auditService, out: interceptor.intercept(context, { handle: result }) };
}

describe('AuditLogInterceptor client IP', () => {
  it('records the visitor, not the Cloudflare edge, on success', async () => {
    const { auditService, out } = run(() => of({ ok: true }));
    await lastValueFrom(out);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: VISITOR }));
  });

  it('records the visitor on failure', async () => {
    const { auditService, out } = run(() => throwError(() => new Error('boom')));
    await expect(lastValueFrom(out)).rejects.toThrow('boom');
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: VISITOR }));
  });
});
