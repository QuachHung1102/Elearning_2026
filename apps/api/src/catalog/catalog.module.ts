import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EnrollmentController } from '../enrollment/enrollment.controller.js';
import { MediaModule } from '../media/media.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminCatalogController } from './admin-catalog.controller.js';
import { CatalogController } from './catalog.controller.js';
import { CategoryService } from './category.service.js';
import { CourseService } from './course.service.js';
import { CurriculumService } from './curriculum.service.js';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, MediaModule],
  // `GET /enrollments/me` renders `CourseCard`, which only this module can.
  controllers: [CatalogController, AdminCatalogController, EnrollmentController],
  providers: [CourseService, CurriculumService, CategoryService],
  exports: [CourseService],
})
export class CatalogModule {}
