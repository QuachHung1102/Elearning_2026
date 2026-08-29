import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
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
import type { Response } from 'express';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  CSRF_COOKIE_NAME,
  CSRF_COOKIE_OPTIONS,
  SESSION_DURATION_SECONDS,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { createCsrfToken, CsrfGuard } from './csrf.guard.js';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('csrf')
  @Header('Cache-Control', 'no-store')
  csrf(@Res({ passthrough: true }) response: Response) {
    const csrfToken = createCsrfToken();
    response.cookie(CSRF_COOKIE_NAME, csrfToken, {
      ...CSRF_COOKIE_OPTIONS,
      maxAge: SESSION_DURATION_SECONDS * 1_000,
    });
    return { csrfToken };
  }

  @Post('register')
  @UseGuards(CsrfGuard, AuthRateLimitGuard)
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
  @UseGuards(CsrfGuard, AuthRateLimitGuard)
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
  @UseGuards(SessionAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.auth.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard, SessionAuthGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(request.auth.sessionId);
    response.clearCookie(AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS);
    response.clearCookie(CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS);
  }

  private setSessionCookies(response: Response, token: string): void {
    response.cookie(AUTH_COOKIE_NAME, token, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: SESSION_DURATION_SECONDS * 1_000,
    });
    response.cookie(CSRF_COOKIE_NAME, createCsrfToken(), {
      ...CSRF_COOKIE_OPTIONS,
      maxAge: SESSION_DURATION_SECONDS * 1_000,
    });
  }
}
