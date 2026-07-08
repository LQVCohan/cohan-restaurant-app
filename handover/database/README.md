# COHAN — Xuất database Atlas và khôi phục về local

Repository đã bao gồm file database mẫu:

```text
handover/database/cohan-defense.archive.gz
```

Archive chứa database `RestaurantDB` và sample data. Người dùng chỉ cần restore file này vào MongoDB local; không cần quyền truy cập Atlas và không cần chạy seed.

## 1. Chuẩn bị MongoDB Database Tools

Kiểm tra trong PowerShell:

```powershell
mongodump --version
mongorestore --version
```

Nếu Windows không nhận lệnh, thêm thư mục `bin` của MongoDB Database Tools vào `PATH`, sau đó mở PowerShell mới.

## 2. Xuất lại database từ Atlas

Chỉ cần phần này khi muốn tạo lại archive từ Atlas. Không ghi URI Atlas thật vào README, source code hoặc lịch sử Git. Lưu URI tạm trong biến môi trường PowerShell:

```powershell
$env:COHAN_ATLAS_URI="<URI Atlas của bạn>"
```

Tại thư mục gốc project:

```powershell
New-Item -ItemType Directory -Force -Path ".\handover\database" | Out-Null

mongodump `
  --uri="$env:COHAN_ATLAS_URI" `
  --db="RestaurantDB" `
  --archive=".\handover\database\cohan-defense.archive.gz" `
  --gzip
```

Xóa biến chứa URI khỏi terminal sau khi dump:

```powershell
Remove-Item Env:COHAN_ATLAS_URI
```

Kiểm tra archive:

```powershell
Get-Item ".\handover\database\cohan-defense.archive.gz" |
  Select-Object FullName, Length, LastWriteTime
```

Archive hợp lệ phải tồn tại và có `Length` lớn hơn `0`.

## 3. Khôi phục vào MongoDB local

Bảo đảm MongoDB local đang chạy, sau đó thực hiện tại thư mục gốc project:

```powershell
mongorestore `
  --uri="mongodb://127.0.0.1:27017" `
  --archive=".\handover\database\cohan-defense.archive.gz" `
  --gzip `
  --drop
```

Archive đã chứa namespace `RestaurantDB`, vì vậy không cần `--nsFrom` hoặc `--nsTo`.

`--drop` xóa các collection đích trước khi khôi phục. Chỉ dùng với MongoDB local hoặc database thử nghiệm có thể xóa.

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

Sau đó chạy frontend và đăng nhập bằng tài khoản trong [`../Account.md`](../Account.md).

## 5. Kiểm tra sau khi restore

- Backend kết nối đúng database `RestaurantDB`.
- Admin và Customer/User đăng nhập thành công.
- Quan hệ Business, Restaurant và tài khoản hiển thị đúng.
- Không đưa `.env`, URI Atlas hoặc thông tin truy cập Atlas vào Git.

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
