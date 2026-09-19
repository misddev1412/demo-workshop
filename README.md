This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Danh mục Supabase

Ứng dụng đọc `public.products` qua Supabase Data API bằng quyền khách (`anon`).
Cấu trúc đang dùng: `id uuid`, `name text`, `price bigint` (VNĐ), `image_url text nullable`.
Không dùng secret/service-role key cho danh mục. Ảnh thiếu hoặc lỗi hiển thị “Chưa có ảnh”.

Tạo hoặc kiểm tra `.env.local` ở thư mục gốc (không commit file này):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Lấy Project URL từ **Connect** của project Supabase và publishable key từ
**Settings → API Keys → Publishable key**. Tự điền hai giá trị rồi khởi động lại
`npm run dev`; môi trường production cần build lại khi đổi biến `NEXT_PUBLIC_`.
Không cần điền secret key. Nếu thiếu cấu hình, UI báo lỗi và không dùng dữ liệu mẫu.

Khách cần quyền `SELECT` và policy RLS cho phép đọc `products`.
Project hiện tại đã có RLS và policy `products_public_read` cho `anon, authenticated`.
Không thay đổi schema hoặc policy trong lần tích hợp này.

Danh sách được truy vấn khi trang mount; cửa sổ chi tiết truy vấn lại theo UUID mỗi lần mở.
Mọi truy vấn dùng `cache: 'no-store'`, không lưu catalog trong localStorage hoặc Next cache.
Tải lại trang lấy tên/giá mới từ database. Giỏ lưu UUID và số lượng, đối chiếu lại với
catalog sau khi tải thành công; lỗi truy vấn không xóa giỏ đã lưu. Đặt hàng COD tạo đơn thật trong database; khách thanh toán khi nhận hàng.

Kiểm tra:

```bash
npm test
npm run lint
npm run build
```

Kiểm thử browser nên bao gồm: danh sách → chi tiết → thêm giỏ → tải lại;
chặn request `*/rest/v1/products*` để kiểm tra lỗi/thử lại; trả `[]` để kiểm tra trạng thái trống.
Dữ liệu mô phỏng chỉ dùng trong kiểm thử, không có fallback trong ứng dụng.


## Đặt hàng COD

Khách mở giỏ → **Tiến hành đặt hàng** → nhập tên, số di động Việt Nam và địa chỉ
→ **Xác nhận đặt hàng**. Thành công hiển thị mã đơn và tổng tiền, sau đó xóa giỏ.
Lỗi giữ nguyên giỏ và thông tin để thử lại. Không yêu cầu tài khoản, không có
thanh toán online hoặc kết nối đơn vị giao vận.

`POST /api/orders` gọi `public.place_cod_order(jsonb)` bằng khóa server. Giá và
phí ship được tính trong database: 30.000đ dưới 499.000đ, miễn phí từ 499.000đ.
Nếu tổng tiền thay đổi, khách phải cập nhật giỏ và kiểm tra trước khi gửi lại.
Đơn và chi tiết được ghi trong một giao dịch. RPC chỉ cho phép `service_role`;
quyền đọc/quản lý đơn của admin và RLS hiện có được giữ nguyên.

Thêm biến **chỉ dành cho server** vào `.env.local` và môi trường deploy:

```dotenv
SUPABASE_SECRET_KEY=sb_secret_...
```

Lấy từ Supabase Settings → API Keys. Không thêm tiền tố `NEXT_PUBLIC_` cho khóa
này. Danh mục vẫn dùng publishable key. Nếu thiếu khóa server, API trả lỗi 503
và không xóa giỏ. Không commit `.env.local`.

Migration `supabase/migrations/20260919022211_add_guest_cod_checkout.sql` đã được
áp dụng lên project demo `ibrmkqkaxecglnvehzit`. Với project khác, cần áp dụng
migration danh mục/đơn hàng trước, rồi migration checkout này.

API nhận `recipient_name`, `recipient_phone`, `shipping_address`, `items`
(`product_id`, `quantity`), `expected_total` và `idempotency_key` (UUID).
`expected_total` chỉ dùng phát hiện giá cũ. Server bỏ qua giá do client gửi.
Giới hạn: 50 loại sản phẩm, 1–99 mỗi loại, request tối đa 16 KiB.

Cùng mã yêu cầu và dữ liệu đã chuẩn hóa trả lại cùng đơn, kể cả khi giá sản
phẩm đã thay đổi. Client lưu hash thông tin, UUID và tổng tiền ban đầu trong
sessionStorage để thử lại khi mất phản hồi, không lưu tên/điện thoại/địa chỉ.
Thay đổi người nhận hoặc sản phẩm được xem là yêu cầu mua mới. Mã đã dùng với
thông tin khác bị từ chối. Không có API công khai để liệt kê hoặc tra cứu đơn.

Kiểm thử database (dùng connection owner của môi trường kiểm thử):

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/checkout.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/access_control.sql
```

Các fixture SQL đều rollback. `npm test` chạy cả kiểm thử danh mục, validation,
API và giữ mã retry qua thay đổi giá. Chi tiết kiểm chứng tại
`docs/checkout-verification.md`.
