import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EnrollmentService } from './enrollment.service.js';

/**
 * Imports nothing that imports it back: Media and Learning depend on this
 * module for the access rule, so it must not reach for either of them.
 */
@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  providers: [EnrollmentService],
  exports: [EnrollmentService],
})
export class EnrollmentModule {}
