import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { config } from '../config.js';
import { EnrollmentModule } from '../enrollment/enrollment.module.js';
import { LearningModule } from '../learning/learning.module.js';
import { MailModule } from '../mail/mail.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminPaymentController } from './admin-payment.controller.js';
import { AdminPurchaseController } from './admin-purchase.controller.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { DemoZaloPayClient } from './demo-zalopay.client.js';
import { PaymentCallbackController } from './payment-callback.controller.js';
import { PurchaseController } from './purchase.controller.js';
import { PurchaseService } from './purchase.service.js';
import { ReconcileService } from './reconcile.service.js';
import { ZaloPayHttpClient } from './zalopay-http.client.js';
import { ZALOPAY_CLIENT, type ZaloPayClient } from './zalopay.client.js';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    EnrollmentModule,
    LearningModule,
    MailModule,
  ],
  controllers: [
    CheckoutController,
    PurchaseController,
    AdminPaymentController,
    AdminPurchaseController,
    PaymentCallbackController,
  ],
  providers: [
    DemoZaloPayClient,
    {
      provide: ZALOPAY_CLIENT,
      inject: [DemoZaloPayClient],
      // `PAYMENT_DRIVER` decides, and config has already refused to boot a
      // real driver without its credentials. The demo client is still
      // registered on its own for the dev confirm route.
      useFactory: (demo: DemoZaloPayClient): ZaloPayClient =>
        config.paymentDriver === 'zalopay' ? new ZaloPayHttpClient() : demo,
    },
    CheckoutService,
    PurchaseService,
    ReconcileService,
  ],
  exports: [CheckoutService, PurchaseService, ReconcileService, DemoZaloPayClient],
})
export class CheckoutModule {}
