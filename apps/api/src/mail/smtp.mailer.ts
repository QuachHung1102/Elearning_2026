import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Mailer, MailMessage } from './mailer.js';

@Injectable()
export class SmtpMailer implements Mailer {
  async send(_message: MailMessage): Promise<void> {
    // ponytail: SMTP transport is a Phase 5 concern; add it when SMTP is enabled.
    throw new ServiceUnavailableException('SMTP delivery is not configured');
  }
}
