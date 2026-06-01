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

## Polish sau Gemini/Customer notification

### Cấu hình AI insight tùy chọn

Review AI Insight không bắt buộc có API key. Nếu không bật hoặc Gemini lỗi, backend tự dùng heuristic/fallback để demo vẫn chạy ổn định.

```bash
REVIEW_AI_INSIGHTS_ENABLED=true
AI_PROVIDER=gemini
GEMINI_API_KEY=<server-side key>
# optional, ưu tiên hơn AI_CHATBOT_MODEL cho riêng review insight
REVIEW_AI_INSIGHT_MODEL=gemini-1.5-flash
```

Dữ liệu gửi cho Gemini đã được giảm thiểu: tối đa 80 review, chỉ gồm rating/title/content cắt 500 ký tự/tags/topicTags/sentiment; không gửi email, phone, userId hoặc token.

### Checklist ảnh chụp cho slide/báo cáo

- Customer notification bell trên header khi đã đăng nhập.
- Notification “review đã được duyệt” và deep link về `/restaurant/:id#reviews`.
- Notification “nhà hàng đã phản hồi review”.
- Insight card hiển thị source “Gemini AI”, “Heuristic fallback” hoặc “Heuristic summary” kèm độ tin cậy.
- Review Action Center: hàng đợi pending/reported/high-risk/needs-reply.
- Report Center: danh sách report và thao tác resolve/reject.
- Review timeline/audit trong modal detail.
- Export CSV/JSON và file CSV mở đúng tiếng Việt UTF-8 BOM.

### Flow thuyết trình 3–5 phút

1. Khách đăng nhập, mở nhà hàng, gửi review 1–2 sao có tiêu đề/nội dung rõ.
2. Quản lý mở ReviewManagement, thấy NotificationBell/Action Center và duyệt review.
3. Khách nhận notification review published, bấm để quay lại tab Đánh giá.
4. Quản lý gửi official reply; khách nhận notification phản hồi và thấy badge “Phản hồi từ nhà hàng”.
5. Khách report review; quản lý xử lý ở Report Center và xem audit timeline.
6. Quản lý mở analytics/AI insight, giải thích source Gemini optional hoặc heuristic fallback, rồi export CSV/JSON.

### Giải thích kỹ thuật ngắn cho bảo vệ

- Gemini là optional provider: `REVIEW_AI_INSIGHTS_ENABLED=true + AI_PROVIDER=gemini + GEMINI_API_KEY` mới gọi Gemini; lỗi/missing key dùng heuristic không làm hỏng dashboard.
- Notification có scope theo `toUserId`/`toRole`/`restaurantId`; customer guest không bật query nên không bị Unauthorized.
- Review giữ lifecycle verified/pending/moderation/published/rejected/reported, có audit timeline để truy xuất thao tác.
- Realtime notification reuse Socket.IO `user_${uid}` khi backend context có `ctx.io`; polling 8 giây vẫn là fallback chắc chắn.
