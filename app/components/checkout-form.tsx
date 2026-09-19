"use client";

import { useRef, useState, type FormEvent } from "react";
import { CheckoutError, formatMoney, parseCheckoutRequest, parseOrderReceipt, resolveCheckoutAttempt, shippingFee, type CheckoutAttempt, type OrderReceipt } from "../../lib/checkout";
import type { Cart, Product } from "../../lib/products";

type Props = {
  products: Product[];
  cart: Cart;
  onBack: () => void;
  onBusy: (busy: boolean) => void;
  onSuccess: (receipt: OrderReceipt) => void;
  onRefresh: () => Promise<void>;
};
const ATTEMPT_STORAGE = "moc-checkout-attempt";

export default function CheckoutForm({ products, cart, onBack, onBusy, onSuccess, onRefresh }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const attempt = useRef<CheckoutAttempt | null>(null);
  const items = products.filter(product => cart[product.id]);
  const subtotal = items.reduce((sum, product) => sum + product.price * cart[product.id], 0);
  const shipping = shippingFee(subtotal);
  const total = subtotal + shipping;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || needsRefresh) return;
    const form = new FormData(event.currentTarget);
    inFlight.current = true;
    setPending(true); onBusy(true); setError(""); setNotice("");
    try {
      const input = parseCheckoutRequest({
        idempotency_key: crypto.randomUUID(),
        recipient_name: form.get("recipient_name"), recipient_phone: form.get("recipient_phone"),
        shipping_address: form.get("shipping_address"), expected_total: total,
        items: Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity })),
      });
      let savedAttempt: unknown = attempt.current;
      if (!attempt.current) {
        try {
          savedAttempt = JSON.parse(sessionStorage.getItem(ATTEMPT_STORAGE) || "null");
        } catch { /* An in-memory key still protects retries if storage is unavailable. */ }
      }
      attempt.current = await resolveCheckoutAttempt(input, savedAttempt);
      input.idempotency_key = attempt.current.key;
      input.expected_total = attempt.current.expectedTotal;
      try { sessionStorage.setItem(ATTEMPT_STORAGE, JSON.stringify(attempt.current)); } catch {}

      const response = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input), signal: AbortSignal.timeout(20000),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "PRICE_CHANGED" || data.code === "PRODUCT_UNAVAILABLE") {
          // These errors guarantee no order was created, so the reviewed cart
          // can safely receive a new attempt after refreshing the catalog.
          setNeedsRefresh(true);
          attempt.current = null;
          try { sessionStorage.removeItem(ATTEMPT_STORAGE); } catch {}
        }
        throw new Error(typeof data.error === "string" ? data.error : "Chưa thể đặt hàng. Vui lòng thử lại.");
      }
      const receipt = parseOrderReceipt(data.order);
      try { sessionStorage.removeItem(ATTEMPT_STORAGE); } catch {}
      onSuccess(receipt);
    } catch (cause) {
      setError(cause instanceof CheckoutError || (cause instanceof Error && cause.name === "Error")
        ? cause.message : "Chưa nhận được xác nhận đơn hàng. Hãy thử lại với cùng thông tin để tránh tạo đơn trùng.");
    } finally {
      inFlight.current = false; setPending(false); onBusy(false);
    }
  }

  async function refresh() {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); onBusy(true);
    try {
      await onRefresh();
      setNeedsRefresh(false); setError("");
      setNotice("Đã cập nhật giỏ hàng. Vui lòng kiểm tra sản phẩm và tổng tiền rồi xác nhận lại.");
    } catch {
      setError("Chưa thể cập nhật giỏ hàng. Vui lòng thử lại.");
    } finally { inFlight.current = false; setPending(false); onBusy(false); }
  }

  return <form className="checkout-form" onSubmit={submit} aria-busy={pending}>
    <button type="button" className="checkout-back" disabled={pending} onClick={onBack}>← Quay lại giỏ hàng</button>
    <fieldset disabled={pending}>
      <legend>Thông tin nhận hàng</legend>
      <label htmlFor="recipient-name">Họ và tên <span aria-hidden="true">*</span></label>
      <input id="recipient-name" name="recipient_name" autoComplete="shipping name" placeholder="Nguyễn An" required minLength={2} maxLength={100}/>
      <label htmlFor="recipient-phone">Số điện thoại <span aria-hidden="true">*</span></label>
      <input id="recipient-phone" name="recipient_phone" type="tel" autoComplete="shipping tel" placeholder="0912 345 678" required minLength={10} maxLength={25} aria-describedby="phone-hint"/>
      <small id="phone-hint">Số di động Việt Nam để liên hệ giao hàng.</small>
      <label htmlFor="shipping-address">Địa chỉ nhận hàng <span aria-hidden="true">*</span></label>
      <textarea id="shipping-address" name="shipping_address" autoComplete="shipping street-address" placeholder="Số nhà, tên đường, phường/xã, tỉnh/thành phố" required minLength={10} maxLength={500} rows={3}/>
    </fieldset>
    <div className="checkout-payment"><span className="checkout-radio" aria-hidden="true">●</span><div><strong>Thanh toán khi nhận hàng (COD)</strong><p>Thanh toán tiền mặt khi nhận được hàng.</p></div></div>
    <section className="checkout-review" aria-labelledby="checkout-review-title">
      <h3 id="checkout-review-title">Đơn hàng của bạn</h3>
      {items.length ? <ul>{items.map(product => <li key={product.id}><span>{product.name} <small>× {cart[product.id]}</small></span><strong>{formatMoney(product.price * cart[product.id])}</strong></li>)}</ul> : <p>Giỏ hàng hiện không còn sản phẩm. Vui lòng quay lại cửa hàng.</p>}
      {items.length > 0 && <div className="cart-summary"><div><span>Tạm tính</span><strong>{formatMoney(subtotal)}</strong></div><div><span>Phí vận chuyển</span><span>{shipping ? formatMoney(shipping) : "Miễn phí"}</span></div><div className="total"><strong>Tổng thanh toán</strong><strong>{formatMoney(total)}</strong></div></div>}
    </section>
    {error && <div className="checkout-error" role="alert"><p>{error}</p>{needsRefresh && <button type="button" disabled={pending} onClick={refresh}>Cập nhật giỏ hàng</button>}</div>}
    {notice && <p className="checkout-notice" role="status">{notice}</p>}
    <button className="primary-button checkout-submit" type="submit" disabled={pending || needsRefresh || !items.length}>{pending ? "Đang xử lý…" : "Xác nhận đặt hàng"}</button>
    <p className="checkout-footnote">Không cần thanh toán trước. Đơn hàng sẽ được mộc tiếp nhận và xác nhận.</p>
  </form>;
}
