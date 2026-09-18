import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchProducts, restoreCart } from '../lib/products.ts';

const product = { id: '5f0d8013-edde-4003-96fa-4687e34de606', name: 'túi vải', price: 80000, image_url: null };
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

test('reads real rows without cache and filters detail by UUID', async () => {
  const rows = await fetchProducts({ id: product.id, fetcher: async (url, init) => {
    assert.equal(new URL(url).searchParams.get('id'), `eq.${product.id}`);
    assert.equal(init.cache, 'no-store');
    assert.deepEqual(init.headers, { apikey: 'sb_publishable_test' });
    return Response.json([product]);
  }});
  assert.deepEqual(rows, [product]);
});
test('keeps an empty response empty', async () => {
  assert.deepEqual(await fetchProducts({ fetcher: async () => Response.json([]) }), []);
});
test('rejects query and network failures instead of inventing products', async () => {
  await assert.rejects(fetchProducts({ fetcher: async () => Response.json({ message: 'denied' }, { status: 403 }) }), /403/);
  await assert.rejects(fetchProducts({ fetcher: async () => { throw new Error('offline'); } }), /offline/);
});
test('rejects invalid prices', async () => {
  await assert.rejects(fetchProducts({ fetcher: async () => Response.json([{ ...product, price: 'bad' }]) }));
});
test('restores only available UUIDs and safe quantities', () => {
  assert.deepEqual(restoreCart({ 1: 2, deleted: 3, [product.id]: 120 }, [product]), { [product.id]: 99 });
  assert.deepEqual(restoreCart({ [product.id]: -1 }, [product]), {});
  assert.deepEqual(restoreCart(null, [product]), {});
});
test('missing configuration is an error and never makes a request', async () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    await assert.rejects(fetchProducts({ fetcher: async () => { assert.fail('must not fetch'); } }), /Thiếu/);
  } finally { process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key; }
});
