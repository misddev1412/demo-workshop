-- Run separately as project owner. Repeatable; never overwrites existing rows.
-- Unsplash images are illustrative; see docs/catalog/products-2026-09-18.json.
begin;
lock table public.products in share row exclusive mode;
insert into public.products (name, price, image_url)
select seed.name, seed.price, seed.image_url
from (values
  ('túi vải', 'Túi tote vải Everyday', 80000::bigint, 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1000&q=85'),
  ('sổ tay', 'Sổ tay lò xo The Little Things', 45000::bigint, 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=1000&q=85'),
  ('bình nước', 'Bình nước Daily xanh lá', 120000::bigint, 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1000&q=85'),
  ('sticker', 'Sticker trang trí Color Stories', 20000::bigint, 'https://images.unsplash.com/photo-1625768376503-68d2495d78c5?auto=format&fit=crop&w=1000&q=85'),
  ('hộp bút', 'Hộp bút vải khóa kéo Everyday', 55000::bigint, 'https://images.unsplash.com/photo-1632822300275-9867abf24bbe?auto=format&fit=crop&w=1000&q=85'),
  ('bút bi', 'Bút bi đen Minimal', 15000::bigint, 'https://images.unsplash.com/photo-1597754255094-6f952470f88a?auto=format&fit=crop&w=1000&q=85')
) as seed(old_name, name, price, image_url)
where not exists (
  select 1 from public.products p
  where lower(btrim(p.name)) in (lower(seed.old_name), lower(seed.name))
);
commit;
