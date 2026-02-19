# Upload Storage Migration Note (Local disk -> S3-compatible object storage)

## 1) Mục tiêu
- Không lưu ảnh mới vào `cohan-restaurant-backend/uploads/` trong production.
- Upload flow mới dùng signed URL: backend chỉ ký URL, client upload trực tiếp lên object storage.
- Local disk vẫn giữ cho development mode (`UPLOAD_MODE=local`).

## 2) Biến môi trường cần thêm

```bash
UPLOAD_MODE=s3
UPLOAD_MAX_FILE_SIZE_BYTES=10485760
UPLOAD_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif
UPLOAD_TEMP_RETENTION_MS=86400000

S3_ENDPOINT=https://<your-s3-endpoint>
S3_REGION=auto
S3_BUCKET=<bucket-name>
S3_ACCESS_KEY_ID=<access-key>
S3_SECRET_ACCESS_KEY=<secret-key>
S3_FORCE_PATH_STYLE=true
S3_UPLOAD_PREFIX=uploads
S3_SIGNED_URL_EXPIRES_SEC=900
S3_PUBLIC_BASE_URL=https://cdn.example.com
```

> Nếu chạy local dev: `UPLOAD_MODE=local` và `UPLOAD_DIR=./uploads`.

## 3) API mới
- `POST /upload/sign`
  - Input: `{ mimeType, extension?, fileSize? }`
  - Output: `{ uploadUrl, method, headers, key, publicUrl, expiresInSec }`
- Client dùng `PUT uploadUrl` với header `Content-Type` đúng như backend yêu cầu.
- Sau khi upload xong, gọi `POST /upload/complete` với `{ key }` để backend verify object tồn tại và trả URL cuối.

## 4) Kế hoạch migrate dữ liệu ảnh hiện có

### Bước 1: Freeze ngắn
- Tạm dừng tác vụ ghi ảnh mới (hoặc bật maintenance trong vài phút) để tránh ảnh phát sinh trong lúc sync.

### Bước 2: Đồng bộ file local lên bucket
Ví dụ với `awscli`:

```bash
aws s3 sync cohan-restaurant-backend/uploads s3://<bucket-name>/uploads \
  --endpoint-url <S3_ENDPOINT>
```

### Bước 3: Rewrite URL trong database
- Các bản ghi đang dùng URL kiểu `http(s)://<old-host>/uploads/<file>` cần chuyển sang:
  - `https://<cdn-or-public-base>/uploads/<file>`
- Nếu DB đang lưu path thuần (`/uploads/<file>`) thì prepend bằng `S3_PUBLIC_BASE_URL`.

### Bước 4: Verify
- Chạy script kiểm tra ngẫu nhiên N bản ghi ảnh (HEAD request) để đảm bảo object tồn tại.
- Kiểm tra dashboard/profile/menu hiển thị ảnh đúng.

### Bước 5: Cutover
- Deploy backend với `UPLOAD_MODE=s3`.
- Theo dõi log endpoint `/upload/sign` và `/upload/complete`.

### Bước 6: Rollback plan
- Nếu lỗi storage, tạm chuyển `UPLOAD_MODE=local` để không gián đoạn upload.
- Dữ liệu đã sync vẫn giữ nguyên trong bucket.

## 5) Lưu ý vận hành
- Bucket nên bật lifecycle policy dọn object orphan theo prefix tạm (nếu bạn tách thêm thư mục `tmp/`).
- Nên bật CDN + cache-control cho ảnh public.
- Không commit thư mục `uploads/` vào Git nữa.
