import { HttpException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AppExceptionFilter } from './error-filter.js';
import { RateLimitedError } from './rate-limited.error.js';

function hostFor(request: object) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ status }),
    }),
  };
  return { host: host as never, json, status };
}

const prismaError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError(
    'Invalid `prisma.course.create()` invocation: Unique constraint failed on the fields: (`slug`)',
    { code, clientVersion: 'test', ...(meta ? { meta } : {}) },
  );

describe('AppExceptionFilter logging (REVIEW F-03)', () => {
  const request = { requestId: 'req-42', method: 'POST', path: '/api/v1/x' };

  it('logs a 5xx with the requestId the client was given, and the stack', () => {
    const logger = { error: vi.fn() };
    const { host } = hostFor(request);
    const boom = new Error('boom');

    new AppExceptionFilter(logger as never).catch(boom, host);

    expect(logger.error).toHaveBeenCalledOnce();
    const [message, stack] = logger.error.mock.calls[0];
    expect(message).toContain('req-42');
    expect(message).toContain('POST /api/v1/x');
    expect(stack).toBe(boom.stack);
  });

  it('logs the path without its query string, which can carry a signed URL', () => {
    const logger = { error: vi.fn() };
    const { host } = hostFor({
      ...request,
      path: '/api/v1/media/local/a.mp4',
      url: '/api/v1/media/local/a.mp4?exp=1&sig=secret',
    });

    new AppExceptionFilter(logger as never).catch(new Error('x'), host);

    expect(logger.error.mock.calls[0][0]).not.toContain('secret');
  });

  it('stays quiet for a 4xx', () => {
    const logger = { error: vi.fn() };
    const { host } = hostFor(request);

    new AppExceptionFilter(logger as never).catch(
      new HttpException({ code: 'EMAIL_TAKEN', message: 'Taken' }, 409),
      host,
    );

    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('AppExceptionFilter Prisma errors (REVIEW F-06)', () => {
  const request = { requestId: 'req-p', method: 'POST', path: '/api/v1/x' };

  it('answers a unique violation raced past a pre-check with 409 CONFLICT', () => {
    const { host, json, status } = hostFor(request);

    new AppExceptionFilter({ error: vi.fn() } as never).catch(
      prismaError('P2002'),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    // The Prisma message names the model and column; none of it may leak.
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Conflict',
      error: 'Conflict',
    });
  });

  // Two writers with one title read the same free slug; the loser is told so, in the words
  // the web already has, whichever way the driver reports the constraint.
  it.each([
    ['the pg adapter names the constraint of a course', { driverAdapterError: { cause: { constraint: { index: 'courses_slug_key' } } }, modelName: 'Course' }],
    ['the pg adapter names the constraint of a category', { driverAdapterError: { cause: { constraint: { index: 'categories_slug_key' } } }, modelName: 'Category' }],
    ['Prisma\'s own engine lists the fields', { target: ['slug'] }],
  ])('answers a lost slug race with 409 SLUG_TAKEN when %s', (_label, meta) => {
    const { host, json, status } = hostFor(request);

    new AppExceptionFilter({ error: vi.fn() } as never).catch(prismaError('P2002', meta), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      code: 'SLUG_TAKEN',
      message: 'Slug is already taken',
      error: 'Conflict',
    });
  });

  it('keeps the plain CONFLICT for a unique violation on anything else', () => {
    const { host, json } = hostFor(request);

    new AppExceptionFilter({ error: vi.fn() } as never).catch(
      prismaError('P2002', { driverAdapterError: { cause: { constraint: { index: 'users_email_key' } } } }),
      host,
    );

    expect(json.mock.calls[0][0]).toMatchObject({ code: 'CONFLICT', message: 'Conflict' });
  });

  it('answers a record that vanished mid-write with 404', () => {
    const { host, json, status } = hostFor(request);

    new AppExceptionFilter({ error: vi.fn() } as never).catch(
      prismaError('P2025'),
      host,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Not Found',
      error: 'Not Found',
    });
  });

  it('keeps any other Prisma code a logged 500', () => {
    const logger = { error: vi.fn() };
    const { host, status } = hostFor(request);

    new AppExceptionFilter(logger as never).catch(prismaError('P2010'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(logger.error).toHaveBeenCalledOnce();
  });
});

describe('AppExceptionFilter', () => {
  it('normalizes an HttpException and omits requestId below 500', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'request-123' }),
        getResponse: () => ({ status }),
      }),
    };

    new AppExceptionFilter().catch(
      new HttpException({ code: 'EMAIL_TAKEN', message: 'Taken' }, 409),
      host as never,
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      code: 'EMAIL_TAKEN',
      message: 'Taken',
      error: 'Conflict',
    });
  });

  it('hides unexpected errors and includes requestId', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'request-500' }),
        getResponse: () => ({ status }),
      }),
    };

    new AppExceptionFilter({ error: vi.fn() } as never).catch(
      new Error('secret'),
      host as never,
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL',
      message: 'Internal server error',
      error: 'Internal Server Error',
      requestId: 'request-500',
    });
  });

  it('only ends a response whose headers already went out', () => {
    const status = vi.fn();
    const end = vi.fn();
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'request-stream' }),
        getResponse: () => ({ headersSent: true, status, end }),
      }),
    };

    new AppExceptionFilter({ error: vi.fn() } as never).catch(
      new Error('premature close'),
      host as never,
    );

    expect(status).not.toHaveBeenCalled();
    expect(end).toHaveBeenCalledOnce();
  });
});

describe('AppExceptionFilter and RateLimitedError', () => {
  it('turns the wait it carries into Retry-After, and answers with the ordinary 429 body', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const setHeader = vi.fn();
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'req-1', method: 'POST', path: '/x' }),
        getResponse: () => ({ status, setHeader }),
      }),
    };

    new AppExceptionFilter({ error: vi.fn() } as never).catch(
      new RateLimitedError(42),
      host as never,
    );

    expect(setHeader).toHaveBeenCalledWith('Retry-After', 42);
    expect(status).toHaveBeenCalledWith(429);
    expect(json.mock.calls[0][0]).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
  });
});
