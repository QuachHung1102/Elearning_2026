import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { config } from '../config.js';
import { MailModule } from '../mail/mail.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminGuard } from './admin.guard.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { AuthController, UsersController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthTokenService } from './auth-token.service.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { StaffGuard } from './staff.guard.js';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    JwtModule.register({
      secret: config.jwtSecret,
      signOptions: { algorithm: 'HS256' },
      verifyOptions: { algorithms: ['HS256'] },
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    AuthTokenService,
    SessionAuthGuard,
    AdminGuard,
    AuthRateLimitGuard,
    StaffGuard,
  ],
  exports: [AuthService, SessionAuthGuard, AdminGuard, AuthRateLimitGuard, StaffGuard],
})
export class AuthModule {}
