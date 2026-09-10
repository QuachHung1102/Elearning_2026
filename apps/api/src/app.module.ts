import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { CsrfGuard } from './auth/csrf.guard.js';
import { config } from './config.js';
import { ContactModule } from './contact/contact.module.js';
import { DevModule } from './dev/dev.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    AuthModule,
    ContactModule,
    HealthModule,
    ...(config.mailDriver === 'demo' ? [DevModule] : []),
  ],
  providers: [{ provide: APP_GUARD, useClass: CsrfGuard }],
})
export class AppModule {}
