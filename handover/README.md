# COHAN — Hướng dẫn cài đặt và chạy project

Tài liệu này dành cho bất kỳ ai muốn tải source code, khôi phục database mẫu và chạy COHAN trên máy local. Khi đã có file database chứa sample data, không cần chạy seed.

## 1. Thành phần cần có

| Thành phần | Vị trí |
| --- | --- |
| Source code frontend + backend | Toàn bộ repository `cohan-restaurant-app` |
| Database có sample data | `handover/database/cohan-defense.archive.gz` |
| Tài khoản kiểm thử | [`Account.md`](Account.md) |
| Hướng dẫn xuất/khôi phục database | [`database/README.md`](database/README.md) |

Sample data đã nằm trong file database, gồm doanh nghiệp, nhà hàng, tài khoản và dữ liệu phục vụ kiểm thử. Không cần thêm file sample data riêng.

## 2. Yêu cầu môi trường

- Node.js 20 LTS trở lên.
- npm.
- MongoDB Community Server chạy local.
- MongoDB Database Tools (`mongorestore`).

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

Backend local phải kết nối database đã restore:

```env
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/RestaurantDB
MONGO_DB=RestaurantDB
```

## 4. Khôi phục database mẫu

Đặt file tại:

```text
handover/database/cohan-defense.archive.gz
```

Sau đó làm theo [`handover/database/README.md`](database/README.md):

```text
File backup từ Atlas
        ↓ mongorestore
MongoDB local: RestaurantDB
        ↓
Chạy backend và frontend
```

Không chạy `npm run seed:defense` sau khi restore nếu muốn giữ nguyên dữ liệu mẫu trong file database.

## 5. Chạy project

Mở hai terminal tại thư mục gốc.

**Backend**

```powershell
npm run dev --prefix cohan-restaurant-backend
```

**Frontend**

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

## 6. Seed dành cho developer

Seed chỉ dùng để tái tạo dữ liệu trên database thử nghiệm và không bắt buộc khi đã restore database mẫu.

```powershell
npm run seed:defense -- --reset
```

Không chạy seed trên production hoặc trên database chứa dữ liệu cần giữ lại.

## 7. Kiểm tra sau khi cài đặt

- File database tồn tại và có dung lượng lớn hơn 0 byte.
- Restore thành công vào MongoDB local sạch.
- Backend kết nối đúng `RestaurantDB`.
- Frontend và backend khởi động không lỗi.
- Đăng nhập thành công bằng tài khoản trong `Account.md`.

```powershell
npm run check:conflicts
npm run check:graphql
npm run build
npm run build --prefix cohan-restaurant-backend
```
