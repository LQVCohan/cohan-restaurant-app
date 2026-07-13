# Thiết lập Quên mật khẩu và Facebook Login

## 1. Kết luận chi phí và độ phức tạp

- Luồng Facebook Login cơ bản trong thay đổi này chỉ xin `public_profile` và `email`.
- Không có phí API trực tiếp để người dùng đăng nhập bằng Facebook.
- Độ phức tạp triển khai ở mức trung bình: tạo Meta App, khai báo domain, thêm URL chính sách quyền riêng tư/xóa dữ liệu, đặt biến môi trường và chuyển app sang chế độ Live.
- Code không xin quyền nâng cao như quản lý Trang, quảng cáo, bài viết hoặc danh sách bạn bè. Nếu sau này xin các quyền đó, Meta có thể yêu cầu App Review và xác minh doanh nghiệp bổ sung.

## 2. Biến môi trường bắt buộc

### Frontend

```env
VITE_FACEBOOK_APP_ID=YOUR_META_APP_ID
VITE_FACEBOOK_GRAPH_API_VERSION=v23.0
```

### Backend

```env
FACEBOOK_APP_ID=YOUR_META_APP_ID
FACEBOOK_APP_SECRET=YOUR_META_APP_SECRET
FACEBOOK_GRAPH_API_VERSION=v23.0
```

`FACEBOOK_APP_SECRET` tuyệt đối không được đặt trong biến bắt đầu bằng `VITE_`, không commit lên GitHub và không gửi xuống trình duyệt.

Phiên bản Graph API có thể được đổi trong Meta App Dashboard. Khi đổi, cập nhật đồng thời biến frontend và backend.

## 3. Tạo Meta App

1. Đăng nhập Meta for Developers bằng tài khoản quản trị.
2. Chọn **My Apps** → **Create App**.
3. Chọn loại ứng dụng hỗ trợ xác thực người dùng/consumer.
4. Đặt tên ứng dụng, email liên hệ và tạo App.
5. Trong phần sản phẩm, thêm **Facebook Login** và chọn nền tảng **Web**.
6. Sao chép **App ID** vào `VITE_FACEBOOK_APP_ID` và `FACEBOOK_APP_ID`.
7. Sao chép **App Secret** vào biến backend `FACEBOOK_APP_SECRET`.

Tên menu trong Meta Dashboard có thể thay đổi nhẹ theo phiên bản giao diện.

## 4. Cấu hình domain và URL

Trong Meta App Dashboard:

- **App Domains**: khai báo domain thật, ví dụ `app.example.com`.
- **Site URL**: URL HTTPS của frontend, ví dụ `https://app.example.com/`.
- **Valid OAuth Redirect URIs**: thêm domain frontend và trang đăng nhập nếu Dashboard yêu cầu, ví dụ:
  - `https://app.example.com/`
  - `https://app.example.com/login`
- **Allowed Domains for the JavaScript SDK**: thêm domain frontend.

Không dùng HTTP khi chạy production. Localhost có thể được dùng ở chế độ Development với tài khoản có vai trò trong Meta App.

## 5. Chính sách quyền riêng tư và xóa dữ liệu

Trước khi chuyển ứng dụng sang Live, chuẩn bị hai URL công khai bằng HTTPS:

1. **Privacy Policy URL**: mô tả dữ liệu nhận từ Facebook (`id`, tên, email, ảnh đại diện), mục đích sử dụng, thời gian lưu và cách liên hệ.
2. **User Data Deletion URL/Instructions**: hướng dẫn người dùng yêu cầu xóa tài khoản và dữ liệu liên kết Facebook.

Có thể dùng trang hỗ trợ của Cohan, nhưng URL phải truy cập công khai và nội dung phải đúng với cách hệ thống thực tế xử lý dữ liệu.

## 6. Chuyển sang Live và tài khoản thử nghiệm

- Ở chế độ Development, chỉ quản trị viên, developer và tester của Meta App đăng nhập được.
- Kiểm tra bằng tài khoản tester trước.
- Khi domain, chính sách và thông tin ứng dụng đã đầy đủ, chuyển App sang **Live** để khách hàng thông thường sử dụng.
- Nếu Meta yêu cầu xác minh doanh nghiệp hoặc App Review trong Dashboard, hoàn thành theo thông báo. Code hiện tại không yêu cầu quyền nâng cao.

## 7. Thiết lập email cho Quên mật khẩu

Backend cần SMTP:

```env
PUBLIC_WEB_URL=https://app.example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
MAIL_FROM=Cohan <no-reply@example.com>
PASSWORD_RESET_TTL_MINUTES=30
PASSWORD_RESET_REQUEST_COOLDOWN_MS=60000
```

Nếu dùng Gmail, `SMTP_PASS` nên là App Password, không phải mật khẩu Gmail thông thường.

Luồng hoạt động:

1. Người dùng bấm **Quên mật khẩu** và nhập email.
2. Backend luôn trả phản hồi chung để không làm lộ email có tồn tại hay không.
3. Email chứa token ngẫu nhiên đã được băm trong cơ sở dữ liệu.
4. Token hết hạn mặc định sau 30 phút, chỉ dùng một lần.
5. Sau khi đổi mật khẩu, toàn bộ refresh token cũ bị thu hồi, buộc các thiết bị đăng nhập lại.

## 8. Kiểm tra sau khi triển khai

### Quên mật khẩu

- Email tồn tại nhận được thư.
- Email không tồn tại vẫn nhận thông báo chung trên giao diện.
- Link hết hạn hoặc dùng lần hai bị từ chối.
- Mật khẩu yếu bị từ chối.
- Sau khi đổi mật khẩu, mật khẩu cũ không đăng nhập được và phiên cũ bị thu hồi.

### Facebook Login

- Nút hiện đúng khi có `VITE_FACEBOOK_APP_ID`.
- Token được backend kiểm tra bằng `FACEBOOK_APP_ID` và `FACEBOOK_APP_SECRET`.
- Tài khoản Facebook mới tạo customer mới.
- Email đã tồn tại được liên kết với customer hiện có nếu chưa liên kết Facebook khác.
- Tài khoản bị khóa/không hoạt động không đăng nhập được.
- Trường hợp Facebook không trả email sẽ được hướng dẫn dùng Google hoặc tài khoản Cohan.
