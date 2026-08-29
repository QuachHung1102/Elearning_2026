import 'dotenv/config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { AuthController } from './auth.controller.js';
import { JwtAuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

const jwtSecret = process.env.AUTH_JWT_SECRET;

if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) {
  throw new Error('AUTH_JWT_SECRET must contain at least 32 bytes');
}

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { algorithm: 'HS256' },
      verifyOptions: { algorithms: ['HS256'] },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AuthRateLimitGuard],
})
export class AuthModule {}
