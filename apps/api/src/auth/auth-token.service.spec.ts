import { HttpException } from '@nestjs/common';
import { AuthTokenType } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthTokenService } from './auth-token.service.js';

function setup() {
  const authToken = {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  };
  const prisma = {
    authToken,
    $transaction: vi.fn(async (callback) => callback({ authToken })),
  };
  return {
    authToken,
    service: new AuthTokenService(prisma as unknown as PrismaService),
  };
}

describe('AuthTokenService', () => {
  beforeEach(() =>
    vi.useFakeTimers().setSystemTime(new Date('2026-09-04T00:00:00Z')),
  );
  afterEach(() => vi.useRealTimers());

  it('uses independent TTLs for verification and reset tokens', async () => {
    const { authToken, service } = setup();
    await service.issue('user', AuthTokenType.EMAIL_VERIFICATION, 1_440);
    await service.issue('user', AuthTokenType.PASSWORD_RESET, 60);

    expect(authToken.create.mock.calls[0][0].data.expiresAt).toEqual(
      new Date('2026-09-05T00:00:00Z'),
    );
    expect(authToken.create.mock.calls[1][0].data.expiresAt).toEqual(
      new Date('2026-09-04T01:00:00Z'),
    );
  });

  it.each([
    ['expired', new Date('2026-09-03T23:59:59Z'), null],
    ['consumed', new Date('2026-09-05T00:00:00Z'), new Date()],
  ])('rejects an %s token', async (_name, expiresAt, consumedAt) => {
    const { authToken, service } = setup();
    authToken.findUnique.mockResolvedValue({
      id: 'token',
      userId: 'user',
      type: AuthTokenType.EMAIL_VERIFICATION,
      expiresAt,
      consumedAt,
    });

    await expect(
      service.consume('x'.repeat(32), AuthTokenType.EMAIL_VERIFICATION),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('rejects a concurrent second use', async () => {
    const { authToken, service } = setup();
    authToken.findUnique.mockResolvedValue({
      id: 'token',
      userId: 'user',
      type: AuthTokenType.EMAIL_VERIFICATION,
      expiresAt: new Date('2026-09-05T00:00:00Z'),
      consumedAt: null,
    });
    authToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.consume('x'.repeat(32), AuthTokenType.EMAIL_VERIFICATION),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
