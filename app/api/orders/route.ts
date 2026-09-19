import { handleCheckoutRequest } from "../../../lib/checkout-server";

export async function POST(request: Request) {
  return handleCheckoutRequest(request, {
    baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    secretKey: process.env.SUPABASE_SECRET_KEY?.trim(),
  });
}
