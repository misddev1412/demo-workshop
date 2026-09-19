# Thiết kế giao diện form liên hệ

## Mục tiêu

Thêm một khu vực liên hệ vào trang chủ cửa hàng “mộc” để khách để lại thông tin và lời nhắn. Phiên bản này chỉ hoàn thiện giao diện và tương tác phía trình duyệt; chưa tạo API, bảng dữ liệu hay kết nối Supabase.

## Vị trí và bố cục

Khu vực liên hệ nằm sau phần “Câu chuyện của mộc” và trước footer. Trên màn hình lớn, khu vực dùng bố cục hai cột: cột trái giới thiệu ngắn và thông tin phản hồi dự kiến; cột phải là form. Trên thiết bị di động, hai cột xếp dọc với form là luồng thao tác chính.

Thiết kế tiếp tục dùng bảng màu xanh–kem, kiểu chữ serif cho tiêu đề, đường kẻ mảnh và khoảng trắng của giao diện hiện tại. Form là một phần của mặt phẳng trang, không dùng card nổi hoặc hiệu ứng trang trí tách rời hệ thống thị giác.

## Nội dung và trường dữ liệu

Form có các trường:

- Họ và tên — bắt buộc.
- Email hoặc số điện thoại — bắt buộc.
- Lời nhắn — bắt buộc.

Nút chính dùng nhãn “Gửi lời nhắn”. Nội dung giới thiệu nói rõ đây là nơi hỏi về sản phẩm, đơn hàng hoặc gửi lời chào tới mộc.

## Tương tác

Trình duyệt kiểm tra các trường bắt buộc trước khi nhận thao tác gửi. Khi dữ liệu hợp lệ, form hiển thị trạng thái đang gửi ngắn và sau đó chuyển sang thông báo thành công mô phỏng. Thông báo phải nói rõ lời nhắn đã được ghi nhận trên giao diện, không khẳng định dữ liệu đã được lưu hoặc gửi tới hệ thống thật.

Người dùng có thể bắt đầu lại form sau trạng thái thành công. Lỗi validation được gắn với đúng trường, có thể đọc bằng công nghệ hỗ trợ và không chỉ biểu đạt bằng màu sắc.

## Kiến trúc giao diện

Tách form thành component client riêng để trạng thái nhập liệu và gửi mô phỏng không làm `Home` phình thêm. Trang chủ chỉ chịu trách nhiệm đặt component vào đúng vị trí. CSS mới dùng các class có phạm vi rõ ràng trong stylesheet hiện tại và có breakpoint phù hợp với hệ thống responsive sẵn có.

## Kiểm thử và tiêu chí hoàn thành

- Form hiển thị đúng giữa phần câu chuyện và footer trên desktop lẫn mobile.
- Có thể điều hướng và gửi form bằng bàn phím.
- Trường trống hiển thị lỗi phù hợp.
- Dữ liệu hợp lệ dẫn tới trạng thái thành công mô phỏng.
- Không có request mạng, migration Supabase hoặc thay đổi quyền dữ liệu.
- Lint, test và build hiện có vẫn vượt qua.

## Ngoài phạm vi

- Supabase, migration, RLS và API ghi dữ liệu.
- Gửi email hoặc thông báo nội bộ.
- CAPTCHA, rate limiting và chống spam phía server.
- Trang quản trị danh sách liên hệ.
