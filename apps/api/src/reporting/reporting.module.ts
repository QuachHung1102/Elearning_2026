import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ReportingController } from './reporting.controller.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReportingController],
})
export class ReportingModule {}
