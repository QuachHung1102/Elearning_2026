import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CsrfGuard } from './auth/csrf.guard.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { config } from './config.js';
import { ContactModule } from './contact/contact.module.js';
import { DevModule } from './dev/dev.module.js';
import { EnrollmentModule } from './enrollment/enrollment.module.js';
import { HealthModule } from './health/health.module.js';
import { LearningModule } from './learning/learning.module.js';
import { MediaModule } from './media/media.module.js';
import { ReportingModule } from './reporting/reporting.module.js';

const anyDemoDriver = [
  config.videoDriver,
  config.storageDriver,
  config.mailDriver,
  config.paymentDriver,
].includes('demo');

@Module({
  imports: [
    AuthModule,
    AdminModule,
    CatalogModule,
    CheckoutModule,
    EnrollmentModule,
    LearningModule,
    MediaModule,
    ReportingModule,
    ContactModule,
    HealthModule,
    ...(anyDemoDriver ? [DevModule] : []),
  ],
  providers: [{ provide: APP_GUARD, useClass: CsrfGuard }],
})
export class AppModule {}
