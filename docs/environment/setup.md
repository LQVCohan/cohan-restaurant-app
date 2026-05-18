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

## 5.1) Có thể dùng `.env.example` thay cho `.env` không?

Không. Backend/frontend trong dự án này chỉ tự load file tên **`.env`** ở các vị trí đã khai báo.

- `.env.example` chỉ là **template** để tham khảo key cần có.
- Muốn chạy app, bạn cần tạo `.env` thật (có thể copy từ `.env.example` rồi điền giá trị).
- Để tiện nhất, dùng `npm run env:local` để bootstrap `.env` local an toàn.

> Về bảo mật: commit `.env.example` (không chứa secret thật), nhưng **không commit `.env`**.

## 6) Khi cần thêm biến mới trong tương lai

1. Thêm vào `.env.example` (frontend/backend)
2. Nếu là biến bắt buộc, thêm validate trong `cohan-restaurant-backend/src/config/env.js`
3. Cập nhật file local `.env` tương ứng
4. Không commit giá trị secret thật

## 7) Nếu lỡ commit secret thật trong `.env.example` thì làm gì ngay?

1. **Rotate/Revoke ngay lập tức** toàn bộ secret đã lộ:
   - MongoDB Atlas user/password (`MONGO_URI`)
   - SMTP password/API key
   - JWT secret
   - reCAPTCHA secret (nếu dùng key thật)
2. **Cập nhật secret mới** vào nơi triển khai thật (CI/CD, server, secret manager).
3. **Sửa repo**: thay mọi giá trị nhạy cảm trong `*.example` bằng placeholder an toàn.
4. Nếu repo public hoặc có nhiều người đã pull, cân nhắc **rewrite git history** để giảm phơi lộ lâu dài (ví dụ `git filter-repo` hoặc BFG), sau đó force-push theo quy trình của team.
5. Kiểm tra log/alert của nhà cung cấp (Atlas, SMTP) để phát hiện truy cập bất thường.

> Quan trọng: chỉ xóa secret khỏi file hiện tại **không đủ** nếu secret đã từng push; bạn vẫn phải rotate.


## 8) Production env (triển khai thật)

- Không commit secret hoặc token production vào repository.
- `.env.production` trong repo chỉ là placeholder an toàn để tham chiếu key.
- Giá trị production thật phải được cấu hình trực tiếp trên hosting/CI secret manager (Vercel, Netlify, Docker secrets, Kubernetes secrets...).
- Local development tiếp tục dùng `.env.development` hoặc `npm run env:local`.
