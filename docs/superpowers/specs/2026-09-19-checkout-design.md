# Đặt hàng COD

Approved by the user on 2026-09-19: guest checkout, recipient name/phone/address,
server-calculated prices, 30,000 VND shipping below 499,000 VND, atomic order and
item creation, duplicate-submit protection, confirmation with order ID, and cart
clearing only after confirmed success.

## Flow

Keep the existing cart drawer. Its checkout button opens a recipient form and
order summary in the same drawer. Required inputs have labels, length limits,
and Vietnamese errors. COD is the only payment method. A pending submission
disables edits/navigation. Success displays the persisted order ID and total.
Failure preserves the cart and form. Price changes require review and resubmission.

## Boundaries

- `lib/checkout.ts`: public request validation, money/shipping rules, receipt types.
- `lib/checkout-server.ts` and `app/api/orders/route.ts`: bounded JSON request,
  same-origin browser checks, server-only secret, one database RPC, safe errors.
- `app/components/checkout-form.tsx`: recipient form, stable retry key, pending,
  failure, success and cart callbacks. No privileged database access in the browser.
- Supabase migration: service-role-only SECURITY INVOKER RPC, key uniqueness,
  shipping/payment metadata; existing RLS and admin permissions remain in force.

The RPC validates items, serializes requests sharing a key, checks the saved
request fingerprint, locks selected product prices, calculates totals, and inserts
orders/items in one transaction. Replays return the original receipt, including
after catalog changes. A key reused with different data returns a conflict.
The client expected total is only a stale-price guard, never the authoritative total.

The browser stores only a request fingerprint and random key in sessionStorage,
not recipient information. Within the open form, uncertain requests retain their
key. Across reloads, submitting the same normalized data reuses the saved key.

## Verification

Node tests cover validation and HTTP contracts. PostgreSQL rollback tests cover
pricing, shipping boundaries, idempotency, failures without partial orders, and
role permissions. Browser checks cover success, failed retry, mobile layout and
cart persistence. Run existing tests, lint and production build.

No payment gateway, account requirement, order-history UI, inventory management,
or fulfillment integration is included.
