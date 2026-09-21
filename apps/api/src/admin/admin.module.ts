import { Module } from '@nestjs/common';
import { AdminAuditController } from '../audit/admin-audit.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AdminEnrollmentController } from '../enrollment/admin-enrollment.controller.js';
import { EnrollmentModule } from '../enrollment/enrollment.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminUserController } from './admin-user.controller.js';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, EnrollmentModule],
  controllers: [
    AdminUserController,
    AdminAuditController,
    AdminEnrollmentController,
  ],
})
export class AdminModule {}
