-- Existing orders remain valid; new guest orders are written only through the
-- server-only RPC. No new anonymous/authenticated table privileges or policies.
alter table public.orders
  add column checkout_key uuid unique,
  add column checkout_fingerprint text,
  add column shipping_fee bigint not null default 0 check (shipping_fee >= 0),
  add column payment_method text not null default 'cod' check (payment_method = 'cod');

create function public.place_cod_order(p_request jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key uuid;
  v_name text;
  v_phone text;
  v_address text;
  v_items jsonb;
  v_priced_items jsonb;
  v_fingerprint text;
  v_expected numeric;
  v_subtotal numeric;
  v_shipping bigint;
  v_order public.orders%rowtype;
  v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'INVALID_CHECKOUT';
  end if;
  if jsonb_typeof(p_request->'idempotency_key') is distinct from 'string'
    or lower(p_request->>'idempotency_key') !~ v_uuid_pattern
    or jsonb_typeof(p_request->'recipient_name') is distinct from 'string'
    or jsonb_typeof(p_request->'recipient_phone') is distinct from 'string'
    or jsonb_typeof(p_request->'shipping_address') is distinct from 'string'
    or jsonb_typeof(p_request->'expected_total') is distinct from 'number'
    or jsonb_typeof(p_request->'items') is distinct from 'array' then
    raise exception 'INVALID_CHECKOUT';
  end if;
  v_key := (p_request->>'idempotency_key')::uuid;
  v_name := btrim(p_request->>'recipient_name');
  v_phone := p_request->>'recipient_phone';
  v_address := btrim(p_request->>'shipping_address');
  v_expected := (p_request->>'expected_total')::numeric;
  v_items := p_request->'items';
  if length(v_name) not between 2 and 100 or length(v_address) not between 10 and 500
    or v_phone !~ '^0[35789][0-9]{8}$'
    or v_expected < 0 or v_expected > 9007199254740991 or trunc(v_expected) <> v_expected
    or jsonb_array_length(v_items) not between 1 and 50 then
    raise exception 'INVALID_CHECKOUT';
  end if;
  if exists (select 1 from jsonb_array_elements(v_items) as t(item)
    where jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item->'product_id') is distinct from 'string'
      or lower(item->>'product_id') !~ v_uuid_pattern
      or jsonb_typeof(item->'quantity') is distinct from 'number') then
    raise exception 'INVALID_CHECKOUT';
  end if;
  if exists (select 1 from jsonb_array_elements(v_items) as t(item)
    where (item->>'quantity')::numeric not between 1 and 99
      or trunc((item->>'quantity')::numeric) <> (item->>'quantity')::numeric)
    or (select count(distinct lower(item->>'product_id')) from jsonb_array_elements(v_items) as t(item)) <> jsonb_array_length(v_items) then
    raise exception 'INVALID_CHECKOUT';
  end if;

  -- Canonical quantities/IDs prevent object ordering or client-supplied prices
  -- from changing replay identity. This hash is never a public lookup token.
  select jsonb_agg(jsonb_build_object('product_id', (item->>'product_id')::uuid,
    'quantity', (item->>'quantity')::integer) order by (item->>'product_id')::uuid)
    into v_items from jsonb_array_elements(v_items) as t(item);
  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'recipient_name', v_name, 'recipient_phone', v_phone, 'shipping_address', v_address,
    'items', v_items, 'expected_total', v_expected)::text, 'UTF8')), 'hex');

  -- Serializes identical keys across concurrent requests and app instances.
  perform pg_advisory_xact_lock(hashtextextended(v_key::text, 0));
  select * into v_order from public.orders where checkout_key = v_key;
  if found then
    if v_order.checkout_fingerprint is distinct from v_fingerprint then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
  else
    -- Lock in UUID order so prices cannot change between calculation and insert.
    select jsonb_agg(to_jsonb(priced)), sum(priced.price::numeric * priced.quantity)
      into v_priced_items, v_subtotal
    from (
      select p.id, p.price, item.quantity
      from jsonb_to_recordset(v_items) as item(product_id uuid, quantity integer)
      join public.products p on p.id = item.product_id
      order by p.id
      for share of p
    ) priced;
    if v_priced_items is null or jsonb_array_length(v_priced_items) <> jsonb_array_length(v_items) then
      raise exception 'PRODUCT_UNAVAILABLE';
    end if;
    v_shipping := case when v_subtotal >= 499000 then 0 else 30000 end;
    if v_subtotal + v_shipping > 9007199254740991 then
      raise exception 'INVALID_CHECKOUT';
    end if;
    if v_expected <> v_subtotal + v_shipping then
      raise exception 'PRICE_CHANGED';
    end if;
    insert into public.orders (recipient_name, recipient_phone, shipping_address,
      total_amount, status, checkout_key, checkout_fingerprint, shipping_fee, payment_method)
    values (v_name, v_phone, v_address, (v_subtotal + v_shipping)::bigint,
      'pending', v_key, v_fingerprint, v_shipping, 'cod') returning * into v_order;
    insert into public.order_items (order_id, product_id, quantity, unit_price)
    select v_order.id, item.id, item.quantity, item.price
      from jsonb_to_recordset(v_priced_items) as item(id uuid, quantity integer, price bigint);
  end if;

  return jsonb_build_object('id', v_order.id,
    'subtotal', v_order.total_amount - v_order.shipping_fee,
    'shipping_fee', v_order.shipping_fee, 'total_amount', v_order.total_amount,
    'payment_method', v_order.payment_method, 'status', v_order.status);
end;
$$;

revoke all on function public.place_cod_order(jsonb) from public, anon, authenticated;
grant execute on function public.place_cod_order(jsonb) to service_role;
grant select on public.products to service_role;
grant select, insert on public.orders, public.order_items to service_role;
comment on function public.place_cod_order(jsonb) is
  'Server-only atomic guest COD checkout. Product prices and shipping are calculated here; same-key retries return the saved receipt.';
