# Environment setup (local development)

## Mục tiêu
Tạo lại đầy đủ file môi trường local để dự án chạy bình thường khi developing, nhưng không commit secrets vào Git.

## 1) Khởi tạo env nhanh (khuyến nghị)

Từ thư mục root chạy:

```bash
npm run env:local
```

Lệnh này tạo:
- `/.env` cho frontend (Vite)
- `/cohan-restaurant-backend/.env` cho backend

> Nếu file đã tồn tại thì script sẽ **không ghi đè**.

## 2) Frontend env (`/.env`)

Các biến chính:
- `VITE_API_URL=http://localhost:4000/graphql`
- `VITE_API_WS=ws://localhost:4000/graphql`
- `VITE_RECAPTCHA_SITE_KEY=...`
- `VITE_MAPBOX_TOKEN=...`

## 3) Backend env (`/cohan-restaurant-backend/.env`)

Các biến local-safe đã được bootstrap:
- `NODE_ENV=development`
- `PORT=4000`
- `JWT_SECRET=dev_jwt_secret_change_me`
- `MONGO_URI=mongodb://127.0.0.1:27017/RestaurantDB`
- `ENABLE_EMAIL_VERIFICATION=false` (tránh phụ thuộc SMTP trong local)
- `ENABLE_RECAPTCHA=false` (tránh phụ thuộc secret ngoài trong local)

## 4) Vị trí backend tự tìm `.env`

Backend tự load env theo thứ tự:
1. thư mục đang chạy lệnh (`process.cwd()/.env`)
2. `cohan-restaurant-backend/.env`
3. `/.env` (repo root)

## 5) Bảo mật và Git

Đã cấu hình `.gitignore` để không commit env thật:
- ignore `.env`, `.env.*`
- cho phép commit file mẫu `*.example` và profile mẫu an toàn

## 6) Khi cần thêm biến mới trong tương lai

1. Thêm vào `.env.example` (frontend/backend)
2. Nếu là biến bắt buộc, thêm validate trong `cohan-restaurant-backend/src/config/env.js`
3. Cập nhật file local `.env` tương ứng
4. Không commit giá trị secret thật
