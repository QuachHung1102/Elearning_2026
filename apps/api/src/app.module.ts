import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CsrfGuard } from './auth/csrf.guard.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { config } from './config.js';
import { ContactModule } from './contact/contact.module.js';
import { DevModule } from './dev/dev.module.js';
import { EnrollmentModule } from './enrollment/enrollment.module.js';
import { HealthModule } from './health/health.module.js';
import { MediaModule } from './media/media.module.js';
import { ReportingModule } from './reporting/reporting.module.js';

@Module({
  imports: [
    AuthModule,
    AdminModule,
    CatalogModule,
    EnrollmentModule,
    MediaModule,
    ReportingModule,
    ContactModule,
    HealthModule,
    ...(config.mailDriver === 'demo' ? [DevModule] : []),
  ],
  providers: [{ provide: APP_GUARD, useClass: CsrfGuard }],
})
export class AppModule {}
