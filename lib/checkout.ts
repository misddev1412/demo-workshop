export type CheckoutItem = { product_id: string; quantity: number };
export type CheckoutRequest = {
  idempotency_key: string;
  recipient_name: string;
  recipient_phone: string;
  shipping_address: string;
  items: CheckoutItem[];
  expected_total: number;
};
export type OrderReceipt = {
  id: string;
  subtotal: number;
  shipping_fee: number;
  total_amount: number;
  payment_method: "cod";
  status: string;
};

export class CheckoutError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "INVALID_CHECKOUT", status = 400) {
    super(message);
    this.name = "CheckoutError";
    this.code = code;
    this.status = status;
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const amount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export const shippingFee = (subtotal: number) => subtotal >= 499000 ? 0 : 30000;
export const formatMoney = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);

export type CheckoutAttempt = { fingerprint: string; key: string; expectedTotal: number };

// Catalog changes are not a new purchase intent. Reuse the original amount on
// uncertain retries so the server can return an already-committed receipt.
export async function resolveCheckoutAttempt(input: CheckoutRequest, previous: unknown): Promise<CheckoutAttempt> {
  const identity = {
    recipient_name: input.recipient_name, recipient_phone: input.recipient_phone,
    shipping_address: input.shipping_address, items: input.items,
  };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(identity)));
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  if (record(previous) && previous.fingerprint === fingerprint &&
    typeof previous.key === "string" && uuid.test(previous.key) && amount(previous.expectedTotal)) {
    return { fingerprint, key: previous.key, expectedTotal: previous.expectedTotal };
  }
  return { fingerprint, key: input.idempotency_key, expectedTotal: input.expected_total };
}

export function parseCheckoutRequest(value: unknown): CheckoutRequest {
  if (!record(value)) throw new CheckoutError("Thông tin đặt hàng không hợp lệ.");
  const text = (key: string, min: number, max: number, message: string) => {
    const input = value[key];
    if (typeof input !== "string" || input.trim().length < min || input.trim().length > max) throw new CheckoutError(message);
    return input.trim();
  };
  const recipient_name = text("recipient_name", 2, 100, "Vui lòng nhập họ tên từ 2 đến 100 ký tự.");
  const shipping_address = text("shipping_address", 10, 500, "Vui lòng nhập địa chỉ đầy đủ từ 10 đến 500 ký tự.");
  const recipient_phone = text("recipient_phone", 10, 25, "Vui lòng nhập số điện thoại Việt Nam hợp lệ.")
    .replace(/[\s().-]/g, "").replace(/^\+84/, "0");
  if (!/^0[35789]\d{8}$/.test(recipient_phone)) throw new CheckoutError("Vui lòng nhập số di động Việt Nam hợp lệ (ví dụ: 0912345678).");
  if (typeof value.idempotency_key !== "string" || !uuid.test(value.idempotency_key)) throw new CheckoutError("Mã yêu cầu không hợp lệ. Vui lòng mở lại phần đặt hàng.");
  if (!amount(value.expected_total)) throw new CheckoutError("Tổng tiền không hợp lệ. Vui lòng kiểm tra lại giỏ hàng.");
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 50) throw new CheckoutError("Giỏ hàng cần có từ 1 đến 50 sản phẩm khác nhau.");
  const seen = new Set<string>();
  const items = value.items.map(item => {
    if (!record(item) || typeof item.product_id !== "string" || !uuid.test(item.product_id) ||
      typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new CheckoutError("Sản phẩm hoặc số lượng không hợp lệ (từ 1 đến 99 mỗi loại).");
    }
    const product_id = item.product_id.toLowerCase();
    if (seen.has(product_id)) throw new CheckoutError("Giỏ hàng có sản phẩm trùng lặp.");
    seen.add(product_id);
    return { product_id, quantity: item.quantity };
  }).sort((a, b) => a.product_id.localeCompare(b.product_id));
  return { idempotency_key: value.idempotency_key.toLowerCase(), recipient_name, recipient_phone, shipping_address, items, expected_total: value.expected_total };
}

export function parseOrderReceipt(value: unknown): OrderReceipt {
  if (!record(value) || typeof value.id !== "string" || !uuid.test(value.id) ||
    !amount(value.subtotal) || !amount(value.shipping_fee) || !amount(value.total_amount) ||
    value.total_amount !== value.subtotal + value.shipping_fee || value.payment_method !== "cod" ||
    typeof value.status !== "string" || !["pending", "confirmed", "shipping", "completed", "cancelled"].includes(value.status)) {
    throw new Error("Chưa nhận được xác nhận hợp lệ. Vui lòng thử lại với cùng thông tin đặt hàng.");
  }
  return { id: value.id, subtotal: value.subtotal, shipping_fee: value.shipping_fee, total_amount: value.total_amount, payment_method: "cod", status: value.status };
}
