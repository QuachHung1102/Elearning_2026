import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import type { Mailer, MailMessage } from './mailer.js';

@Injectable()
export class SmtpMailer implements Mailer {
  private readonly transport = nodemailer.createTransport(config.smtpUrl);

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: config.mailFrom,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
