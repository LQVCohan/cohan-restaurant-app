# COHAN — Xuất database Atlas và khôi phục về local

Database mẫu của dự án được lưu tại:

```text
handover/database/cohan-defense.archive.gz
```

File archive chứa database `RestaurantDB` và sample data. Người dùng có thể restore file này vào MongoDB local mà không cần quyền truy cập Atlas và không cần chạy seed.

## 1. Chuẩn bị MongoDB Database Tools

Kiểm tra trong PowerShell:

```powershell
mongodump --version
mongorestore --version
```

Nếu Windows không nhận lệnh, thêm thư mục `bin` của MongoDB Database Tools vào `PATH`, sau đó mở PowerShell mới.

## 2. Xuất lại database từ Atlas

Không ghi URI Atlas thật vào README, source code hoặc lịch sử Git. Lưu URI thật vào biến môi trường PowerShell trên máy cá nhân:

```powershell
$env:COHAN_ATLAS_URI="<URI Atlas của bạn>"
```

Tại thư mục gốc repository, chạy:

```powershell
New-Item -ItemType Directory -Force -Path ".\handover\database" | Out-Null

mongodump `
  --uri="$env:COHAN_ATLAS_URI" `
  --db="RestaurantDB" `
  --archive=".\handover\database\cohan-defense.archive.gz" `
  --gzip
```

Xóa biến khỏi terminal sau khi dump:

```powershell
Remove-Item Env:COHAN_ATLAS_URI
```

Kiểm tra file:

```powershell
Get-Item ".\handover\database\cohan-defense.archive.gz" |
  Select-Object FullName, Length, LastWriteTime
```

File hợp lệ khi tồn tại và `Length` lớn hơn `0`.

## 3. Khôi phục vào MongoDB local

Bảo đảm MongoDB local đang chạy, sau đó thực hiện tại thư mục gốc repository:

```powershell
mongorestore `
  --uri="mongodb://127.0.0.1:27017" `
  --archive=".\handover\database\cohan-defense.archive.gz" `
  --gzip `
  --drop
```

`--drop` xóa các collection đích trước khi khôi phục. Chỉ dùng với MongoDB local hoặc database thử nghiệm đã xác định đúng.

## 4. Cấu hình backend sau khi restore

Trong `cohan-restaurant-backend/.env`:

```env
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/RestaurantDB
MONGO_DB=RestaurantDB
```

Khởi động backend:

```powershell
npm run dev --prefix cohan-restaurant-backend
```

Kiểm tra:

```text
http://localhost:4000/health/live
http://localhost:4000/health/ready
```

Sau đó khởi động frontend và đăng nhập bằng tài khoản trong [`../Account.md`](../Account.md).

## 5. Kiểm tra sau khi restore

- Backend kết nối đúng database `RestaurantDB`.
- Admin và Customer/User đăng nhập thành công.
- Quan hệ Business, Restaurant và tài khoản hiển thị đúng.
- File archive không chứa `.env`, URI Atlas hoặc thông tin truy cập Atlas.

## 6. Cấu trúc thư mục

```text
cohan-restaurant-app/
├─ cohan-restaurant-backend/
├─ src/
├─ handover/
│  ├─ README.md
│  ├─ Account.md
│  └─ database/
│     ├─ README.md
│     └─ cohan-defense.archive.gz
└─ package.json
```
