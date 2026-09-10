import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Request, Response } from 'express';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  CSRF_COOKIE_NAME,
  CSRF_COOKIE_OPTIONS,
  SESSION_DURATION_SECONDS,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { createCsrfToken } from './csrf.guard.js';
import { RateLimit } from './rate-limit.decorator.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import type { AuthenticatedRequest } from './session-auth.guard.js';

class CredentialsDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

class RegisterDto extends CredentialsDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  displayName: string;
}

class TokenDto {
  @IsString()
  @Length(32, 200)
  token: string;
}

class ForgotPasswordDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(320)
  email: string;
}

class ResetPasswordDto extends TokenDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

class ProfileDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  displayName: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('csrf')
  @Header('Cache-Control', 'no-store')
  @RateLimit({ key: 'ip', limit: 60, windowSeconds: 60 })
  @UseGuards(AuthRateLimitGuard)
  csrf(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const current = request.cookies?.[CSRF_COOKIE_NAME];
    const csrfToken =
      typeof current === 'string' && /^[A-Za-z0-9_-]{43}$/.test(current)
        ? current
        : createCsrfToken();
    if (csrfToken !== current) this.setCsrfCookie(response, csrfToken);
    return { csrfToken };
  }

  @Post('register')
  @RateLimit({ key: 'ip', limit: 10, windowSeconds: 60 })
  @UseGuards(AuthRateLimitGuard)
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.authService.register(input);
    this.setSessionCookies(response, token);
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ key: 'ip', limit: 10, windowSeconds: 60 })
  @UseGuards(AuthRateLimitGuard)
  async login(
    @Body() input: CredentialsDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.authService.login(input);
    this.setSessionCookies(response, token);
    return { user };
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @RateLimit({ key: 'ip', limit: 120, windowSeconds: 60 })
  @UseGuards(SessionAuthGuard, AuthRateLimitGuard)
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.auth.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionAuthGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(request.auth.sessionId);
    response.clearCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS);
    response.clearCookie(CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS);
  }

  @Post('verify-email/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit({ key: 'user', limit: 3, windowSeconds: 300 })
  @UseGuards(SessionAuthGuard, AuthRateLimitGuard)
  async requestEmailVerification(
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.authService.requestEmailVerification(request.auth.user);
  }

  @Post('verify-email/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmEmail(@Body() input: TokenDto): Promise<void> {
    await this.authService.confirmEmail(input.token);
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit({ key: 'ip', limit: 5, windowSeconds: 60 })
  @UseGuards(AuthRateLimitGuard)
  async forgotPassword(@Body() input: ForgotPasswordDto): Promise<void> {
    await this.authService.requestPasswordReset(input.email);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ key: 'ip', limit: 10, windowSeconds: 60 })
  @UseGuards(AuthRateLimitGuard)
  async resetPassword(
    @Body() input: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.resetPassword(input.token, input.password);
    this.clearSessionCookies(response);
  }

  private setSessionCookies(response: Response, token: string): void {
    response.cookie(AUTH_COOKIE_NAME, token, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: SESSION_DURATION_SECONDS * 1_000,
    });
    this.setCsrfCookie(response, createCsrfToken());
  }

  private setCsrfCookie(response: Response, token: string): void {
    response.cookie(CSRF_COOKIE_NAME, token, {
      ...CSRF_COOKIE_OPTIONS,
      maxAge: SESSION_DURATION_SECONDS * 1_000,
    });
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS);
    response.clearCookie(CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS);
  }
}

@Controller('users/me')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Patch()
  @UseGuards(SessionAuthGuard)
  async updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() input: ProfileDto,
  ) {
    return {
      user: await this.authService.updateProfile(
        request.auth.user.id,
        input.displayName,
      ),
    };
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ key: 'user', limit: 5, windowSeconds: 300 })
  @UseGuards(SessionAuthGuard, AuthRateLimitGuard)
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() input: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.changePassword(
      request.auth.user.id,
      input.currentPassword,
      input.newPassword,
    );
    response.clearCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS);
    response.clearCookie(CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS);
  }

  @Get('sessions')
  @UseGuards(SessionAuthGuard)
  async sessions(@Req() request: AuthenticatedRequest) {
    return {
      items: await this.authService.listSessions(
        request.auth.user.id,
        request.auth.sessionId,
      ),
    };
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionAuthGuard)
  async revokeSession(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.authService.revokeSession(request.auth.user.id, id);
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionAuthGuard)
  async revokeOtherSessions(
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.authService.revokeOtherSessions(
      request.auth.user.id,
      request.auth.sessionId,
    );
  }
}
