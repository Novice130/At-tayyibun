import * as Sentry from '@sentry/nestjs';
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';

/** Error class plus a driver code if present; never the message or params. */
function describeSafely(exception: unknown): string {
  if (!(exception instanceof Error)) return 'non-Error thrown';
  const e = exception as Error & { code?: unknown; cause?: { code?: unknown } };
  const code = e.code ?? e.cause?.code;
  return typeof code === 'string' ? `${e.name} (code ${code})` : e.name;
}

/**
 * A copy of the error for Sentry: same name and stack frames, but the header
 * (which repeats the message, possibly multi-line with query params) is
 * replaced by the safe description, and `cause` is not carried over.
 */
function sanitizedForSentry(exception: unknown): Error {
  const safe = new Error(describeSafely(exception));
  if (!(exception instanceof Error)) {
    safe.name = 'NonErrorThrown';
    return safe;
  }
  safe.name = exception.name;
  const frames = exception.stack?.indexOf('\n    at ') ?? -1;
  if (frames >= 0) {
    safe.stack = `${exception.name}: ${describeSafely(exception)}${exception.stack!.slice(frames)}`;
  }
  return safe;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException && status < 500) {
      // Expected traffic (auth, validation, throttling): no stack, not an error.
      this.logger.debug(`${status} ${exception.name}`);
    } else if (exception instanceof HttpException) {
      this.logger.error('Unhandled exception:', exception.stack);
    } else {
      // Driver errors (Drizzle) carry bound query params in `message`, some of
      // them private. Log the class and a driver code only.
      this.logger.error(`Unhandled exception: ${describeSafely(exception)}`);
    }

    // Only server faults go to Sentry; 4xx (auth, validation, throttling) is expected traffic.
    // Non-HTTP errors are sent as a sanitized copy (original name and stack
    // frames, no message, no cause) so bound params cannot reach Sentry either.
    if (exception instanceof HttpException) {
      if (status >= 500) Sentry.captureException(exception);
    } else {
      Sentry.captureException(sanitizedForSentry(exception));
    }

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    response.status(status).json(message);
  }
}
