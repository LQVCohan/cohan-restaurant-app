# COHAN — Hướng dẫn bàn giao và chạy lại project

Tài liệu này hướng dẫn cài và chạy COHAN từ **source code + file database MongoDB đã chứa sample data**. Người chấm không cần chạy seed để sử dụng bộ dữ liệu bàn giao.

## 1. Thành phần bàn giao

| Thành phần | Vị trí |
| --- | --- |
| Source code frontend + backend | Toàn bộ repository `cohan-restaurant-app` |
| Database có sample data | `handover/database/cohan-defense.archive.gz` |
| Hướng dẫn cài và chạy | File này |
| Tài khoản kiểm thử | [`Account.md`](Account.md) |
| Hướng dẫn xuất/khôi phục database | [`database/README.md`](database/README.md) |

Sample data đã nằm trong file database, gồm doanh nghiệp, nhà hàng, tài khoản và dữ liệu phục vụ kiểm thử. Không cần nộp thêm file sample data riêng.

> Không đưa file `.env`, URI Atlas, mật khẩu Atlas, token hoặc khóa dịch vụ thật vào bộ bàn giao.

## 2. Yêu cầu môi trường

- Node.js 20 LTS trở lên.
- npm.
- MongoDB Community Server chạy local.
- MongoDB Database Tools (`mongorestore`).

Kiểm tra công cụ:

```powershell
node --version
npm --version
mongorestore --version
```

## 3. Cài dependencies và tạo cấu hình local

Tại thư mục gốc repository:

```powershell
npm install
npm install --prefix cohan-restaurant-backend
npm run env:local
```

`npm run env:local` chỉ tạo `.env` khi file chưa tồn tại. Backend local phải kết nối database đã restore:

```env
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/RestaurantDB
MONGO_DB=RestaurantDB
```

Cấu hình mặc định:

```text
Frontend: http://localhost:5173
GraphQL:  http://localhost:4000/graphql
MongoDB:  mongodb://127.0.0.1:27017/RestaurantDB
```

## 4. Khôi phục database có sample data

Đặt file tại:

```text
handover/database/cohan-defense.archive.gz
```

Sau đó làm theo [`handover/database/README.md`](database/README.md). Luồng chuẩn là:

```text
File backup từ Atlas
        ↓ mongorestore
MongoDB local: RestaurantDB
        ↓
Chạy backend và frontend
```

Không chạy `npm run seed:defense` sau khi restore vì file database đã có sẵn sample data.

## 5. Chạy project

Mở hai terminal tại thư mục gốc.

**Terminal 1 — Backend**

```powershell
npm run dev --prefix cohan-restaurant-backend
```

**Terminal 2 — Frontend**

```powershell
npm run dev
```

Kiểm tra nhanh:

```text
http://localhost:4000/health/live
http://localhost:4000/health/ready
http://localhost:4000/metrics
http://localhost:5173
```

Đăng nhập bằng tài khoản trong [`Account.md`](Account.md).

## 6. Tài khoản kiểm thử nhanh

| Vai trò | Tài khoản | Mật khẩu |
| --- | --- | --- |
| Admin | `admin.demo@cohan.local` | `Demo@123456` |
| Business Owner | `business.owner.demo@cohan.local` | `Demo@123456` |
| Manager | `manager.demo@cohan.local` | `Demo@123456` |
| Customer/User | `customer.demo@cohan.local` | `Demo@123456` |

Danh sách đầy đủ và phạm vi từng tài khoản nằm trong [`Account.md`](Account.md).

## 7. Seed dành cho developer — không bắt buộc khi chấm

Script seed được giữ trong source code để phát triển hoặc tái tạo dữ liệu trên database thử nghiệm. Nó không phải bước cài đặt bắt buộc của bộ bàn giao.

Chỉ chạy trên database có thể xóa bỏ hoàn toàn:

```powershell
npm run seed:defense -- --reset
```

Không chạy seed trên database đã restore để chấm và không chạy trên production.

## 8. Kiểm tra trước khi đóng gói

- `handover/database/cohan-defense.archive.gz` tồn tại và có dung lượng lớn hơn 0 byte.
- Restore thành công vào một MongoDB local sạch.
- Backend kết nối đúng `RestaurantDB`.
- Frontend và backend khởi động không lỗi.
- Đăng nhập thử thành công ít nhất bằng Admin và Customer/User trong `Account.md`.
- Không có `.env`, URI Atlas, token hoặc khóa dịch vụ thật trong source code hay file ZIP.

Các lệnh kiểm tra source code:

```powershell
npm run check:conflicts
npm run check:graphql
npm run build
npm run build --prefix cohan-restaurant-backend
```
