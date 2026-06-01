# Review module demo script

## Chuẩn bị seed

```bash
SEED_REVIEW_DEMO=true node cohan-restaurant-backend/scripts/seedReviewDemoData.js
```

Seed script in ra `restaurantId`, manager/customer/staff demo và các bước gợi ý. Nếu account demo dùng provider local, chỉ dùng password do seed script thực sự set.

## Kịch bản quay video/chụp ảnh

1. Customer mở restaurant detail → xem review list có phân trang/load more.
2. Customer mở modal viết review → chọn star rating, nhập tiêu đề/nội dung, xem character counter, chọn staff optional.
3. Gửi review → thông báo pending.
4. Manager mở ReviewManagement → xem Notification Bell và Review Action Center.
5. Click “Cần kiểm duyệt” → pending/reported queue đổi filter.
6. Approve review → customer/public reload thấy review published.
7. Manager mở detail review → gửi official reply.
8. Customer/public thấy badge “Phản hồi từ nhà hàng”.
9. Customer report review → nút report disabled sau khi gửi.
10. Manager xem report queue/high risk/notification → resolve report.
11. Manager mở modal detail → xem Audit timeline.
12. Manager xem analytics insight heuristic/AI fallback và export CSV.

## Checklist ảnh phụ lục

- Customer review list + Load more.
- Write review modal star input + character counter.
- Pending review manager.
- Official reply badge.
- Report modal + disabled after submit.
- Report/action center high-risk.
- Review timeline audit.
- Notification bell unread/read trong ReviewManagement; customer notification rows đã seed/backend-ready và có thể gắn vào CustomerLayout ở follow-up.
- CSV export mở được tiếng Việt UTF-8 BOM.
- Staff performance evidence khi review gắn staff.
