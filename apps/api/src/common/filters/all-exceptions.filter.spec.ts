import * as Sentry from '@sentry/nestjs';
import { ArgumentsHost, ForbiddenException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }));

function host() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const h = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { h, status, json };
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends Sentry a copy with the original frames but no message or params', () => {
    const err = new Error('Failed query: update "profiles"\nparams: DIVORCED,true');
    (err as Error & { cause?: unknown }).cause = { code: '23505', detail: 'DIVORCED' };
    const { h, status, json } = host();

    new AllExceptionsFilter().catch(err, h);

    const sent = (Sentry.captureException as jest.Mock).mock.calls[0][0] as Error;
    expect(sent).not.toBe(err);
    expect(sent.stack).not.toContain('DIVORCED');
    expect(sent.message).not.toContain('DIVORCED');
    expect(sent.stack!.split('\n')[0]).toBe('Error: Error (code 23505)');
    expect(sent.stack).toContain(err.stack!.split('\n').find((l) => l.startsWith('    at '))!);
    expect((sent as Error & { cause?: unknown }).cause).toBeUndefined();
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error' });
  });

  it('does not report expected 4xx and passes the body through', () => {
    const body = { statusCode: 403, code: 'PROFILE_INCOMPLETE', message: 'Please complete your profile to browse.' };
    const { h, status, json } = host();

    new AllExceptionsFilter().catch(new ForbiddenException(body), h);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(body);
  });
});
