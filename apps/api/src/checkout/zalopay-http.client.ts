import { config } from '../config.js';
import type {
  CreateOrderInput,
  CreateOrderResult,
  QueryOrderResult,
  ZaloPayCallbackData,
  ZaloPayClient,
} from './zalopay.client.js';
import { parseSignedCallback, zalopayMac } from './zalopay-signature.js';

export type ZaloPaySettings = {
  appId: string;
  key1: string;
  key2: string;
  endpoint: string;
  callbackUrl: string;
};

const TIMEOUT_MS = 10_000;
/** The provider refuses an order that lives less than 5 minutes. */
const MIN_EXPIRE_SECONDS = 300;

/**
 * The real provider, over HTTPS (docs.zalopay.vn: order-create, order-query).
 * Not a Nest provider: the module builds it, so the settings and the two
 * ambient dependencies (`fetch`, the clock) are plain constructor arguments
 * that a test replaces.
 *
 * Every failure throws. A refusal, a timeout or a body it cannot read must not
 * be turned into a QR or into "paid": checkout keeps the order (the row
 * exists before this call) and reconcile finds it by `app_trans_id`.
 */
export class ZaloPayHttpClient implements ZaloPayClient {
  constructor(
    private readonly settings: ZaloPaySettings = {
      appId: config.zalopayAppId,
      key1: config.zalopayKey1,
      key2: config.zalopayKey2,
      endpoint: config.zalopayEndpoint,
      callbackUrl: config.zalopayCallbackUrl,
    },
    private readonly http: typeof fetch = fetch,
    private readonly clock: () => number = Date.now,
  ) {}

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const { appId, key1, callbackUrl } = this.settings;
    const appTime = this.clock();
    const fields = {
      app_id: Number(appId),
      app_user: input.appUser,
      app_trans_id: input.appTransId,
      app_time: appTime,
      amount: input.amountVnd,
      description: input.description,
      item: '[]',
      // Echoed back in the callback; the provider only needs it to be a JSON string.
      embed_data: JSON.stringify(input.embedData),
      callback_url: callbackUrl,
      expire_duration_seconds: Math.max(
        MIN_EXPIRE_SECONDS,
        Math.round((input.expiresAt.getTime() - appTime) / 1_000),
      ),
    };
    // Exactly the seven fields and the order the docs give, joined by "|".
    const mac = zalopayMac(
      key1,
      [
        fields.app_id,
        fields.app_trans_id,
        fields.app_user,
        fields.amount,
        fields.app_time,
        fields.embed_data,
        fields.item,
      ].join('|'),
    );

    const body = await this.post('/create', { ...fields, mac });
    if (body.return_code !== 1) {
      throw new Error(
        `ZaloPay refused the order: ${String(body.return_code)} ${String(body.return_message)} ${String(body.sub_return_message ?? '')}`.trim(),
      );
    }
    if (typeof body.qr_code !== 'string' || typeof body.order_url !== 'string') {
      throw new Error('ZaloPay accepted the order but sent no QR code');
    }
    return {
      qrCode: body.qr_code,
      orderUrl: body.order_url,
      zpTransToken: String(body.zp_trans_token ?? ''),
    };
  }

  async queryOrder(appTransId: string): Promise<QueryOrderResult> {
    const { appId, key1 } = this.settings;
    const mac = zalopayMac(key1, `${appId}|${appTransId}|${key1}`);
    const body = await this.post('/query', {
      app_id: Number(appId),
      app_trans_id: appTransId,
      mac,
    });
    const returnMessage = String(body.return_message ?? '');
    switch (body.return_code) {
      case 1:
        // A payment without its id and amount is not a payment we can book.
        if (body.zp_trans_id === undefined || typeof body.amount !== 'number') {
          throw new Error('ZaloPay reported a payment without an id or amount');
        }
        return {
          returnCode: 1,
          returnMessage,
          zpTransId: String(body.zp_trans_id),
          amountVnd: body.amount,
        };
      case 2:
        return { returnCode: 2, returnMessage };
      case 3:
        return { returnCode: 3, returnMessage };
      default:
        // -49 (bad MAC), throttling, maintenance…: none of them says anything
        // about this order, so none may be read as "still processing".
        throw new Error(
          `ZaloPay query answered ${String(body.return_code)} ${returnMessage}`.trim(),
        );
    }
  }

  verifyCallback(body: { data: string; mac: string }): ZaloPayCallbackData {
    return parseSignedCallback(this.settings.key2, body);
  }

  private async post(
    path: string,
    payload: object,
  ): Promise<Record<string, unknown>> {
    const url = `${this.settings.endpoint.replace(/\/$/, '')}${path}`;
    const response = await this.http(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`ZaloPay ${path} answered HTTP ${response.status}`);
    }
    const body: unknown = await response.json().catch(() => null);
    if (typeof body !== 'object' || body === null) {
      throw new Error(`ZaloPay ${path} answered with something that is not JSON`);
    }
    return body as Record<string, unknown>;
  }
}
