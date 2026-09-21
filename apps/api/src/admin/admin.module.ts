import { Module } from '@nestjs/common';
import { AdminAuditController } from '../audit/admin-audit.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminUserController } from './admin-user.controller.js';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [AdminUserController, AdminAuditController],
})
export class AdminModule {}
