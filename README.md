# Cohan Restaurant App (Frontend)

Ứng dụng frontend React + Vite cho hệ thống Cohan Restaurant.

## Yêu cầu

- Node.js 20+
- npm 10+

## Cấu hình môi trường theo mode

Dự án đã tách profile theo mode của Vite:

- `.env.development` → local development
- `.env.staging` → staging/tunnel preview
- `.env.production` → build/preview production

Các biến liên quan đến Vite dev server:

- `VITE_DEV_BIND_HOST`: host bind local của dev server (`127.0.0.1` hoặc `0.0.0.0`)
- `VITE_DEV_HOST`: host public dùng cho browser/HMR (ví dụ domain ngrok)
- `VITE_DEV_PORT`: cổng dev server
- `VITE_DEV_ORIGIN`: origin public đầy đủ (`https://...`)
- `VITE_DEV_HMR_PROTOCOL`: `ws` hoặc `wss`
- `VITE_DEV_HMR_CLIENT_PORT`: cổng HMR client
- `VITE_DEV_ALLOWED_HOSTS`: danh sách host cho phép, phân tách bằng dấu phẩy

> `vite.config.js` đọc từ `process.env` (được nạp theo mode bằng `loadEnv`) và có fallback an toàn cho local nếu thiếu biến.

## Chạy local chuẩn

```bash
npm install
npm run dev
```

Lệnh trên dùng `--mode development` và đọc `.env.development`.

## Chạy qua tunnel / staging preview

1. Cập nhật `.env.staging` theo domain tunnel thật (ví dụ ngrok, cloudflared).
2. Chạy:

```bash
npm run dev:staging
```

Ví dụ nhanh với ngrok:

```bash
# terminal 1
npm run dev:staging

# terminal 2
ngrok http 5173
```

Sau khi có URL ngrok, cập nhật lại:

- `VITE_DEV_HOST`
- `VITE_DEV_ORIGIN`
- `VITE_DEV_ALLOWED_HOSTS`

để HMR hoạt động ổn định qua HTTPS/WSS.

## Build theo môi trường

```bash
npm run build                 # build mặc định (Vite mode production)
npm run build:staging         # build với .env.staging
npm run build:production      # build với .env.production
```

## Preview build

```bash
npm run preview
```
