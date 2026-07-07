# Tạo file MongoDB để bàn giao COHAN

Thư mục này dành cho file database được xuất từ MongoDB sau khi đã chạy seed. File đề xuất:

```text
cohan-defense.archive.gz
```

## 1. Chuẩn bị

Cài **MongoDB Database Tools** và bảo đảm lệnh sau chạy được trong PowerShell:

```powershell
mongodump --version
mongorestore --version
```

Nếu Windows báo không nhận lệnh, thêm thư mục `bin` của MongoDB Database Tools vào biến môi trường `PATH`, sau đó mở lại PowerShell.

## 2. Tạo dữ liệu mẫu

Tại thư mục gốc của project:

```powershell
npm run seed:defense -- --reset
```

Chỉ tiếp tục khi lệnh seed kết thúc thành công.

## 3. Xuất database vào folder đã chuẩn bị

Chạy tại thư mục gốc project:

```powershell
New-Item -ItemType Directory -Force -Path ".\handover\database" | Out-Null

mongodump `
  --uri="mongodb://127.0.0.1:27017/RestaurantDB" `
  --archive=".\handover\database\cohan-defense.archive.gz" `
  --gzip
```

Kiểm tra file vừa tạo:

```powershell
Get-Item ".\handover\database\cohan-defense.archive.gz" |
  Select-Object FullName, Length, LastWriteTime
```

Nếu `MONGO_URI` hoặc `MONGO_DB` trong `cohan-restaurant-backend/.env` khác cấu hình trên, thay URI và tên database trong lệnh `mongodump` cho đúng.

## 4. Khôi phục database trên máy khác

Cài MongoDB và MongoDB Database Tools, đặt file archive đúng vị trí, sau đó chạy tại thư mục gốc project:

```powershell
mongorestore `
  --uri="mongodb://127.0.0.1:27017/RestaurantDB" `
  --archive=".\handover\database\cohan-defense.archive.gz" `
  --gzip `
  --drop
```

`--drop` xóa collection đích trước khi khôi phục. Chỉ sử dụng với database local hoặc staging đã xác định đúng.

## 5. Cấu trúc folder bàn giao

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

File archive được `.gitignore` để tránh vô tình đẩy dữ liệu và file dung lượng lớn lên GitHub. File vẫn nằm trong project local và có thể được đưa vào file ZIP bàn giao offline.
