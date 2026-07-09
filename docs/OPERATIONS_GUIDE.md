# Operations Guide

## Local development

```bash
npm install
npm install --prefix cohan-restaurant-backend
npm run env:local
npm run db
npm run dev
npm run dev --prefix cohan-restaurant-backend
```

Frontend mặc định chạy qua Vite; backend chạy Fastify/Mercurius. Khi đổi host/port local, cập nhật biến Vite (`VITE_DEV_*`) và backend env tương ứng.

### Local MongoDB runner

Chạy MongoDB local bằng lệnh:

```bash
npm run db
```

Lệnh này tự tìm `mongod` đã cài trên máy, mở MongoDB ở `127.0.0.1:27017`, bật replica set local `rs0`, và dùng thư mục dữ liệu mặc định `C:\data\db` trên Windows. Log mặc định được ghi vào `C:\data\mongod.log` để terminal VS Code không bị lag vì phải render quá nhiều log. Nếu port đã có MongoDB chạy sẵn, lệnh sẽ báo thành công và thoát.

Backend local nên dùng URI replica set:

```env
MONGO_URI=mongodb://127.0.0.1:27017/RestaurantDB?replicaSet=rs0
MONGO_DB=RestaurantDB
```

Có thể ép binary, thư mục dữ liệu hoặc bật log trực tiếp ra terminal khi cần:

```powershell
$env:MONGOD_BIN="C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe"
$env:MONGO_DBPATH="C:\data\db"
$env:MONGO_LOGPATH="console"
npm run db
```

Mở terminal khác để kiểm tra backend kết nối DB:

```bash
npm run db:test
```

## Environment checklist

- Frontend: API/GraphQL endpoint, dev host/port, HMR host nếu chạy qua tunnel/container.
- Backend: MongoDB URI, JWT/cookie secrets, CORS origin, upload storage mode, SMTP/payment provider nếu bật.
- Demo seed: chọn `DEMO_RESTAURANT_ID` ổn định khi cần dữ liệu nhất quán cho menu/coupon/customer/scheduling.
- Không commit `.env` thật; dùng script `npm run env:local` để tạo env local mẫu.

## Health, readiness và metrics

- Liveness: `/health/live` dùng để biết process còn sống.
- Readiness: `/health/ready` dùng để kiểm tra dịch vụ sẵn sàng nhận traffic.
- Metrics: `/metrics` phục vụ quan sát cơ bản khi deploy.

## Single-server deployment

1. Cài Node.js, npm, MongoDB hoặc cấu hình MongoDB managed.
2. Build frontend: `npm run build`.
3. Build/check backend: `npm run build --prefix cohan-restaurant-backend`.
4. Chạy backend bằng process manager (PM2/systemd) với env production.
5. Reverse proxy `/` tới frontend static build và `/graphql`, `/health/*`, `/metrics`, upload/static routes tới backend.
6. Bật HTTPS, CORS allowlist, cookie secure và log rotation.

## Upload storage

- Local disk phù hợp demo/local; S3-compatible object storage phù hợp production.
- Khi migration từ local sang object storage, cần kiểm kê file hiện hữu, upload/bổ sung metadata, kiểm tra URL public/private và rollback plan.
- Menu image strategy: ưu tiên asset ổn định, alt text rõ ràng, tránh phụ thuộc ảnh mock không kiểm soát.

## Backup/import cấu hình nhà hàng

- Snapshot cấu hình cần bao gồm thông tin nhà hàng, menu/category liên quan, cấu hình promotion/RBAC cần thiết và metadata version.
- Import phải idempotent, có validate schema và ghi audit log.
- Trước demo production-like, chạy export thử và restore vào môi trường staging để xác nhận.

## Runbook sự cố nhanh

| Sự cố | Kiểm tra | Hành động |
| --- | --- | --- |
| Backend không sẵn sàng | `/health/ready`, MongoDB URI, logs process | Restart process, kiểm tra DB/network/env. |
| GraphQL lỗi quyền | role/permission seed, token, audit log | Chạy seed RBAC, xác nhận route/action mapping. |
| Ảnh upload lỗi | storage env, quyền bucket/disk, URL resolve | Kiểm tra mode local/S3 và migration metadata. |
| Demo thiếu dữ liệu | seed scripts, `DEMO_RESTAURANT_ID` | Chạy seed demo tương ứng và verify script. |
| Active session key lỗi index local | index MongoDB và dữ liệu session cũ | Repair/drop index ở DB local theo hotfix nội bộ trước khi chạy lại. |
