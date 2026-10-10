import { macMatches, zalopayMac } from './zalopay-signature.js';

// A fixed vector, so a change of algorithm or encoding fails here and not
// against a merchant sandbox: HMAC-SHA256 over the exact `data` string, hex.
const KEY2 = 'demo-key2-fixed-for-tests';
const DATA =
  '{"app_id":2553,"app_trans_id":"260930_ab12cd34","app_time":1788076800000,"amount":499000,"zp_trans_id":"250930000000001","embed_data":"{}","item":"[]"}';
const MAC = '10aa9e05907a0b42e4d4641b48fd6d2e2a149723c982a0e321643cd0ee03ec10';

describe('zalopay signature', () => {
  it('signs data with HMAC-SHA256 as lowercase hex', () => {
    expect(zalopayMac(KEY2, DATA)).toBe(MAC);
  });

  it('accepts the right MAC', () => {
    expect(macMatches(KEY2, DATA, MAC)).toBe(true);
  });

  it('rejects a MAC that differs by one character', () => {
    const flipped = `${MAC.slice(0, -1)}${MAC.endsWith('0') ? '1' : '0'}`;
    expect(macMatches(KEY2, DATA, flipped)).toBe(false);
  });

  it('rejects the right MAC over changed data, the wrong key, and malformed input', () => {
    expect(macMatches(KEY2, DATA.replace('499000', '1000'), MAC)).toBe(false);
    expect(macMatches('another-key', DATA, MAC)).toBe(false);
    expect(macMatches(KEY2, DATA, '')).toBe(false);
    expect(macMatches(KEY2, DATA, 'not-hex')).toBe(false);
    expect(macMatches(KEY2, DATA, MAC.toUpperCase())).toBe(false);
  });
});
