import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminUserController } from './admin-user.controller.js';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [AdminUserController],
})
export class AdminModule {}
