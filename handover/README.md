# COHAN — Hướng dẫn bàn giao và phản biện

Tài liệu này dùng để cài lại project từ mã nguồn, tạo cơ sở dữ liệu mẫu có thể lặp lại và chuẩn bị kịch bản trình bày khóa luận.

## 1. Thành phần bàn giao

| Thành phần | Vị trí / cách tạo |
| --- | --- |
| Code frontend + backend | Toàn bộ repository `cohan-restaurant-app` |
| Cấu trúc cơ sở dữ liệu | Mongoose models trong `cohan-restaurant-backend/models/` |
| Database + sample data | Tạo lại bằng `npm run seed:defense`; có thể xuất thành MongoDB archive theo mục 6 |
| Báo cáo PDF | Đặt file `COHAN_BaoCao_KhoaLuanTotNghiep_LeQuocViet_2026.pdf` cạnh bộ bàn giao |
| Hướng dẫn cài/chạy | File này |
| Tài khoản thử nghiệm | [`Account.md`](Account.md) |

Seed không chứa dữ liệu cá nhân thật, khóa API thật hoặc thông tin production.

## 2. Yêu cầu môi trường

- Node.js tương thích với dependencies của project; khuyến nghị Node.js 20 LTS trở lên.
- npm.
- MongoDB chạy local hoặc một MongoDB development/staging riêng.
- MongoDB Database Tools chỉ cần khi muốn dùng `mongodump`/`mongorestore`.

## 3. Cài project từ đầu

Tại thư mục gốc repository:

```bash
npm install
npm install --prefix cohan-restaurant-backend
npm run env:local
```

`npm run env:local` chỉ tạo file `.env` khi file chưa tồn tại. Cấu hình local mặc định dùng:

```text
Frontend: http://localhost:5173
GraphQL:  http://localhost:4000/graphql
MongoDB:  mongodb://127.0.0.1:27017/RestaurantDB
```

Không commit `.env` thật lên GitHub.

## 4. Tạo Database và Sample Data

Bảo đảm MongoDB đang chạy, sau đó thực hiện:

```bash
npm run seed:defense
```

Lệnh trên thực hiện theo thứ tự:

1. Tạo permission, parent role và role.
2. Tạo một nhà hàng cố định cho buổi phản biện.
3. Tạo nhân viên, lịch làm, chấm công và tình huống ngoại lệ mẫu.
4. Tạo menu, món ăn, công thức, nguyên liệu, kho và đơn hàng mẫu.
5. Tạo coupon/chương trình khuyến mãi.
6. Tạo khách hàng và lịch sử đơn hàng.
7. Chuẩn hóa tài khoản Admin, Manager, Customer và Staff để đăng nhập được.

Để xóa dữ liệu demo được các seed hỗ trợ rồi tạo lại:

```bash
npm run seed:defense -- --reset
```

Seed bị chặn trong môi trường production-like, trừ khi người vận hành chủ động bật cơ chế cho phép và cung cấp mật khẩu đủ mạnh. Không bật tùy chọn này trong buổi phản biện.

## 5. Chạy project

Mở hai terminal tại thư mục gốc.

**Terminal 1 — Backend**

```bash
npm run dev --prefix cohan-restaurant-backend
```

**Terminal 2 — Frontend**

```bash
npm run dev
```

Kiểm tra nhanh:

```text
http://localhost:4000/health/live
http://localhost:4000/health/ready
http://localhost:4000/metrics
http://localhost:5173
```

Đăng nhập bằng các tài khoản trong [`Account.md`](Account.md).

## 6. Xuất và khôi phục Database dạng file

Seed là nguồn tạo dữ liệu mẫu chính. Khi hội đồng hoặc đơn vị tiếp nhận yêu cầu một file database cố định, tạo archive sau khi seed thành công.

**Xuất database**

```bash
mkdir -p handover/database
mongodump \
  --uri="mongodb://127.0.0.1:27017/RestaurantDB" \
  --archive=handover/database/cohan-defense.archive \
  --gzip
```

**Khôi phục database**

```bash
mongorestore \
  --uri="mongodb://127.0.0.1:27017/RestaurantDB" \
  --archive=handover/database/cohan-defense.archive \
  --gzip \
  --drop
```

`--drop` xóa collection đích trước khi phục hồi. Chỉ chạy trên database local/staging đã xác định đúng.

## 7. Kiểm tra trước khi trình bày

Chạy kiểm tra nhỏ nhất cho phần seed:

```bash
npm run test --prefix cohan-restaurant-backend -- tests/scripts/seed-defense-demo.test.js
```

Sau đó chạy các kiểm tra bàn giao chính:

```bash
npm run check:conflicts
npm run check:graphql
npm run build
npm run build --prefix cohan-restaurant-backend
```

Nếu có đủ thời gian và môi trường trình duyệt:

```bash
npm run test:unit
npm run test:component
npm run test:api
npm run test:smoke
```

## 8. Kịch bản demo phản biện 10–12 phút

### 8.1. Mở đầu — 45 giây

> Đề tài xây dựng hệ thống quản lý chuỗi nhà hàng F&B, liên kết trải nghiệm khách hàng với vận hành nội bộ. Trọng tâm không phải số lượng màn hình, mà là tính nhất quán giữa đặt bàn, đặt món, bếp, POS, thanh toán, kho, nhân sự và phân quyền theo chi nhánh.

Nêu ngắn gọn stack: React/Vite, Apollo Client, Node.js/Fastify, GraphQL/Mercurius, MongoDB/Mongoose và Socket.IO.

### 8.2. Kiến trúc và bảo mật — 1 phút

Mở sơ đồ kiến trúc trong báo cáo. Trình bày luồng:

```text
UI -> GraphQL operation -> resolver/service/guard -> Mongoose/MongoDB
```

Nhấn mạnh backend kiểm tra cả quyền chức năng và phạm vi nhà hàng; việc ẩn nút ở frontend không được xem là cơ chế bảo mật cuối cùng.

### 8.3. Quản trị nhà hàng và menu — 1 phút 30 giây

Đăng nhập Manager, chọn `COHAN Defense Demo Restaurant`, sau đó:

- Mở dashboard và giới thiệu các mô-đun.
- Mở quản lý menu, chỉ ra món đang bán và món hết hàng/ẩn.
- Thay đổi trạng thái một món rồi tải lại để chứng minh dữ liệu lưu tại backend.

### 8.4. Luồng khách hàng — 2 phút

Đăng nhập Customer:

- Xem nhà hàng và thực đơn.
- Thêm món vào giỏ.
- Áp dụng `ACTIVE10` để chứng minh điều kiện khuyến mãi được tính lại ở máy chủ.
- Tạo đơn hoặc trình bày đơn đã seed sẵn khi cần tiết kiệm thời gian.

Có thể nhập `EXPIRED10` để minh họa nhánh từ chối coupon hết hạn.

### 8.5. POS, bếp và trạng thái thời gian thực — 2 phút

Đăng nhập Manager hoặc Staff:

- Mở đơn tại bàn/POS.
- Chuyển món sang bếp.
- Cập nhật `đang chế biến` rồi `sẵn sàng`.
- Quay lại màn hình POS/theo dõi để chỉ ra trạng thái đã đồng bộ.
- Trình bày thanh toán, hóa đơn và đóng phiên bàn bằng dữ liệu mẫu nếu không thao tác trực tiếp toàn bộ.

### 8.6. Nhân sự vận hành — 1 phút 30 giây

Mở lịch làm việc và chấm công:

- Chỉ ra ca đã công bố, phản hồi ca và dữ liệu chấm công.
- Trình bày một ngoại lệ như chấm công ngoài lịch, tăng ca hoặc sửa công.
- Giải thích dữ liệu chưa duyệt không được đưa thẳng vào lương.

### 8.7. Phân quyền, audit và tính an toàn — 1 phút

Đăng nhập Staff để chứng minh tài khoản không thấy chức năng quản trị toàn hệ thống. Nêu ba lớp kiểm soát:

1. Route/menu phía frontend.
2. Role/permission guard phía backend.
3. Restaurant scope và audit log ở nghiệp vụ nhạy cảm.

### 8.8. Kết luận — 45 giây

> Hệ thống đã liên kết các luồng giao dịch và vận hành trên cùng nguồn dữ liệu, có kiểm soát trạng thái, phân quyền theo chi nhánh và dữ liệu mẫu có thể dựng lại bằng một lệnh. Các tích hợp phụ thuộc nhà cung cấp như thanh toán thật, SMS, máy in vật lý và AI bên ngoài được tách khỏi phạm vi khẳng định vận hành production.

## 9. Câu hỏi phản biện thường gặp

### Vì sao chọn GraphQL thay vì REST?

GraphQL giúp frontend yêu cầu đúng cấu trúc dữ liệu cần dùng và gom dữ liệu liên quan trong một operation. Quy tắc nghiệp vụ không đặt trong schema; resolver chuyển tiếp sang service/guard để giữ phân quyền và toàn vẹn dữ liệu.

### MongoDB có làm mất tính toàn vẹn dữ liệu không?

Không mặc định có nghĩa là không kiểm soát. Hệ thống dùng Mongoose schema, enum, index, khóa nghiệp vụ, kiểm tra quan hệ và điều kiện chuyển trạng thái ở service. Những luồng liên quan nhiều thực thể phải xác định thứ tự ghi và cơ chế xử lý thất bại.

### Frontend đã ẩn nút thì tại sao backend vẫn phải kiểm tra quyền?

Người dùng có thể tự gửi GraphQL request mà không qua giao diện. Frontend chỉ hỗ trợ trải nghiệm; backend mới là nơi quyết định quyền cuối cùng, bao gồm role, permission và restaurant scope.

### Làm sao tránh thanh toán hoặc callback bị ghi nhận hai lần?

Dùng mã tham chiếu/idempotency, kiểm tra trạng thái hiện tại và chỉ cho phép chuyển trạng thái hợp lệ trước khi tạo giao dịch, hóa đơn và dòng tiền.

### AI có tự quyết định nghiệp vụ không?

Không. AI chỉ hỗ trợ hỏi đáp hoặc đề xuất trong phạm vi tri thức đã duyệt. Khi thiếu dữ liệu hoặc độ tin cậy thấp, hệ thống chuyển sang nhân viên; AI không tự thanh toán, tự đặt món hay công bố dữ liệu nhạy cảm.

### Vì sao seed được xem là một phần bàn giao?

Seed tạo lại cùng role, tài khoản, phạm vi nhà hàng và các tình huống nghiệp vụ bằng quy trình có thể lặp. Điều này giúp hội đồng kiểm tra project mà không phụ thuộc database cá nhân của máy phát triển.

### Điểm hạn chế lớn nhất là gì?

Các tích hợp thanh toán thật, SMS, máy in, lưu trữ ngoài và AI phụ thuộc cấu hình nhà cung cấp. Bản demo chứng minh hợp đồng tích hợp, xử lý trạng thái và fallback; không đồng nhất sandbox với hệ thống production hoàn chỉnh.

## 10. Checklist ngay trước buổi phản biện

- MongoDB, backend và frontend đều chạy.
- Chạy `npm run seed:defense -- --reset` trước buổi trình bày.
- Đăng nhập thử cả Manager, Customer và Staff.
- Mở sẵn các tab dashboard, menu, đơn hàng/POS, bếp và lịch nhân sự.
- Thử `ACTIVE10`, kiểm tra một đơn mẫu và một ngoại lệ nhân sự.
- Tắt cache/session cũ hoặc dùng cửa sổ ẩn danh khi đổi vai trò.
- Chuẩn bị video/ảnh dự phòng cho thanh toán, Socket.IO, AI hoặc máy in nếu môi trường mạng/thiết bị không ổn định.
- Đặt báo cáo PDF và `Account.md` cạnh thư mục code bàn giao.
