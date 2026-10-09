import { createServer, type AddressInfo, type Server } from 'node:net';
import { SmtpMailer } from './smtp.mailer.js';

const smtp = vi.hoisted(() => ({ url: '' }));

vi.mock('../config.js', async (original) => {
  const actual = await original<typeof import('../config.js')>();
  return {
    ...actual,
    config: {
      ...actual.config,
      mailFrom: 'E-learning <no-reply@example.test>',
      get smtpUrl() {
        return smtp.url;
      },
    },
  };
});

// The smallest SMTP server nodemailer will talk to: no TLS, no AUTH.
function startSink(): Promise<{
  server: Server;
  port: number;
  messages: string[];
}> {
  const messages: string[] = [];
  const server = createServer((socket) => {
    let buffer = '';
    let inData = false;
    socket.write('220 sink ready\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      for (;;) {
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end === -1) return;
          messages.push(buffer.slice(0, end));
          buffer = buffer.slice(end + 5);
          inData = false;
          socket.write('250 queued\r\n');
          continue;
        }
        const eol = buffer.indexOf('\r\n');
        if (eol === -1) return;
        const verb = buffer.slice(0, 4).toUpperCase();
        buffer = buffer.slice(eol + 2);
        if (verb === 'DATA') {
          inData = true;
          socket.write('354 end with <CRLF>.<CRLF>\r\n');
        } else if (verb === 'QUIT') {
          socket.end('221 bye\r\n');
          return;
        } else {
          socket.write('250 ok\r\n');
        }
      }
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        server,
        port: (server.address() as AddressInfo).port,
        messages,
      }),
    ),
  );
}

const message = {
  to: 'learner@example.test',
  subject: 'Verify your email',
  html: '<p>Open <a href="http://localhost/verify?token=abc">this link</a></p>',
  text: 'Open http://localhost/verify?token=abc',
  tag: 'verify-email' as const,
};

describe('SmtpMailer', () => {
  it('delivers the message to the SMTP server in SMTP_URL', async () => {
    const sink = await startSink();
    try {
      smtp.url = `smtp://127.0.0.1:${sink.port}`;
      await new SmtpMailer().send(message);

      expect(sink.messages).toHaveLength(1);
      const [raw] = sink.messages;
      expect(raw).toMatch(/^From: "E-learning" <no-reply@example\.test>\r\n/);
      expect(raw).toContain('\r\nTo: learner@example.test\r\n');
      expect(raw).toContain('\r\nSubject: Verify your email\r\n');
      expect(raw).toContain(message.text);
      expect(raw).toContain(message.html);
    } finally {
      await new Promise((resolve) => sink.server.close(resolve));
    }
  });

  it('rejects when the SMTP server refuses the connection', async () => {
    const sink = await startSink();
    await new Promise((resolve) => sink.server.close(resolve));
    smtp.url = `smtp://127.0.0.1:${sink.port}`;

    await expect(new SmtpMailer().send(message)).rejects.toThrow(
      /ECONNREFUSED/,
    );
  });
});
