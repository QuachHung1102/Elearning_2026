import { randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { appError, ERROR_CODE } from '../common/error-codes.js';
import { config } from '../config.js';
import type {
  CreateOrderInput,
  CreateOrderResult,
  QueryOrderResult,
  ZaloPayCallbackData,
  ZaloPayClient,
} from './zalopay.client.js';
import { parseSignedCallback, zalopayMac } from './zalopay-signature.js';

/** No `zpTransId` yet: still PENDING. Set: SUCCEEDED. Nothing else is modelled. */
type DemoOrder = { amountVnd: number; zpTransId?: string };

/**
 * The provider, in memory. It never reads the database: `queryOrder` answers
 * from its own Map so reconcile has something to disagree with (a callback
 * that never arrived is `settle` without `confirmPayment`).
 * ponytail: the Map dies with the process; a table only pays off when a
 * reconcile test must survive an API restart.
 */
@Injectable()
export class DemoZaloPayClient implements ZaloPayClient {
  private readonly orders = new Map<string, DemoOrder>();

  createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    this.orders.set(input.appTransId, { amountVnd: input.amountVnd });
    return Promise.resolve({
      // Not a scannable QR (DEMO_MODE.md §5): an admin confirms it by POST.
      qrCode: `${config.apiPublicUrl}/api/v1/dev/payments/${input.appTransId}/confirm`,
      orderUrl: `${config.webOrigin}/account/orders/${input.embedData.purchaseId}`,
      zpTransToken: randomBytes(8).toString('hex'),
    });
  }

  queryOrder(appTransId: string): Promise<QueryOrderResult> {
    const order = this.orders.get(appTransId);
    // An order this Map never saw (the API restarted) is "processing", not
    // failed: closing it as FAILED would throw away a payment that may exist.
    return Promise.resolve(
      order?.zpTransId
        ? {
            returnCode: 1,
            returnMessage: 'success',
            zpTransId: order.zpTransId,
            amountVnd: order.amountVnd,
          }
        : { returnCode: 3, returnMessage: 'processing' },
    );
  }

  /**
   * The customer paid. Amount and expiry come from the caller (the attempt row),
   * so a settle after an API restart works and a test can pass a wrong amount.
   * Returns the provider transaction id; the same one on every later call.
   */
  settle(
    appTransId: string,
    { amountVnd, expiresAt }: { amountVnd: number; expiresAt: Date },
  ): string {
    const settled = this.orders.get(appTransId)?.zpTransId;
    if (settled) return settled;
    if (expiresAt.getTime() <= Date.now()) {
      throw appError(
        HttpStatus.CONFLICT,
        ERROR_CODE.PAYMENT_EXPIRED,
        'The QR code has expired',
      );
    }
    const zpTransId = `demo-${randomBytes(6).toString('hex')}`;
    this.orders.set(appTransId, { amountVnd, zpTransId });
    return zpTransId;
  }

  /** The body the provider would POST to the callback URL, signed with key2. */
  signCallback(paid: {
    appTransId: string;
    amountVnd: number;
    zpTransId: string;
  }): { data: string; mac: string } {
    const data = JSON.stringify({
      app_id: Number(config.zalopayAppId) || 0,
      app_trans_id: paid.appTransId,
      app_time: Date.now(),
      amount: paid.amountVnd,
      zp_trans_id: paid.zpTransId,
      embed_data: '{}',
      item: '[]',
    } satisfies ZaloPayCallbackData);
    return { data, mac: zalopayMac(config.zalopayKey2, data) };
  }

  verifyCallback(body: { data: string; mac: string }): ZaloPayCallbackData {
    return parseSignedCallback(config.zalopayKey2, body);
  }
}
