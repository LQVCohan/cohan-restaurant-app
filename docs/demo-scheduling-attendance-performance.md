# Demo scheduling/attendance/performance (PR21)

## Mục tiêu
Seed dữ liệu demo **idempotent** cho toàn bộ luồng scheduling → attendance → payroll validation → performance → appeal/reversal.

## Chạy seed
```bash
cd cohan-restaurant-backend
npm run seed:demo:scheduling
# reset dữ liệu demo (không xoá dữ liệu thật)
npm run seed:demo:scheduling -- --reset
```

> Chỉ dùng local/dev. Không dùng production.

## Demo accounts
- admin.demo@cohan.local (ADMIN)
- manager.demo@cohan.local (MANAGER)
- hr.demo@cohan.local (HR)
- accountant.demo@cohan.local (ACCOUNTANT)
- staff.fulltime.demo@cohan.local (STAFF full_time)
- staff.parttime.demo@cohan.local (STAFF part_time)
- staff.exception.demo@cohan.local (STAFF exception)

Password mặc định: `Demo@123456` (hoặc `DEMO_PASSWORD` env).

## Dữ liệu demo
- Restaurant: **Cohan Demo Restaurant - District 1** (`_id: 69ce9e2e8d8d711f12e251b1`).
- Kỳ lịch: tuần kế tiếp (Monday-Sunday UTC) so với ngày chạy seed.
- Shift template: morning `08:00-14:00`, evening `16:00-22:00`.
- Schedule status: published.

## Kịch bản demo E2E
1. Manager vào `/manager` kiểm tra schedule đã publish.
2. Staff vào route schedule/attendance để xem ca và chấm công.
3. Manager kiểm tra off-schedule pending.
4. Staff tạo/đã có correction và overtime request mẫu.
5. Manager duyệt/từ chối theo workflow có sẵn.
6. Accountant/Manager chạy payroll validation cho kỳ demo.
7. Manager vào `/manager/performance` review incident, mark eligible/waive/apply score.
8. Staff vào `/staff/performance` xem điểm và lịch sử điều chỉnh.
9. Staff gửi appeal.
10. Manager accept appeal + reverse score.
11. Kiểm tra notifications (unread/read).

## Expected results chính
- Có ca hợp lệ, ca unavailable-warning, acknowledgement accepted/declined.
- Có timesheet đúng lịch, đi trễ, về sớm, off-schedule pending.
- Có correction pending + applied.
- Có overtime approved chưa complete + completed.
- Có payroll period mở để validate issue pending.
- Có incidents ở các trạng thái pending/eligible/applied/waived/reversed.
- Có appeal accepted và score reversal.

## Ghi chú
- PR21 không thay payroll runtime, scoring rule, lifecycle core.
- Nếu thiếu biến môi trường DB (`MONGO_URI`/`MONGO_DB`) thì script không thể seed dữ liệu thật; vẫn có thể check syntax/import bằng lệnh node.
