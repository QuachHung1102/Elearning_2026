import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { setTimeout as delay } from 'node:timers/promises';
import {
  AuthTokenType,
  Prisma,
  UserStatus,
  type User,
} from '../generated/prisma/client.js';
import { ERROR_CODE, appError } from '../common/error-codes.js';
import { config } from '../config.js';
import { escapeHtml, MAILER, type Mailer } from '../mail/mailer.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SESSION_DURATION_SECONDS } from './auth.constants.js';
import { AuthTokenService } from './auth-token.service.js';
import { hashPassword, verifyPassword } from './password.js';

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

export type AuthContext = { user: AuthUser; sessionId: string };
type AuthResult = { token: string; user: AuthUser };
type JwtClaims = { sub?: unknown; sid?: unknown };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly authTokens: AuthTokenService,
    @Inject(MAILER) private readonly mailer: Mailer,
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
        throw appError(
          HttpStatus.CONFLICT,
          ERROR_CODE.EMAIL_TAKEN,
          'Email is already registered',
        );
      }
      throw error;
    }

    const result = await this.issueSession(user);
    await this.sendVerificationEmail(user);
    return result;
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
      throw appError(
        HttpStatus.UNAUTHORIZED,
        ERROR_CODE.INVALID_CREDENTIALS,
        'Invalid email or password',
      );
    }

    return this.issueSession(user);
  }

  async authenticate(token: string): Promise<AuthContext | null> {
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

  async requestEmailVerification(user: AuthUser): Promise<void> {
    if (user.emailVerifiedAt !== null) return;
    await this.sendVerificationEmail(user);
  }

  async confirmEmail(token: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const userId = await this.authTokens.consume(
        token,
        AuthTokenType.EMAIL_VERIFICATION,
        transaction,
      );
      await transaction.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    const minimumResponseTime = delay(500);
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: this.normalizeEmail(email) },
      });
      if (!user || user.status !== UserStatus.ACTIVE) return;

      const token = await this.authTokens.issue(
        user.id,
        AuthTokenType.PASSWORD_RESET,
        config.passwordResetTtlMinutes,
      );
      const link = `${config.webOrigin}/reset-password?token=${encodeURIComponent(token)}`;
      await this.safeSend({
        to: user.email,
        subject: 'Đặt lại mật khẩu',
        text: `Xin chào ${user.displayName}. Đặt lại mật khẩu tại ${link}. Nếu không phải bạn thì bỏ qua email này.`,
        html: this.userEmail(
          user.displayName,
          'Bạn vừa yêu cầu đặt lại mật khẩu.',
          'Đặt lại mật khẩu',
          link,
        ),
        tag: 'reset-password',
      });
    } finally {
      await minimumResponseTime;
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (transaction) => {
      const userId = await this.authTokens.consume(
        token,
        AuthTokenType.PASSWORD_RESET,
        transaction,
      );
      await transaction.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      await transaction.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.authToken.updateMany({
        where: {
          userId,
          type: AuthTokenType.PASSWORD_RESET,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
    });
  }

  async updateProfile(userId: string, displayName: string): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: displayName.trim() },
    });
    return this.toAuthUser(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw appError(
        HttpStatus.UNAUTHORIZED,
        ERROR_CODE.INVALID_CREDENTIALS,
        'Current password is incorrect',
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true },
    });
    return sessions.map((session) => ({
      ...session,
      isCurrent: session.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count !== 1) {
      throw appError(HttpStatus.NOT_FOUND, ERROR_CODE.NOT_FOUND, 'Not Found');
    }
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, id: { not: currentSessionId }, revokedAt: null },
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

  private async sendVerificationEmail(user: AuthUser): Promise<void> {
    const token = await this.authTokens.issue(
      user.id,
      AuthTokenType.EMAIL_VERIFICATION,
      config.emailVerifyTtlMinutes,
    );
    const link = `${config.webOrigin}/verify-email?token=${encodeURIComponent(token)}`;
    await this.safeSend({
      to: user.email,
      subject: 'Xác minh email của bạn',
      text: `Xin chào ${user.displayName}. Xác minh email tại ${link}. Nếu không phải bạn thì bỏ qua email này.`,
      html: this.userEmail(
        user.displayName,
        'Xác minh email để nhận thông báo và khôi phục tài khoản.',
        'Xác minh email',
        link,
      ),
      tag: 'verify-email',
    });
  }

  private userEmail(
    displayName: string,
    message: string,
    action: string,
    link: string,
  ): string {
    return `<!doctype html><html lang="vi"><body><p>Xin chào ${escapeHtml(displayName)},</p><p>${escapeHtml(message)}</p><p><a href="${escapeHtml(link)}">${escapeHtml(action)}</a></p><p>Nếu không phải bạn thì bỏ qua email này.</p><p>E-learning</p></body></html>`;
  }

  private async safeSend(
    message: Parameters<Mailer['send']>[0],
  ): Promise<void> {
    try {
      await this.mailer.send(message);
    } catch (error) {
      process.stderr.write(
        `${JSON.stringify({ evt: 'mail.send_failed', tag: message.tag, error: String(error) })}\n`,
      );
    }
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
