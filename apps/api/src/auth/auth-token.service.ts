import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AuthTokenType, Prisma } from '../generated/prisma/client.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Database = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuthTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(
    userId: string,
    type: AuthTokenType,
    ttlMinutes: number,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      if (type === AuthTokenType.PASSWORD_RESET) {
        await transaction.authToken.updateMany({
          where: { userId, type, consumedAt: null },
          data: { consumedAt: now },
        });
      }

      await transaction.authToken.create({
        data: {
          userId,
          type,
          tokenHash: this.hash(token),
          expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
        },
      });
    });

    return token;
  }

  async consume(
    token: string,
    type: AuthTokenType,
    database: Database = this.prisma,
  ): Promise<string> {
    if (token.length < 32 || token.length > 200) throw this.invalid();

    const now = new Date();
    const record = await database.authToken.findUnique({
      where: { tokenHash: this.hash(token) },
      select: {
        id: true,
        userId: true,
        type: true,
        expiresAt: true,
        consumedAt: true,
      },
    });
    if (
      !record ||
      record.type !== type ||
      record.consumedAt !== null ||
      record.expiresAt <= now
    ) {
      throw this.invalid();
    }

    const consumed = await database.authToken.updateMany({
      where: {
        id: record.id,
        type,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) throw this.invalid();
    return record.userId;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private invalid() {
    return appError(
      HttpStatus.BAD_REQUEST,
      ERROR_CODE.TOKEN_INVALID,
      'Token is invalid, expired, or already used',
    );
  }
}
