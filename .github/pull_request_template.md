## Mục tiêu thay đổi
- [ ] Mô tả ngắn thay đổi chính

## Security & Privacy checklist
- [ ] Không hard-code secrets/API keys/token vào code hoặc config.
- [ ] Đã rà soát input validation, auth/authz, và các điểm có thể gây injection.
- [ ] Đã cập nhật/kiểm tra dependency mới, không thêm package có rủi ro cao.

## Environment checklist
- [ ] Đã cập nhật `.env.example` / tài liệu môi trường nếu thêm biến mới.
- [ ] Đã kiểm tra tương thích local + CI (Node.js version, scripts, migrations nếu có).
- [ ] Có hướng dẫn rollback hoặc feature flag (nếu thay đổi ảnh hưởng production).

## Testing checklist
- [ ] Đã chạy lint pass.
- [ ] Đã chạy test pass.
- [ ] Đã chạy build pass.
- [ ] Đính kèm bằng chứng test (log, screenshot, hoặc link workflow) khi cần.
