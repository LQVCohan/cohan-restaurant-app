# Checklist demo khóa luận

## 1. Mục tiêu demo

- Demo chức năng hệ thống quản lý nhà hàng theo các vai trò chính.
- Không claim production deployment.
- Không claim máy in phần cứng thật.
- Không claim payment production thật nếu đang dùng sandbox.

## 2. Lệnh kiểm tra trước demo

```bash
git checkout main
git pull origin main
npm run check:conflicts
npm run build
npx vitest run src/__tests__/graphql-schema-validation.test.js --testTimeout 30000
```

Nếu muốn kiểm backend:

```bash
npm --prefix cohan-restaurant-backend test
```

Ghi chú: nếu full backend test quá lâu, chạy targeted tests theo module cần demo.

## 3. Kịch bản demo theo vai trò

### Khách hàng

- Xem nhà hàng/menu.
- Đặt bàn hoặc đặt món.
- Theo dõi đơn.
- Hỏi AI chatbot/handoff nếu có dữ liệu.

### Nhân viên

- Nhận/cập nhật đơn.
- Xem lịch/ca làm nếu có dữ liệu.

### Quản lý

- Dashboard.
- Menu.
- Bàn.
- Đơn hàng.
- Kho.
- Nhân viên/lương.
- Báo cáo.
- UC21 AI chatbot admin.
- UC22 quản lý in ấn.
- Backup/settings nếu cần.

### Admin

- RBAC.
- Phân quyền.
- Audit/security nếu có màn hình.

## 4. Dữ liệu cần chuẩn bị

- Ít nhất 1 nhà hàng.
- Menu có món.
- Bàn.
- Nhân viên.
- Đơn hàng.
- Đặt bàn.
- Khách hàng.
- AI knowledge/safety/settings.
- Máy in demo và print job demo.
- Backup/settings demo nếu có.

## 5. Câu trả lời khi hội đồng hỏi giới hạn

- “Phần in ấn hiện quản lý cấu hình, mẫu phiếu, hàng đợi và retry job; test print là mô phỏng, chưa handshake phần cứng thật.”
- “Phần thanh toán nếu dùng sandbox thì cần merchant production để chạy thực tế.”
- “AI chatbot dùng knowledge base, safety rule, feedback, handoff và evaluation; khi triển khai thật cần giám sát chất lượng và dữ liệu thực tế.”
- “Triển khai production có thể mở rộng bằng CI/CD, staging, storage production và monitoring.”

## 6. Checklist trước giờ bảo vệ

- Build pass.
- Không có conflict marker.
- Tài khoản demo đăng nhập được.
- Database demo có dữ liệu.
- Các trang chính không rỗng.
- Máy chiếu kiểm tra độ phân giải.
- Browser zoom 90% hoặc 100%.
- Tắt extension gây lỗi.
- Chuẩn bị câu trả lời về giới hạn hệ thống.
