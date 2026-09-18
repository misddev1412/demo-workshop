export type Product = { id: string; name: string; price: number; image_url: string | null };
export type Cart = Record<string, number>;

// Public Data API requests intentionally use only the publishable key and bypass
// browser caches. RLS applies as anon; no privileged server credential is needed.
export async function fetchProducts({ id, signal, fetcher = fetch }: {
  id?: string; signal?: AbortSignal; fetcher?: typeof fetch;
} = {}): Promise<Product[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!base || !key) throw new Error('Thiếu Project URL hoặc publishable key trong .env.local.');
  if (!key.startsWith('sb_publishable_')) throw new Error('Cần dùng publishable key (sb_publishable_), không dùng secret key.');
  const url = new URL('/rest/v1/products', base);
  url.searchParams.set('select', 'id,name,price,image_url');
  url.searchParams.set('order', 'id.asc');
  if (id) url.searchParams.set('id', `eq.${id}`);
  const response = await fetcher(url, { headers: { apikey: key }, cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Không thể tải sản phẩm (HTTP ${response.status}). Vui lòng thử lại.`);
  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Number.isSafeInteger(p.price) && p.price >= 0 && (p.image_url === null || typeof p.image_url === 'string'))) {
    throw new Error('Dữ liệu sản phẩm không hợp lệ.');
  }
  return data;
}

export function restoreCart(saved: unknown, products: Product[]): Cart {
  const cart: Cart = {};
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return cart;
  for (const p of products) {
    const quantity = (saved as Record<string, unknown>)[p.id];
    if (typeof quantity === 'number' && Number.isInteger(quantity) && quantity > 0) cart[p.id] = Math.min(quantity, 99);
  }
  return cart;
}
