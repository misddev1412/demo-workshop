import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as checkout from '../lib/checkout.ts';
export const request = {
  idempotency_key: '26fbe13c-914f-44ad-b46d-b71c3ef450ef',
  recipient_name: '  Nguyễn An  ', recipient_phone: '+84 912 345 678',
  shipping_address: '  12 Nguyễn Huệ, Quận 1, TP HCM  ',
  items: [{ product_id: '5f0d8013-edde-4003-96fa-4687e34de606', quantity: 2 }],
  expected_total: 190000,
};

test('normalizes recipient data and accepts only quantities, never client prices', () => {
  assert.equal(typeof checkout.parseCheckoutRequest, 'function');
  const result = checkout.parseCheckoutRequest({ ...request, total_amount: 1, items: [{ ...request.items[0], unit_price: 1 }] });
  assert.equal(result.recipient_name, 'Nguyễn An');
  assert.equal(result.recipient_phone, '0912345678');
  assert.equal(result.shipping_address, '12 Nguyễn Huệ, Quận 1, TP HCM');
  assert.deepEqual(result.items, request.items);
  assert.equal(result.total_amount, undefined);
});

test('rejects malformed requests before any order is attempted', () => {
  assert.equal(typeof checkout.parseCheckoutRequest, 'function');
  for (const bad of [null, [], {},
    { ...request, recipient_name: ' ' }, { ...request, recipient_name: 'a'.repeat(101) },
    { ...request, recipient_phone: '123' }, { ...request, shipping_address: 'abc' },
    { ...request, idempotency_key: 'not-a-uuid' }, { ...request, expected_total: -1 },
    { ...request, expected_total: Number.MAX_SAFE_INTEGER + 1 }, { ...request, items: [] },
    { ...request, items: Array(51).fill(request.items[0]) },
    { ...request, items: [...request.items, ...request.items] },
    ...[0, -1, 1.5, 100, '2', Infinity].map(quantity => ({ ...request, items: [{ ...request.items[0], quantity }] })),
    { ...request, items: [{ product_id: 'bad', quantity: 1 }] },
  ]) assert.throws(() => checkout.parseCheckoutRequest(bad), checkout.CheckoutError);
});

test('shipping is 30,000 below 499,000 and free at the threshold', () => {
  assert.equal(typeof checkout.shippingFee, 'function');
  assert.equal(checkout.shippingFee(498999), 30000);
  assert.equal(checkout.shippingFee(499000), 0);
  assert.equal(checkout.shippingFee(700000), 0);
});

test('does not accept a malformed success response that would clear the cart', () => {
  assert.equal(typeof checkout.parseOrderReceipt, 'function');
  const receipt = { id: request.idempotency_key, subtotal: 160000, shipping_fee: 30000, total_amount: 190000, payment_method: 'cod', status: 'pending' };
  assert.deepEqual(checkout.parseOrderReceipt(receipt), receipt);
  for (const bad of [null, {}, { ...receipt, id: '' }, { ...receipt, total_amount: 1 }, { ...receipt, subtotal: '160000' }, { ...receipt, payment_method: 'card' }]) {
    assert.throws(() => checkout.parseOrderReceipt(bad));
  }
});

test('an uncertain retry keeps its original key and total even after catalog prices change', async () => {
  assert.equal(typeof checkout.resolveCheckoutAttempt, 'function');
  const original = checkout.parseCheckoutRequest(request);
  const first = await checkout.resolveCheckoutAttempt(original, null);
  const reloaded = { ...original, idempotency_key: '36fbe13c-914f-44ad-b46d-b71c3ef450ef', expected_total: 250000 };
  const retry = await checkout.resolveCheckoutAttempt(reloaded, JSON.parse(JSON.stringify(first)));
  assert.deepEqual(retry, first);
  assert.equal(retry.expectedTotal, 190000);
  const changed = await checkout.resolveCheckoutAttempt({ ...reloaded, recipient_name: 'Another customer' }, first);
  assert.notEqual(changed.key, first.key);
  assert.equal(changed.expectedTotal, 250000);
  const corrupt = await checkout.resolveCheckoutAttempt(reloaded, { ...first, key: 'bad' });
  assert.equal(corrupt.key, reloaded.idempotency_key);
});
