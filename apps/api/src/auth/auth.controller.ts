import {
  Body,
  Controller,
  Get,
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
import type { CookieOptions, Response } from 'express';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { JwtAuthGuard } from './auth.guard.js';
import type { AuthenticatedRequest } from './auth.guard.js';
import {
  AUTH_COOKIE_NAME,
  AuthService,
  SESSION_DURATION_SECONDS,
} from './auth.service.js';

class RegisterDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  displayName: string;
}

class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.authService.register(input);
    this.setCookie(response, token);
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthRateLimitGuard)
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.authService.login(input);
    this.setCookie(response, token);
    return { user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.auth.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(request.auth.sessionId);
    response.clearCookie(AUTH_COOKIE_NAME, COOKIE_OPTIONS);
  }

  private setCookie(response: Response, token: string): void {
    response.cookie(AUTH_COOKIE_NAME, token, {
      ...COOKIE_OPTIONS,
      maxAge: SESSION_DURATION_SECONDS * 1_000,
    });
  }
}
