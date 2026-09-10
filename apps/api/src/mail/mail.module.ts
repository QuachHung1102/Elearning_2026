import { Module } from '@nestjs/common';
import { config } from '../config.js';
import { DevInboxMailer } from './dev-inbox.mailer.js';
import { MAILER } from './mailer.js';
import { SmtpMailer } from './smtp.mailer.js';

@Module({
  providers: [
    {
      provide: MAILER,
      useClass: config.mailDriver === 'smtp' ? SmtpMailer : DevInboxMailer,
    },
  ],
  exports: [MAILER],
})
export class MailModule {}
