import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { EnrollmentModule } from '../enrollment/enrollment.module.js';
import { MediaModule } from '../media/media.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LearningController } from './learning.controller.js';
import { ProgressService } from './progress.service.js';

@Module({
  imports: [PrismaModule, AuthModule, EnrollmentModule, CatalogModule, MediaModule],
  controllers: [LearningController],
  providers: [ProgressService],
})
export class LearningModule {}
