# COHAN — Xuất database Atlas và khôi phục về local

Thư mục này dành cho file database bàn giao:

```text
cohan-defense.archive.gz
```

File archive chứa database và sample data. Người nhận restore file này vào MongoDB local; không cần quyền truy cập Atlas và không cần chạy seed.

## 1. Chuẩn bị MongoDB Database Tools

Kiểm tra trong PowerShell:

```powershell
mongodump --version
mongorestore --version
```

Nếu Windows không nhận lệnh, thêm thư mục `bin` của MongoDB Database Tools vào `PATH`, sau đó mở PowerShell mới.

## 2. Xuất database từ Atlas

Không ghi URI Atlas thật vào README, source code hoặc lịch sử Git. Lưu URI tạm trong biến môi trường PowerShell:

```powershell
$env:COHAN_ATLAS_URI="mongodb+srv://<user>:<password>@<cluster>/"
```

Đặt đúng tên database nguồn. Ví dụ database Atlas là `RestaurantDB_DefenseTest`:

```powershell
New-Item -ItemType Directory -Force -Path ".\handover\database" | Out-Null

mongodump `
  --uri="$env:COHAN_ATLAS_URI" `
  --db="RestaurantDB_DefenseTest" `
  --archive=".\handover\database\cohan-defense.archive.gz" `
  --gzip
```

Xóa biến chứa URI khỏi terminal sau khi dump:

```powershell
Remove-Item Env:COHAN_ATLAS_URI
```

Kiểm tra file:

```powershell
Get-Item ".\handover\database\cohan-defense.archive.gz" |
  Select-Object FullName, Length, LastWriteTime
```

Chỉ bàn giao khi file tồn tại và `Length` lớn hơn `0`.

## 3. Khôi phục vào MongoDB local

Bảo đảm MongoDB local đang chạy. Nếu database trong archive đã tên là `RestaurantDB`:

```powershell
mongorestore `
  --uri="mongodb://127.0.0.1:27017" `
  --archive=".\handover\database\cohan-defense.archive.gz" `
  --gzip `
  --drop
```

Nếu database nguồn trên Atlas là `RestaurantDB_DefenseTest` và muốn đổi thành `RestaurantDB` ở local:

```powershell
mongorestore `
  --uri="mongodb://127.0.0.1:27017" `
  --archive=".\handover\database\cohan-defense.archive.gz" `
  --gzip `
  --drop `
  --nsFrom="RestaurantDB_DefenseTest.*" `
  --nsTo="RestaurantDB.*"
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

Sau đó khởi động frontend và đăng nhập bằng tài khoản trong `../Account.md`.

## 5. Kiểm tra trước khi bàn giao

- Restore thử archive vào một MongoDB local sạch.
- Backend kết nối đúng database `RestaurantDB`.
- Admin và Customer/User đăng nhập thành công.
- Quan hệ Business, Restaurant và tài khoản vẫn hiển thị đúng.
- File archive không chứa `.env`, URI Atlas hoặc thông tin truy cập Atlas; `mongodump` chỉ sao lưu dữ liệu MongoDB đã chọn.

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

File archive chưa được tạo trong repository ở bước cập nhật tài liệu này. Hãy thêm đúng tên file sau khi đã dump và restore thử thành công.
