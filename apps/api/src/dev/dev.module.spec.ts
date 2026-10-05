import 'reflect-metadata';

// P4-5: a dev controller exists only while the driver it fakes is the demo one.
// The module is built at import time from `config`, so each case imports it
// again under its own environment. The first import transforms the whole
// controller graph, which took over 30 s on a busy machine; `beforeAll` pays
// that once under the hook timeout so no case races it.
describe('DevModule', { timeout: 30_000 }, () => {
  beforeAll(async () => {
    await import('./dev.module.js');
  }, 180_000);

  const REAL_ZALOPAY = {
    PAYMENT_DRIVER: 'zalopay',
    ZALOPAY_APP_ID: '2553',
    ZALOPAY_KEY1: 'key-one',
    ZALOPAY_KEY2: 'key-two',
    ZALOPAY_CALLBACK_URL: 'https://example.com/api/v1/payments/zalopay/callback',
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function controllers(env: Record<string, string>): Promise<string[]> {
    vi.resetModules();
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const { DevModule } = await import('./dev.module.js');
    const list = Reflect.getMetadata('controllers', DevModule) as { name: string }[];
    return list.map((controller) => controller.name).sort();
  }

  it('registers the mail and the payment controller when both drivers are demo', async () => {
    expect(await controllers({ MAIL_DRIVER: 'demo', PAYMENT_DRIVER: 'demo' })).toEqual([
      'DevMailController',
      'DevPaymentController',
    ]);
  });

  it('leaves the payment confirm route out when the payment driver is real (ROADMAP N4.4)', async () => {
    expect(await controllers({ MAIL_DRIVER: 'demo', ...REAL_ZALOPAY })).toEqual(['DevMailController']);
  });

  it('leaves the mail routes out when the mail driver is real', async () => {
    expect(await controllers({ MAIL_DRIVER: 'smtp', PAYMENT_DRIVER: 'demo' })).toEqual([
      'DevPaymentController',
    ]);
  });
});
