# POS QA Audit Checklist (2026-04-14)

## 1) Phạm vi & cách đánh giá
- **Phạm vi yêu cầu:** order món, order kèm ảnh, gộp/tách đơn, quản lý đơn, cập nhật thông tin khách, thông tin bàn, đặt bàn, in bill, thanh toán, đơn mang đi/khách tới lấy, thanh toán shipping.
- **Cách đánh giá trong vòng này:** kiểm tra tĩnh theo mã nguồn FE/BE + luồng GraphQL đã khai báo (không chạy E2E thực tế trên trình duyệt ở vòng này).
- **Kết luận mức độ:**
  - ✅ **Đã có**: có luồng rõ ràng trong code.
  - ⚠️ **Một phần**: có nền tảng nhưng thiếu end-to-end hoặc thiếu mutation/UI hoàn chỉnh.
  - ❌ **Chưa thấy**: chưa tìm thấy luồng thực thi trong code active.

## 2) Checklist tính năng (có ID test case)

| ID | Hạng mục | Trạng thái | Bằng chứng kỹ thuật | Ghi chú tester |
|---|---|---|---|---|
| POS-ORD-001 | Tạo order dine-in theo bàn | ✅ Đã có | `createOrderForTable`, `saveOrder()` yêu cầu bàn cho dine-in. | Luồng chính ổn, có validate order rỗng. |
| POS-ORD-002 | Tạo order delivery/takeaway | ✅ Đã có | `createOffPremiseOrder`, `orderType` gồm `delivery/takeaway`. | Có validate thông tin khách + địa chỉ cho delivery. |
| POS-ORD-003 | Order kèm ảnh/proof | ✅ Đã có | Item có `image`, `proofImages`; payload gửi `proofImages`. | Nên test giới hạn số lượng/dung lượng ảnh ở BE. |
| POS-ORD-004 | Gộp món trong cùng đợt | ✅ Đã có | `mergeGroupItems`, signature có modifiers/note/proofImages. | Logic gộp khá chặt để tránh gộp nhầm món. |
| POS-ORD-005 | Gộp bàn | ✅ Đã có | `mergeTables` mutation ở `useTableManagement`. | Cần test cạnh tranh khi nhiều máy thao tác cùng lúc. |
| POS-ORD-006 | Tách bàn | ✅ Đã có | `splitTables` mutation ở `useTableManagement`. | Cần test trạng thái bàn sau tách với order đang active. |
| POS-ORD-007 | Tách bill (split bill theo order) | ⚠️ Một phần | BE model có `parentOrderCode` cho split bill. | Chưa thấy mutation/UI split bill cụ thể trong FE active. |
| POS-ORD-008 | Quản lý đơn (list now/all, detail, status) | ✅ Đã có | Có `ordersByRestaurantNow`, `ordersByRestaurant`, `GET_ORDER`, update status item/order. | Đủ nền tảng để theo dõi & vận hành đơn. |
| POS-CUS-001 | Cập nhật thông tin khách theo order | ✅ Đã có | `updateOrderCustomerByCode` + helper attach từ reservation. | Nên bổ sung audit log hiển thị tại UI quản trị. |
| POS-TBL-001 | Quản lý thông tin bàn (CRUD/status/move/swap/merge/split) | ✅ Đã có | `useTableManagement` có đầy đủ mutation liên quan bàn. | Cần regression test khi đổi mã bàn (swap). |
| POS-RSV-001 | Đặt bàn | ✅ Đã có | `createReservationForTable`, validate phone/email/capacity/time conflict. | Có xử lý lỗi nghiệp vụ khá đầy đủ. |
| POS-BIL-001 | In bill / in phiếu | ⚠️ Một phần | Có `printSettings`, `printers`, `printQueue` state và model `printStatus`. | Chưa thấy action in bill hoàn chỉnh ở code active POS. |
| POS-PAY-001 | Thanh toán dine-in tại POS | ✅ Đã có | `payOrdersByTableId`, `preparePayment/confirmPayment`. | Có check tiền mặt >= tổng tiền. |
| POS-PAY-002 | Thanh toán đơn delivery/takeaway ngay tại POS hiện tại | ✅ Đã có | Bổ sung mutation thanh toán theo `orderIds` và mở luồng PaymentModal cho off-premise. | Cần test hồi quy create/save/payment nhiều lần để tránh tạo đơn trùng. |
| POS-TAK-001 | Tạo đơn mang đi | ✅ Đã có | `startTakeawayOrder()` set `orderType=takeaway`. | Có virtual table `TAKEAWAY`. |
| POS-TAK-002 | Luồng “khách tới lấy” | ⚠️ Một phần | `deliveryMethod: pickup_at_store` trong takeaway. | Chưa thấy state machine riêng cho “đã tới lấy/đã nhận hàng”. |
| POS-ID-001 | Đầy đủ ID dữ liệu item/order | ⚠️ Một phần | FE bắt buộc `dishId/menuId/categoryId/servingKey`; thiếu thì skip item. | Cần dashboard theo dõi tỷ lệ món bị skip do thiếu ID. |

## 3) Trả lời trực tiếp câu hỏi “thanh toán cho đơn shipping đã làm được chưa?”
- **Nếu hỏi trong màn POS hiện tại:** **đã có** (hỗ trợ thanh toán `delivery/takeaway` theo `orderIds`).  
- Với order `delivery/takeaway`, PaymentModal có thể thực hiện checkout ngay sau bước prepare/save.

## 4) Các vấn đề tiềm ẩn (risk)
1. **Split bill chưa hoàn thiện E2E**: model có nền tảng (`parentOrderCode`) nhưng thiếu mutation/UI rõ ràng.
2. **In bill chưa rõ điểm bấm thực thi**: có cấu hình máy in và queue, nhưng chưa thấy hành động “in hóa đơn” hoàn chỉnh trong code active.
3. **Rủi ro mất món do thiếu ID**: item thiếu trường bắt buộc sẽ bị bỏ qua khi save (không fail toàn bộ đơn) → có thể lệch kỳ vọng vận hành.
4. **Takeaway pickup chưa có trạng thái chi tiết**: có `pickup_at_store` nhưng chưa thấy luồng trạng thái tường minh “khách đến lấy / đã giao tận tay”.
5. **Tương tác người dùng khi thanh toán dùng `window.confirm`**: cần kiểm tra UX trên tablet/PWA/kiosk vì hành vi popup trình duyệt có thể không đồng nhất.

## 5) Đề xuất test execution vòng tiếp theo (manual + API)
- Ưu tiên test E2E theo thứ tự: **POS-PAY-002 → POS-BIL-001 → POS-ORD-007 → POS-TAK-002**.
- Bổ sung test dữ liệu xấu cho ID món: thiếu `servingKey`, sai `categoryId`, ảnh proof rỗng/lớn.
- Bổ sung metric vận hành:
  - Tỷ lệ item bị skip do thiếu ID.
  - Tỷ lệ đơn delivery tạo thành công nhưng chưa thanh toán.
  - Tỷ lệ job in thất bại/retry.
