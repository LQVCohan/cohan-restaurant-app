# Runbook vận hành backend/frontend

## 1) Kiểm tra health

### Liveness
```bash
curl -s http://localhost:4000/health/live
```
Kỳ vọng: `ok=true`, `status=live`.

### Readiness
```bash
curl -s -i http://localhost:4000/health/ready
```
Kỳ vọng:
- HTTP `200` khi DB sẵn sàng.
- HTTP `503` khi DB/dependency chưa sẵn sàng.

## 2) Kiểm tra metrics cơ bản

```bash
curl -s http://localhost:4000/metrics
```
Theo dõi các trường chính:
- `latency.p95Ms`: p95 latency.
- `requests.errorRate`: error rate.
- `db.connected`: trạng thái kết nối DB.

## 3) Logging chuẩn hoá

Backend log theo structured JSON với các field bắt buộc:
- `requestId`
- `userId`
- `latencyMs`
- `errorCode` (khi lỗi)

Khuyến nghị:
- Luôn truyền `x-request-id` từ gateway/load balancer.
- Đồng bộ `requestId` giữa frontend/backend để trace xuyên suốt.

## 4) Error tracking

### Backend
- Bật bằng biến môi trường: `SENTRY_DSN_BACKEND`.
- Nếu chưa cài SDK hoặc DSN rỗng, hệ thống fallback về structured logging.

### Frontend
- Bật bằng biến môi trường: `VITE_SENTRY_DSN_FRONTEND`.
- Nếu chưa có SDK/DSN, fallback về `window.onerror` và `unhandledrejection`.

## 5) Xử lý incident nhanh

1. **Xác định mức độ ảnh hưởng**
   - Check `/health/live`, `/health/ready`, `/metrics`.
2. **Khoanh vùng**
   - Lọc log theo `requestId`/`errorCode`.
3. **Kiểm tra phụ thuộc**
   - DB connection (`db.connected`, `/health/ready`).
4. **Mitigation**
   - Rollback deployment gần nhất nếu error rate tăng mạnh.
   - Tăng tài nguyên hoặc restart process nếu chỉ là quá tải tạm thời.
5. **Postmortem**
   - Ghi lại timeline, root cause, action item (monitoring/alert/test).
