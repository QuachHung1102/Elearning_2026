import { HttpException } from '@nestjs/common';
import { config } from '../config.js';
import { DemoZaloPayClient } from './demo-zalopay.client.js';
import { zalopayMac } from './zalopay-signature.js';

const order = (over: Partial<{ appTransId: string; expiresAt: Date }> = {}) => ({
  appTransId: '260930_ab12cd34',
  appUser: 'user-1',
  amountVnd: 499_000,
  description: 'Khóa học demo',
  embedData: { courseId: 'course-1', purchaseId: 'purchase-1' },
  expiresAt: new Date(Date.now() + 15 * 60_000),
  ...over,
});

const statusOf = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return (error as HttpException).getStatus();
  }
  return null;
};

// DEMO_MODE.md §5: the demo client keeps its own Map and never reads the
// database, so a lost callback (Map says paid, database still PENDING) is a
// scenario the reconcile job can be tested against.
describe('DemoZaloPayClient', () => {
  it('makes an order the provider reports as still processing', async () => {
    const client = new DemoZaloPayClient();

    const created = await client.createOrder(order());

    expect(created.qrCode).toContain('260930_ab12cd34');
    expect(created.orderUrl).toContain('purchase-1');
    expect(await client.queryOrder('260930_ab12cd34')).toMatchObject({
      returnCode: 3,
    });
  });

  it('reports the payment with the provider transaction id and the amount once settled', async () => {
    const client = new DemoZaloPayClient();
    const input = order();
    await client.createOrder(input);

    client.settle(input.appTransId, { amountVnd: input.amountVnd, expiresAt: input.expiresAt });

    expect(await client.queryOrder(input.appTransId)).toMatchObject({
      returnCode: 1,
      amountVnd: 499_000,
      zpTransId: expect.stringMatching(/^demo-/),
    });
  });

  it('calls an order it never saw (an API restart wiped the Map) processing, not failed', async () => {
    const client = new DemoZaloPayClient();

    expect(await client.queryOrder('260930_00000000')).toMatchObject({
      returnCode: 3,
    });
  });

  it('will not settle a QR past its expiry, as the provider would not', () => {
    const client = new DemoZaloPayClient();
    const late = order({ expiresAt: new Date(Date.now() - 1_000) });

    expect(
      statusOf(() =>
        client.settle(late.appTransId, { amountVnd: 499_000, expiresAt: late.expiresAt }),
      ),
    ).toBe(409);
  });

  // The provider resends the same callback; a second press of the demo confirm
  // button must look the same, or "confirm twice, one enrollment" tests nothing.
  it('gives the same transaction id when settled twice, even after the QR has expired', () => {
    vi.useFakeTimers();
    try {
      const client = new DemoZaloPayClient();
      const expiresAt = new Date(Date.now() + 60_000);
      const first = client.settle('260930_ab12cd34', { amountVnd: 499_000, expiresAt });

      vi.advanceTimersByTime(120_000);

      expect(client.settle('260930_ab12cd34', { amountVnd: 499_000, expiresAt })).toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it('accepts a callback signed with key2 and refuses a forged one', () => {
    const client = new DemoZaloPayClient();
    const data = JSON.stringify({
      app_id: 1,
      app_trans_id: '260930_ab12cd34',
      app_time: 1,
      amount: 499_000,
      zp_trans_id: 'demo-1',
      embed_data: '{}',
      item: '[]',
    });

    expect(client.verifyCallback({ data, mac: zalopayMac(config.zalopayKey2, data) })).toMatchObject({
      app_trans_id: '260930_ab12cd34',
      amount: 499_000,
    });
    expect(() => client.verifyCallback({ data, mac: zalopayMac('another-key', data) })).toThrow();
    expect(() => client.verifyCallback({ data, mac: '' })).toThrow();
  });

  it('signs the callback it builds so it passes its own verification', () => {
    const client = new DemoZaloPayClient();

    const body = client.signCallback({
      appTransId: '260930_ab12cd34',
      amountVnd: 499_000,
      zpTransId: 'demo-9',
    });

    expect(client.verifyCallback(body)).toMatchObject({
      app_trans_id: '260930_ab12cd34',
      amount: 499_000,
      zp_trans_id: 'demo-9',
    });
  });
});
