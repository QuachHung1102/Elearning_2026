import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import { UserRole } from '../generated/prisma/client.js';
import { AdminGuard } from './admin.guard.js';
import type { AuthService } from './auth.service.js';

function context(token?: string) {
  const request = { cookies: token ? { elearning_session: token } : {} };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
  };
}

describe('AdminGuard', () => {
  it.each([
    ['missing session', undefined, null],
    ['invalid session', 'bad', null],
    [
      'student session',
      'student',
      { user: { role: UserRole.STUDENT }, sessionId: 'session' },
    ],
  ])('hides admin routes for %s', async (_name, token, auth) => {
    const service = { authenticate: vi.fn().mockResolvedValue(auth) };
    const guard = new AdminGuard(service as unknown as AuthService);
    await expect(
      guard.canActivate(context(token).context),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sets request.auth for an admin', async () => {
    const auth = {
      user: { role: UserRole.ADMIN },
      sessionId: 'session',
    };
    const service = { authenticate: vi.fn().mockResolvedValue(auth) };
    const guard = new AdminGuard(service as unknown as AuthService);
    const target = context('admin');

    await expect(guard.canActivate(target.context)).resolves.toBe(true);
    expect(target.request).toHaveProperty('auth', auth);
  });
});
