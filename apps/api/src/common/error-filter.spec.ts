import { HttpException } from '@nestjs/common';
import { AppExceptionFilter } from './error-filter.js';

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

    new AppExceptionFilter().catch(new Error('secret'), host as never);

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

    new AppExceptionFilter().catch(new Error('premature close'), host as never);

    expect(status).not.toHaveBeenCalled();
    expect(end).toHaveBeenCalledOnce();
  });
});
