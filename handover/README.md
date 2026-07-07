# COHAN — Hướng dẫn bàn giao và chạy lại project

Tài liệu này dùng để cài lại project từ mã nguồn, tạo dữ liệu mẫu và xuất một file MongoDB để bàn giao offline.

## 1. Thành phần bàn giao

| Thành phần | Vị trí / cách tạo |
| --- | --- |
| Code frontend + backend | Toàn bộ repository `cohan-restaurant-app` |
| Cấu trúc cơ sở dữ liệu | Mongoose models trong `cohan-restaurant-backend/models/` |
| Sample data | Tạo lại bằng `npm run seed:defense` |
| File database offline | Đặt trong [`handover/database/`](database/) |
| Hướng dẫn cài/chạy | File này |
| Tài khoản thử nghiệm | [`Account.md`](Account.md) |

Không đưa file `.env`, khóa API thật hoặc dữ liệu cá nhân vào bộ bàn giao.

## 2. Yêu cầu môi trường

- Node.js tương thích với dependencies của project; khuyến nghị Node.js 20 LTS trở lên.
- npm.
- MongoDB chạy local hoặc một MongoDB development/staging riêng.
- MongoDB Database Tools nếu cần tạo file `mongodump` để bàn giao.

## 3. Cài project từ đầu

Tại thư mục gốc repository:

```bash
npm install
npm install --prefix cohan-restaurant-backend
npm run env:local
```

`npm run env:local` chỉ tạo file `.env` khi file chưa tồn tại. Cấu hình local mặc định:

```text
Frontend: http://localhost:5173
GraphQL:  http://localhost:4000/graphql
MongoDB:  mongodb://127.0.0.1:27017/RestaurantDB
```

## 4. Tạo Database và Sample Data

Bảo đảm MongoDB đang chạy, sau đó thực hiện:

```bash
npm run seed:defense
```

Lệnh seed chuẩn bị permission, role, nhà hàng demo, nhân viên, lịch làm, chấm công, thực đơn, nguyên liệu, kho, coupon, khách hàng, đơn hàng và các tài khoản thử nghiệm.

Để tạo lại phần dữ liệu demo được các seed hỗ trợ:

```bash
npm run seed:defense -- --reset
```

Seed bị chặn trong môi trường production-like. Chỉ chạy trên database local hoặc staging đã xác định đúng.

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

## 6. Tạo file Database để đưa vào dự án

Thư mục `handover/database/` đã được chuẩn bị sẵn. Sau khi seed thành công, tạo file database theo hướng dẫn tại:

- [`handover/database/README.md`](database/README.md)

File đề xuất:

```text
handover/database/cohan-defense.archive.gz
```

File archive được giữ trong thư mục dự án để đóng gói bàn giao offline, nhưng mặc định không được commit lên GitHub.

## 7. Kiểm tra trước khi bàn giao

```bash
npm run test --prefix cohan-restaurant-backend -- tests/scripts/seed-defense-demo.test.js
npm run check:conflicts
npm run check:graphql
npm run build
npm run build --prefix cohan-restaurant-backend
```

Trước khi đóng gói, kiểm tra thêm:

- Manager, Customer và Staff đều đăng nhập được.
- Database archive đã được tạo và có dung lượng lớn hơn 0 byte.
- Không có `.env`, token hoặc khóa dịch vụ trong thư mục bàn giao.
- `Account.md` đi cùng code và file database offline.
