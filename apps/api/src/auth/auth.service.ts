import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserStatus, type User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';

export const AUTH_COOKIE_NAME = 'elearning_session';
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

export type AuthUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'displayName'
  | 'role'
  | 'status'
  | 'emailVerifiedAt'
  | 'createdAt'
>;

type AuthResult = { token: string; user: AuthUser };
type JwtClaims = { sub?: unknown; sid?: unknown };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<AuthResult> {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);
    let user: User;

    try {
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName: input.displayName.trim(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }

    return this.issueSession(user);
  }

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(input.email) },
    });

    let passwordMatches = false;
    if (user) {
      passwordMatches = await verifyPassword(input.password, user.passwordHash);
    } else {
      await hashPassword(input.password);
    }

    if (!user || !passwordMatches || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user);
  }

  async authenticate(
    token: string,
  ): Promise<{ user: AuthUser; sessionId: string } | null> {
    let claims: JwtClaims;

    try {
      claims = await this.jwt.verifyAsync<JwtClaims>(token);
    } catch {
      return null;
    }

    if (typeof claims.sub !== 'string' || typeof claims.sid !== 'string') {
      return null;
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: claims.sid,
        userId: claims.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: UserStatus.ACTIVE },
      },
      include: { user: true },
    });

    if (!session) return null;

    return { user: this.toAuthUser(session.user), sessionId: session.id };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueSession(user: User): Promise<AuthResult> {
    const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1_000);
    const session = await this.prisma.session.create({
      data: { userId: user.id, expiresAt },
    });
    const token = await this.jwt.signAsync(
      { sub: user.id, sid: session.id },
      { expiresIn: SESSION_DURATION_SECONDS },
    );

    return { token, user: this.toAuthUser(user) };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }
}
