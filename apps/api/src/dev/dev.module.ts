import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CheckoutModule } from '../checkout/checkout.module.js';
import { config } from '../config.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DevMailController } from './dev-mail.controller.js';
import { DevPaymentController } from './dev-payment.controller.js';

const mail = config.mailDriver === 'demo';
const payment = config.paymentDriver === 'demo';

/**
 * Each controller exists only while the driver it fakes is the demo one
 * (P4-5): with a real driver the route is absent, not merely guarded.
 */
@Module({
  imports: [AuthModule, ...(payment ? [PrismaModule, CheckoutModule] : [])],
  controllers: [
    ...(mail ? [DevMailController] : []),
    ...(payment ? [DevPaymentController] : []),
  ],
})
export class DevModule {}
