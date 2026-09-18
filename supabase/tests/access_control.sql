-- All fixtures and changes are rolled back. Run with owner SQL access.
begin;
select set_config('shop_test.admin_id', gen_random_uuid()::text, true);
select set_config('shop_test.order_id', gen_random_uuid()::text, true);
insert into auth.users(id) values (current_setting('shop_test.admin_id')::uuid);
insert into shop_private.admin_allowlist(user_id) values (current_setting('shop_test.admin_id')::uuid);
insert into public.orders(id, recipient_name, recipient_phone, shipping_address, total_amount)
values (current_setting('shop_test.order_id')::uuid, 'RLS test', '000', 'Test address', 120000);
insert into public.order_items(order_id, product_id, quantity, unit_price)
select current_setting('shop_test.order_id')::uuid, id, 1, price from public.products limit 1;

set local role anon;
do $$ begin
  if (select count(*) from public.products) < 6 then raise exception 'anon cannot read catalog'; end if;
  begin
    perform 1 from public.orders;
    raise exception 'anon unexpectedly has orders access';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.order_items;
    raise exception 'anon unexpectedly has items access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
set local role authenticated;
do $$ begin
  if shop_private.is_admin() then raise exception 'ordinary user is admin'; end if;
  if (select count(*) from public.products) < 6 then raise exception 'user cannot read catalog'; end if;
  if exists(select 1 from public.orders) or exists(select 1 from public.order_items) then
    raise exception 'ordinary user can read orders';
  end if;
  begin
    insert into shop_private.admin_allowlist(user_id) values (auth.uid());
    raise exception 'user self-enrollment allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.products(name,price) values ('Unauthorized',0);
    raise exception 'user catalog write allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.orders(recipient_name, recipient_phone, shipping_address, total_amount)
    values ('Unauthorized','0','Test',0);
    raise exception 'user order write allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', current_setting('shop_test.admin_id'), true);
set local role authenticated;
do $$ begin
  if not shop_private.is_admin() then raise exception 'allowlisted admin not recognized'; end if;
  if not exists(select 1 from public.orders where id = current_setting('shop_test.order_id')::uuid) then
    raise exception 'admin cannot read order';
  end if;
  if not exists(select 1 from public.order_items where order_id = current_setting('shop_test.order_id')::uuid) then
    raise exception 'admin cannot read items';
  end if;
  update public.orders set status = 'confirmed' where id = current_setting('shop_test.order_id')::uuid;
  if not found then raise exception 'admin cannot update order'; end if;
  begin
    insert into shop_private.admin_allowlist(user_id) values (gen_random_uuid());
    raise exception 'admin can grant admin rights';
  exception when insufficient_privilege then null; end;
  begin
    update public.order_items set quantity = 0 where order_id = current_setting('shop_test.order_id')::uuid;
    raise exception 'zero quantity accepted';
  exception when check_violation then null; end;
  begin
    update public.order_items set unit_price = -1 where order_id = current_setting('shop_test.order_id')::uuid;
    raise exception 'negative unit price accepted';
  exception when check_violation then null; end;
  begin
    update public.products set price = -1;
    raise exception 'negative product price accepted';
  exception when check_violation then null; end;
  begin
    update public.orders set total_amount = -1 where id = current_setting('shop_test.order_id')::uuid;
    raise exception 'negative total accepted';
  exception when check_violation then null; end;
  begin
    update public.order_items set product_id = gen_random_uuid() where order_id = current_setting('shop_test.order_id')::uuid;
    raise exception 'missing product FK accepted';
  exception when foreign_key_violation then null; end;
  begin
    update public.order_items set order_id = gen_random_uuid() where order_id = current_setting('shop_test.order_id')::uuid;
    raise exception 'missing order FK accepted';
  exception when foreign_key_violation then null; end;
end $$;
reset role;
select 'PASS: anon, ordinary user, admin, self-enrollment, checks and foreign keys' as result;
rollback;
