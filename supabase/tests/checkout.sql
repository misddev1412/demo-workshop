-- Run with ON_ERROR_STOP. Fixtures and orders are always rolled back.
begin;
insert into public.products (id, name, price) values
  ('10000000-0000-4000-8000-000000000001', 'Checkout test below threshold', 80000),
  ('10000000-0000-4000-8000-000000000002', 'Checkout test threshold', 499000);

do $$
begin
  if to_regprocedure('public.place_cod_order(jsonb)') is null then
    raise exception 'Missing atomic checkout RPC';
  end if;
  if has_function_privilege('anon', 'public.place_cod_order(jsonb)', 'EXECUTE') or
     has_function_privilege('authenticated', 'public.place_cod_order(jsonb)', 'EXECUTE') then
    raise exception 'Checkout RPC must be server-only';
  end if;
  if not has_function_privilege('service_role', 'public.place_cod_order(jsonb)', 'EXECUTE') then
    raise exception 'Server must be able to call checkout';
  end if;
end $$;

set local role service_role;
do $$
declare
  request jsonb := jsonb_build_object(
    'idempotency_key', gen_random_uuid(), 'recipient_name', 'Checkout SQL Test',
    'recipient_phone', '0912345678', 'shipping_address', '12 Test Street, Test City',
    'expected_total', 190000,
    'items', jsonb_build_array(jsonb_build_object('product_id', '10000000-0000-4000-8000-000000000001', 'quantity', 2, 'unit_price', 1))
  );
  result jsonb;
  repeated jsonb;
  bad jsonb;
  before_count bigint;
  before_items bigint;
begin
  result := public.place_cod_order(request);
  assert (result->>'subtotal')::bigint = 160000, 'Must use database price';
  assert (result->>'shipping_fee')::bigint = 30000, 'Shipping below threshold';
  assert (result->>'total_amount')::bigint = 190000, 'Correct total';
  assert result->>'payment_method' = 'cod', 'COD only';
  assert result->>'status' = 'pending', 'Initial status';
  assert (select quantity = 2 and unit_price = 80000 from public.order_items where order_id = (result->>'id')::uuid), 'Snapshot quantities/prices';

  repeated := public.place_cod_order(request);
  assert repeated = result, 'Retry must return original order';
  update public.products set price = 90000 where id = '10000000-0000-4000-8000-000000000001';
  assert public.place_cod_order(request) = result, 'Retry after catalog change must still work';
  select count(*) into before_count from public.orders;
  select count(*) into before_items from public.order_items;

  begin
    perform public.place_cod_order(request || '{"recipient_name":"Different person"}'::jsonb);
    raise exception 'Expected idempotency conflict';
  exception when raise_exception then
    if sqlerrm <> 'IDEMPOTENCY_CONFLICT' then raise; end if;
  end;

  begin
    perform public.place_cod_order(request || jsonb_build_object('idempotency_key', gen_random_uuid()));
    raise exception 'Expected stale price failure';
  exception when raise_exception then
    if sqlerrm <> 'PRICE_CHANGED' then raise; end if;
  end;

  begin
    perform public.place_cod_order(request || jsonb_build_object('idempotency_key', gen_random_uuid(), 'items',
      jsonb_build_array(jsonb_build_object('product_id', gen_random_uuid(), 'quantity', 1),
        jsonb_build_object('product_id', '10000000-0000-4000-8000-000000000001', 'quantity', 1))));
    raise exception 'Expected unavailable product failure';
  exception when raise_exception then
    if sqlerrm <> 'PRODUCT_UNAVAILABLE' then raise; end if;
  end;

  for bad in select value from jsonb_array_elements(jsonb_build_array(
    request || '{"items":[]}'::jsonb,
    request || '{"recipient_phone":"123"}'::jsonb,
    request || '{"recipient_name":" "}'::jsonb,
    request || '{"shipping_address":"short"}'::jsonb,
    request || '{"expected_total":-1}'::jsonb,
    request || '{"items":[{"product_id":"10000000-0000-4000-8000-000000000001","quantity":0}]}'::jsonb,
    request || '{"items":[{"product_id":"10000000-0000-4000-8000-000000000001","quantity":1.5}]}'::jsonb,
    request || jsonb_build_object('items', (request->'items') || (request->'items'))
  )) loop
    begin
      perform public.place_cod_order(bad || jsonb_build_object('idempotency_key', gen_random_uuid()));
      raise exception 'Expected invalid checkout';
    exception when raise_exception then
      if sqlerrm <> 'INVALID_CHECKOUT' then raise; end if;
    end;
  end loop;
  assert (select count(*) from public.orders) = before_count, 'Failures cannot leave partial orders';
  assert (select count(*) from public.order_items) = before_items, 'Failures cannot leave partial items';

  result := public.place_cod_order(request || jsonb_build_object('idempotency_key', gen_random_uuid(), 'expected_total', 499000,
    'items', jsonb_build_array(jsonb_build_object('product_id', '10000000-0000-4000-8000-000000000002', 'quantity', 1))));
  assert (result->>'shipping_fee')::bigint = 0, 'Free shipping at exactly 499000';
  assert (result->>'total_amount')::bigint = 499000, 'Threshold total';
end $$;
reset role;

-- Force failure after the order insert, proving the entire RPC rolls back.
create function pg_temp.fail_checkout_item() returns trigger language plpgsql as $$
begin
  if new.product_id = '10000000-0000-4000-8000-000000000001' then
    raise exception 'TEST_ITEM_WRITE_FAILED';
  end if;
  return new;
end $$;
create trigger checkout_test_item_failure before insert on public.order_items
  for each row execute function pg_temp.fail_checkout_item();
set local role service_role;
do $$
declare
  before_count bigint;
begin
  select count(*) into before_count from public.orders;
  begin
    perform public.place_cod_order(jsonb_build_object(
      'idempotency_key', gen_random_uuid(), 'recipient_name', 'Atomic rollback test',
      'recipient_phone', '0912345678', 'shipping_address', '12 Test Street, Test City',
      'expected_total', 120000, 'items', jsonb_build_array(jsonb_build_object(
        'product_id', '10000000-0000-4000-8000-000000000001', 'quantity', 1))));
    raise exception 'Expected item-write failure';
  exception when raise_exception then
    if sqlerrm <> 'TEST_ITEM_WRITE_FAILED' then raise; end if;
  end;
  assert (select count(*) from public.orders) = before_count, 'Item insert failure must roll back the order';
end $$;
reset role;
select 'PASS: COD pricing, shipping, idempotency, validation, atomic rollback and RPC permissions' as result;
rollback;
