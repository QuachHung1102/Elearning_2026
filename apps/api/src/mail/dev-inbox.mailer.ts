import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { config } from '../config.js';
import type { Mailer, MailMessage } from './mailer.js';

const LINK = /https?:\/\/[^"'\s<>]*[?&]token=[A-Za-z0-9._~-]+/;

@Injectable()
export class DevInboxMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    const at = new Date();
    const link = message.html.match(LINK)?.[0] ?? null;
    const log = {
      evt: 'mail.sent',
      tag: message.tag,
      to: message.to,
      subject: message.subject,
      link,
      at: at.toISOString(),
    };

    process.stdout.write(`${JSON.stringify(log)}\n`);
    if (
      !link &&
      message.tag !== 'contact' &&
      message.tag !== 'purchase-receipt'
    ) {
      process.stderr.write(
        `${JSON.stringify({ ...log, level: 'warn', evt: 'mail.link_missing' })}\n`,
      );
    }

    try {
      const directory = resolve(config.localMailDir);
      await mkdir(directory, { recursive: true });
      const id = `${Date.now()}-${randomBytes(6).toString('hex')}`;
      const headers = [
        `From: ${this.header(config.mailFrom)}`,
        `To: ${this.header(message.to)}`,
        `Subject: ${this.header(message.subject)}`,
        `Date: ${at.toUTCString()}`,
        `X-Elearning-Tag: ${message.tag}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
      ];
      await writeFile(
        resolve(directory, `${id}.eml`),
        `${headers.join('\r\n')}\r\n\r\n${message.html}`,
        'utf8',
      );
    } catch (error) {
      process.stderr.write(
        `${JSON.stringify({ evt: 'mail.write_failed', error: String(error) })}\n`,
      );
    }
  }

  private header(value: string): string {
    return value.replace(/[\r\n]/g, ' ');
  }
}
