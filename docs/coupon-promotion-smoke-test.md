# Coupon/Promotion Smoke Test (Demo)

## Mục tiêu
Đảm bảo UI Coupon/Promotion và Checkout hiển thị đầy đủ breakdown giảm giá, invoice meta breakdown và analytics hoạt động.

## Checklist thủ công
1. **Seed demo data**
   - Chạy seed demo coupon/promotion ở backend.
2. **Save ACTIVE10**
   - Vào trang Coupon khách hàng.
   - Bấm lưu coupon `ACTIVE10` và thấy badge **Đã lưu**.
3. **Use ACTIVE10**
   - Vào POS/Checkout nhập `ACTIVE10`.
   - Bấm Áp dụng và kiểm tra các dòng: subtotal, couponDiscount, promotionDiscount, shippingDiscount, totalDiscount, grandTotal.
4. **BOGO payment**
   - Chọn promotion loại BOGO.
   - Thanh toán và kiểm tra breakdown hiển thị type **Mua tặng**, source (Dòng món/Đơn hàng/Phí vận chuyển), số tiền giảm.
5. **FREESHIP payment**
   - Chọn promotion FREESHIP.
   - Kiểm tra shipping discount hiển thị rõ.
6. **COMBO payment**
   - Chọn promotion COMBO.
   - Kiểm tra dòng breakdown đúng loại **Combo**.
7. **Invoice meta breakdown**
   - Sau thanh toán, mở chi tiết invoice/payment.
   - Nếu có `invoice.meta.appliedPromotionBreakdown`, xác nhận phần “Chi tiết khuyến mãi” hiển thị readable rows (không raw JSON).
8. **Dashboard analytics**
   - Mở Promotion Management.
   - Kiểm tra trạng thái loading/empty/error thân thiện và hook analytics thật vẫn trả dữ liệu.
9. **EXPIRED10 reject**
   - Áp coupon hết hạn và xác nhận bị từ chối với lý do rõ ràng.
10. **USERONLY second redemption reject**
    - Dùng coupon USERONLY lần 2 với cùng user và xác nhận reject.
11. **LIMIT5 cap reject**
    - Vượt giới hạn LIMIT5 và xác nhận reject.

## Kết quả mong đợi
- Mọi dòng giảm giá trong demo có thể giải thích trực quan.
- UI loading/empty/error của Coupon/Promotion rõ ràng.
- Invoice/payment hiển thị breakdown khuyến mãi dễ đọc.
