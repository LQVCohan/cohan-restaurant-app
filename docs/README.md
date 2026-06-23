# Cohan Restaurant App — Documentation Hub

Kho tài liệu đã được chuẩn hoá thành các tài liệu dài hạn, dễ bàn giao và dễ tra cứu. Các checklist/demo/audit rời rạc trước đây đã được tổng hợp vào các nhóm dưới đây để tránh trùng lặp.

## Bộ tài liệu chính

| Nhóm | Tài liệu | Mục đích |
| --- | --- | --- |
| Tổng quan | [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) | Kiến trúc, luồng nghiệp vụ, cấu trúc frontend/backend và dữ liệu chính. |
| Vận hành | [`OPERATIONS_GUIDE.md`](./OPERATIONS_GUIDE.md) | Cài đặt local, biến môi trường, deploy single-server, health/metrics, upload storage, backup/restore, runbook sự cố. |
| Kiểm thử | [`QA_GUIDE.md`](./QA_GUIDE.md) | Lệnh test, checklist regression, smoke test và tiêu chí production readiness. |
| Demo/bàn giao | [`DEMO_GUIDE.md`](./DEMO_GUIDE.md) | Kịch bản demo cuối, seed data, thứ tự trình diễn và checklist sẵn sàng. |
| Module | [`MODULES_GUIDE.md`](./MODULES_GUIDE.md) | Tóm tắt các module chức năng: menu, order/POS, AI chatbot, RBAC, coupon, review, scheduling, payroll/performance, delivery, payment, config, nearby search. |
| Lưu vết | [`ARCHIVE_INDEX.md`](./ARCHIVE_INDEX.md) | Bảng đối chiếu các file cũ đã được gộp/xoá và nơi nội dung được chuyển vào. |

## Quy ước duy trì tài liệu

1. Tài liệu dùng cho sản phẩm cuối đặt ở `docs/` và ưu tiên 5 file chính ở trên.
2. Không tạo thêm file audit/checklist theo ngày nếu nội dung có thể cập nhật vào `QA_GUIDE.md` hoặc `DEMO_GUIDE.md`.
3. Ghi chú kỹ thuật theo module nên cập nhật vào `MODULES_GUIDE.md` thay vì tạo file rời.
4. Runbook/deploy/env/storage/backup cập nhật vào `OPERATIONS_GUIDE.md`.
5. Nếu cần giữ lịch sử một tài liệu cũ, cập nhật bảng trong `ARCHIVE_INDEX.md` thay vì giữ file trùng lặp.
