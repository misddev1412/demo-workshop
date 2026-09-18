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
catalog sau khi tải thành công; lỗi truy vấn không xóa giỏ đã lưu. Đặt hàng vẫn là demo,
không tạo đơn hoặc thực hiện thanh toán.

Kiểm tra:

```bash
node --experimental-strip-types --test tests/products.test.mjs
npm run lint
npm run build
```

Kiểm thử browser nên bao gồm: danh sách → chi tiết → thêm giỏ → tải lại;
chặn request `*/rest/v1/products*` để kiểm tra lỗi/thử lại; trả `[]` để kiểm tra trạng thái trống.
Dữ liệu mô phỏng chỉ dùng trong kiểm thử, không có fallback trong ứng dụng.
