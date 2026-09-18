# Kiểm tra tích hợp Supabase — 2026-09-18

- MCP project URL khớp `NEXT_PUBLIC_SUPABASE_URL` trong `.env.local`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` có định dạng publishable và truy vấn REST HTTP 200.
- Không đọc hoặc dùng giá trị secret key trong ứng dụng.
- Schema thực tế: `public.products(id uuid NOT NULL, name text NOT NULL, price bigint NOT NULL, image_url text NULL)`.
- RLS bật; `anon` có SELECT; policy `products_public_read` cho `anon, authenticated` với `USING (true)`.
- Sáu sản phẩm thật; tất cả `image_url` hiện NULL. Không sửa database, grants hoặc policies.
- Trình duyệt localhost:3000: GET danh sách và chi tiết theo UUID đều HTTP 200.
- Đã thêm túi vải vào giỏ, xác nhận localStorage lưu UUID và số lượng, reload vẫn giữ giỏ và giá 80.000đ.
- Chặn mạng bằng Playwright: báo lỗi, không có sản phẩm giả, giữ giỏ đã lưu, thử lại thành công.
- Phản hồi `[]`: trạng thái trống; trì hoãn request: trạng thái đang tải.
- Đổi giá trong phản hồi mạng kiểm thử thành 81.234đ, reload thấy giá mới; bỏ can thiệp và reload trở lại giá thật 80.000đ.
- Không có lỗi JavaScript trong luồng browser kiểm thử.
- Unit tests, ESLint, production build và `git diff --check` đều đã chạy thành công.

## Giới hạn

Chưa thử sửa một dòng database rồi reload; kiểm tra độ mới dùng phản hồi mạng được thay đổi trong phiên test.
Các truy vấn thật dùng `cache: 'no-store'` trực tiếp từ browser, không qua Next data cache.
Chưa kiểm tra triển khai production hoặc ảnh thực từ database (hiện toàn bộ ảnh NULL).
Đặt hàng vẫn là chức năng demo, không ghi đơn hàng hoặc thanh toán.

## Advisory ngoài phạm vi products

MCP security advisor báo function `public.rls_auto_enable()` là SECURITY DEFINER và có quyền EXECUTE
cho anon/authenticated. Chưa thay đổi function này; cần rà soát riêng theo
[Supabase advisory 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
`shop_private.admin_allowlist` có RLS nhưng không có policy (INFO); không phải bảng catalog công khai.
