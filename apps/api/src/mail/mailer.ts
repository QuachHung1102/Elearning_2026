import { logEvent } from '../common/logger.js';

export const MAILER = Symbol('MAILER');

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  tag: 'verify-email' | 'reset-password' | 'purchase-receipt' | 'contact';
};

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/**
 * For mail that follows a change already committed (a verification link, a
 * receipt): the mail server being down must not undo or fail the change. The
 * failure goes to stderr as one JSON line, and the caller carries on.
 */
export async function sendQuietly(
  mailer: Mailer,
  message: MailMessage,
): Promise<void> {
  try {
    await mailer.send(message);
  } catch (error) {
    logEvent(
      { evt: 'mail.send_failed', tag: message.tag, error: String(error) },
      'error',
    );
  }
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character]!,
  );
}
