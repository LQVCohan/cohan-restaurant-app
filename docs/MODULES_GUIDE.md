# Modules Guide

## Menu management

Quản lý category/item, ảnh món, trạng thái bán và dữ liệu demo. Ảnh local phù hợp demo; production nên đi qua upload storage có kiểm soát. Checklist chính: CRUD, quyền manager, seed demo, responsive và rollback dữ liệu.

## Order, POS, reservation và print

Order flow bao gồm tạo/cập nhật đơn, reservation time range, parent-child lifecycle cho các trường hợp tách/gộp/liên kết đơn và trạng thái in ấn. POS smoke test cần kiểm tra tạo order, đổi trạng thái, tính tổng, áp coupon, in bill/kitchen queue và xử lý lỗi.

## Delivery tracking

Delivery tracking hiện tập trung status-only: trạng thái giao hàng rõ ràng, không overfit vào tracking map nếu chưa có provider. UI cần hiển thị trạng thái, thời gian cập nhật và fallback khi chưa có đơn giao.

## Payment reconciliation

Module payment demo ghi nhận online payment/chuyển khoản, trạng thái đối soát và điểm kiểm tra dữ liệu giữa order/payment/report. Cần tránh hiển thị trạng thái thanh toán mơ hồ khi transaction chưa confirmed.

## Coupon/promotion

Các kịch bản demo gồm coupon giảm giá trực tiếp (`ACTIVE10`), BOGO, freeship, combo và analytics. Điều kiện áp dụng cần rõ: thời gian, trạng thái active, min order, menu item/category và giới hạn sử dụng.

## AI chatbot

Chatbot dùng knowledge/intent cho menu, đặt bàn, khuyến mãi, chính sách và hướng dẫn khách hàng. QA cần kiểm tra câu hỏi đúng intent, câu hỏi ngoài phạm vi, lỗi backend và nội dung fallback an toàn.

## RBAC và audit log

RBAC quản lý permission matrix, role seed, route guard frontend và resolver/service authorization backend. Các hành động nhạy cảm cần audit log để phục vụ production readiness.

## Review/rating/feedback

Review module hỗ trợ khách gửi đánh giá, manager xem/lọc/xử lý feedback và các checklist hardening như validation, moderation, pagination, auth và E2E smoke.

## Scheduling, attendance, payroll và performance

Luồng nhân sự gồm published shift binding, attendance exception, overtime/correction, payroll readiness, performance scoring policy, incident/appeal và regression checklist. Demo nên dùng seed/verify scripts để tránh dữ liệu lệch.

## Staff performance quality logic

Điểm hiệu suất nên được giải thích bằng thành phần rõ ràng: attendance, task/order quality, incident, appeal/correction và ngưỡng/tolerance. Regression cần kiểm tra cả công thức core và UI filter theo tháng.

## Nearby restaurant search

Nearby search cần dữ liệu tọa độ nhà hàng, backfill location nếu thiếu và fallback khi người dùng từ chối permission vị trí.

## Restaurant config backup/import

Snapshot cấu hình hỗ trợ sao lưu/khôi phục nhà hàng. Import cần validate, idempotent, audit log và báo cáo kết quả để quản lý hiểu thay đổi nào được tạo/cập nhật/bỏ qua.

## Modal/draft persistence và mock cleanup

Modal có draft persistence chỉ nên áp dụng cho form dài hoặc nghiệp vụ dễ mất dữ liệu. Trước release, kiểm tra mock/legacy cleanup để tránh dữ liệu giả xuất hiện trong flow production.
