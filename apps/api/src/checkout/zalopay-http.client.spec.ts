import { ZaloPayHttpClient } from './zalopay-http.client.js';
import { zalopayMac } from './zalopay-signature.js';

// The formulas come from the ZaloPay docs (specs/order-create, order-query). The
// two MACs below were computed once with `openssl dgst -sha256 -hmac`, not with
// this code, so the client cannot pass by agreeing with itself:
//   create: HMAC(key1, "app_id|app_trans_id|app_user|amount|app_time|embed_data|item")
//   query:  HMAC(key1, "app_id|app_trans_id|key1")
const KEY1 = 'test-key1-fixed';
const KEY2 = 'test-key2-fixed';
const CREATE_MAC = 'ee7a8a3833dfbdf5983fdfeaa0afb1ebdf32a0374dd8640653db3a6a4364f160';
const QUERY_MAC = 'aeae399e7c8e172df5f78584dee65c7f49d4bdf3a43667727a4688a64ea8c413';

const NOW = 1_788_076_800_000;
const settings = {
  appId: '2553',
  key1: KEY1,
  key2: KEY2,
  endpoint: 'https://sb-openapi.zalopay.vn/v2/',
  callbackUrl: 'https://shop.example.com/api/v1/payments/zalopay/callback',
};

const order = {
  appTransId: '260930_ab12cd34',
  appUser: '3f2b8c1e-0000-4000-8000-000000000001',
  amountVnd: 499_000,
  description: 'Thanh toán khóa học Figma',
  embedData: { courseId: 'course-1', purchaseId: 'purchase-1' },
  expiresAt: new Date(NOW + 900_000),
};

/** A stand-in for `fetch` that records the call and answers with `body`. */
function fakeHttp(body: unknown, init: { status?: number; text?: string } = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const http = (async (url: string, requestInit: RequestInit) => {
    calls.push({ url, init: requestInit });
    return new Response(init.text ?? JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { http, calls };
}

const sent = (calls: { init: RequestInit }[]) => JSON.parse(String(calls[0].init.body));

describe('ZaloPayHttpClient.createOrder', () => {
  const ok = {
    return_code: 1,
    return_message: 'Giao dịch thành công',
    zp_trans_token: 'token-1',
    order_url: 'https://qcgateway.zalopay.vn/openinapp?order=abc',
    qr_code: '00020101021226...6304ABCD',
  };

  it('posts the order with the documented MAC and returns the QR the provider sent', async () => {
    const { http, calls } = fakeHttp(ok);
    const client = new ZaloPayHttpClient(settings, http, () => NOW);

    const created = await client.createOrder(order);

    expect(created).toEqual({
      qrCode: ok.qr_code,
      orderUrl: ok.order_url,
      zpTransToken: 'token-1',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://sb-openapi.zalopay.vn/v2/create');
    expect(calls[0].init.method).toBe('POST');
    expect(sent(calls)).toEqual({
      app_id: 2553,
      app_user: order.appUser,
      app_trans_id: '260930_ab12cd34',
      app_time: NOW,
      amount: 499_000,
      description: 'Thanh toán khóa học Figma',
      item: '[]',
      embed_data: '{"courseId":"course-1","purchaseId":"purchase-1"}',
      callback_url: settings.callbackUrl,
      expire_duration_seconds: 900,
      mac: CREATE_MAC,
    });
  });

  it('signs with key1 over exactly the seven documented fields', () => {
    const input = `2553|${order.appTransId}|${order.appUser}|499000|${NOW}|{"courseId":"course-1","purchaseId":"purchase-1"}|[]`;
    expect(zalopayMac(KEY1, input)).toBe(CREATE_MAC);
  });

  it('never asks for a shorter life than the provider allows', async () => {
    const { http, calls } = fakeHttp(ok);
    const client = new ZaloPayHttpClient(settings, http, () => NOW);

    await client.createOrder({ ...order, expiresAt: new Date(NOW + 60_000) });

    expect(sent(calls).expire_duration_seconds).toBe(300);
  });

  it.each([
    // Even one that still carries a QR: only return_code 1 means the order exists.
    [
      'a refusal',
      { ...ok, return_code: -1, return_message: 'Invalid app_trans_id', sub_return_message: 'bad id' },
      {},
    ],
    ['a QR-less answer', { return_code: 1, return_message: 'ok', order_url: ok.order_url }, {}],
    ['an HTTP error', {}, { status: 502, text: 'Bad gateway' }],
    ['a body that is not JSON', {}, { text: '<html>' }],
  ])('throws on %s, so checkout keeps the order and reconcile can find it', async (_label, body, init) => {
    const { http } = fakeHttp(body, init);
    const client = new ZaloPayHttpClient(settings, http, () => NOW);

    await expect(client.createOrder(order)).rejects.toThrow();
  });

  it('does not leak the credentials into the error', async () => {
    const { http } = fakeHttp({ return_code: -1, return_message: 'refused' });
    const client = new ZaloPayHttpClient(settings, http, () => NOW);

    const error = await client.createOrder(order).catch((caught: Error) => caught);

    expect(String(error)).not.toContain(KEY1);
    expect(String(error)).not.toContain(KEY2);
  });
});

describe('ZaloPayHttpClient.queryOrder', () => {
  it('asks with the documented MAC', async () => {
    const { http, calls } = fakeHttp({ return_code: 3, return_message: 'processing', is_processing: true });
    const client = new ZaloPayHttpClient(settings, http, () => NOW);

    await client.queryOrder('260930_ab12cd34');

    expect(calls[0].url).toBe('https://sb-openapi.zalopay.vn/v2/query');
    expect(sent(calls)).toEqual({ app_id: 2553, app_trans_id: '260930_ab12cd34', mac: QUERY_MAC });
  });

  it('reads a payment with the provider transaction id and the amount actually received', async () => {
    const { http } = fakeHttp({ return_code: 1, return_message: 'ok', zp_trans_id: 250930000000001, amount: 499000 });
    const client = new ZaloPayHttpClient(settings, http, () => NOW);

    expect(await client.queryOrder('260930_ab12cd34')).toEqual({
      returnCode: 1,
      returnMessage: 'ok',
      zpTransId: '250930000000001',
      amountVnd: 499_000,
    });
  });

  it.each([
    [2, 'failed'],
    [3, 'processing'],
  ] as const)('passes return_code %s through without inventing a payment', async (code, message) => {
    const { http } = fakeHttp({ return_code: code, return_message: message });
    const client = new ZaloPayHttpClient(settings, http, () => NOW);

    expect(await client.queryOrder('260930_ab12cd34')).toEqual({ returnCode: code, returnMessage: message });
  });

  it.each([
    ['a code it does not know', { return_code: -49, return_message: 'invalid mac' }],
    ['a success without a transaction id', { return_code: 1, return_message: 'ok', amount: 499000 }],
    ['a success without an amount', { return_code: 1, return_message: 'ok', zp_trans_id: 1 }],
  ])('throws on %s instead of guessing', async (_label, body) => {
    const { http } = fakeHttp(body);
    const client = new ZaloPayHttpClient(settings, http, () => NOW);

    await expect(client.queryOrder('260930_ab12cd34')).rejects.toThrow();
  });
});

describe('ZaloPayHttpClient.verifyCallback', () => {
  const data = JSON.stringify({
    app_id: 2553,
    app_trans_id: '260930_ab12cd34',
    app_time: NOW,
    amount: 499_000,
    zp_trans_id: '250930000000001',
    embed_data: '{}',
    item: '[]',
  });

  it('verifies with key2, not key1', () => {
    const client = new ZaloPayHttpClient(settings, fakeHttp({}).http, () => NOW);

    expect(client.verifyCallback({ data, mac: zalopayMac(KEY2, data) })).toMatchObject({
      app_trans_id: '260930_ab12cd34',
      amount: 499_000,
    });
    expect(() => client.verifyCallback({ data, mac: zalopayMac(KEY1, data) })).toThrow();
  });
});
