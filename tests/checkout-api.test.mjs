import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as server from '../lib/checkout-server.ts';
const payload = {
  idempotency_key: '26fbe13c-914f-44ad-b46d-b71c3ef450ef',
  recipient_name: 'Nguyễn An', recipient_phone: '0912345678',
  shipping_address: '12 Nguyễn Huệ, Quận 1, TP HCM',
  items: [{ product_id: '5f0d8013-edde-4003-96fa-4687e34de606', quantity: 2 }], expected_total: 190000,
};
const receipt = { id: payload.idempotency_key, subtotal: 160000, shipping_fee: 30000, total_amount: 190000, payment_method: 'cod', status: 'pending' };
const config = { baseUrl: 'https://example.supabase.co', secretKey: 'sb_secret_test' };
const req = (body = payload, headers = {}) => new Request('http://localhost:3000/api/orders', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
async function handle(request, fetcher, options = {}) {
  assert.equal(typeof server.handleCheckoutRequest, 'function');
  return server.handleCheckoutRequest(request, { ...config, fetcher, ...options });
}

test('POST invokes one atomic RPC with server credential and returns a private receipt', async () => {
  let calls = 0;
  const response = await handle(req(), async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://example.supabase.co/rest/v1/rpc/place_cod_order');
    assert.equal(init.headers.apikey, config.secretKey);
    assert.equal(init.cache, 'no-store');
    assert.deepEqual(JSON.parse(init.body), { p_request: payload });
    return Response.json(receipt);
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { order: receipt });
});

test('bad JSON, empty cart, foreign origin, content type and oversized bodies cannot reach the database', async () => {
  const cases = [[req('{'), 400], [req({ ...payload, items: [] }), 400],
    [req(payload, { origin: 'https://attacker.example' }), 403],
    [req(payload, { 'content-type': 'text/plain' }), 415],
    [req(' '.repeat(17000)), 413]];
  for (const [request, status] of cases) {
    const response = await handle(request, async () => assert.fail('must not call database'));
    assert.equal(response.status, status);
  }
});

test('safe database conflicts are actionable; infrastructure errors reveal no internals', async () => {
  for (const [message, code, status] of [
    ['PRICE_CHANGED', 'P0001', 409], ['IDEMPOTENCY_CONFLICT', 'P0001', 409],
    ['PRODUCT_UNAVAILABLE', 'P0001', 409], ['INVALID_CHECKOUT', 'P0001', 400],
    ['password sb_secret_test SQL table details', 'XX000', 503],
  ]) {
    const response = await handle(req(), async () => Response.json({ message, code }, { status: 400 }));
    assert.equal(response.status, status);
    const text = await response.text();
    assert.ok(!text.includes('sb_secret_test'));
    assert.ok(!text.includes('SQL table'));
  }
});

test('network failures, invalid upstream receipts, and missing configuration preserve failure semantics', async () => {
  for (const fetcher of [async () => { throw new Error('network'); }, async () => Response.json({}), async () => new Response('not json')]) {
    assert.equal((await handle(req(), fetcher)).status, 503);
  }
  assert.equal((await handle(req(), async () => assert.fail('must not fetch'), { secretKey: undefined })).status, 503);
});
