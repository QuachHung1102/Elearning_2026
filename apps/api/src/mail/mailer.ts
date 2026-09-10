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
