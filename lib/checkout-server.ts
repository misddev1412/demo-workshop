import "server-only";
import { CheckoutError, parseCheckoutRequest, parseOrderReceipt } from "./checkout.ts";

type Options = { baseUrl?: string; secretKey?: string; fetcher?: typeof fetch };
const MAX_BODY_BYTES = 16384;
const unavailable = "Chưa thể xác nhận đơn hàng. Vui lòng thử lại với cùng thông tin; giỏ hàng của bạn vẫn được giữ.";
const reply = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new CheckoutError("Thông tin đặt hàng quá dài.", "BODY_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new CheckoutError("Thiếu thông tin đặt hàng.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new CheckoutError("Thông tin đặt hàng quá dài.", "BODY_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new CheckoutError("Thông tin đặt hàng không phải JSON hợp lệ."); }
}

export async function handleCheckoutRequest(request: Request, { baseUrl, secretKey, fetcher = fetch }: Options): Promise<Response> {
  try {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
      throw new CheckoutError("Nguồn gửi yêu cầu không hợp lệ.", "INVALID_ORIGIN", 403);
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new CheckoutError("Yêu cầu cần dùng định dạng JSON.", "INVALID_CONTENT_TYPE", 415);
    }
    const input = parseCheckoutRequest(await readBody(request));
    if (!baseUrl || !secretKey?.startsWith("sb_secret_")) return reply({ error: unavailable, code: "CHECKOUT_UNAVAILABLE" }, 503);
    const upstream = await fetcher(new URL("/rest/v1/rpc/place_cod_order", baseUrl), {
      method: "POST", headers: { apikey: secretKey, "Content-Type": "application/json" },
      body: JSON.stringify({ p_request: input }), cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      const known: Record<string, [string, number]> = {
        PRICE_CHANGED: ["Giá sản phẩm đã thay đổi. Vui lòng cập nhật giỏ hàng và kiểm tra tổng tiền trước khi đặt lại.", 409],
        PRODUCT_UNAVAILABLE: ["Một sản phẩm không còn bán. Vui lòng cập nhật giỏ hàng trước khi đặt lại.", 409],
        IDEMPOTENCY_CONFLICT: ["Yêu cầu này đã được dùng với thông tin khác. Vui lòng kiểm tra lại đơn đã gửi.", 409],
        INVALID_CHECKOUT: ["Thông tin đặt hàng không hợp lệ. Vui lòng kiểm tra lại.", 400],
      };
      const error = data?.code === "P0001" && typeof data.message === "string" ? known[data.message] : undefined;
      if (error) throw new CheckoutError(error[0], data.message, error[1]);
      return reply({ error: unavailable, code: "CHECKOUT_UNAVAILABLE" }, 503);
    }
    return reply({ order: parseOrderReceipt(data) }, 200);
  } catch (error) {
    if (error instanceof CheckoutError) return reply({ error: error.message, code: error.code }, error.status);
    return reply({ error: unavailable, code: "CHECKOUT_UNAVAILABLE" }, 503);
  }
}
