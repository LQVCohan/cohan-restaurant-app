# Staff Performance & Quality Logic

## 1. Công thức tổng

Final Performance Score gồm:
- Productivity: 25%
- Punctuality: 25%
- Quality: 20%
- Manager Review: 20%
- Compliance: 10%

Ghi rõ:
- Không đổi `PERFORMANCE_WEIGHTS` sau PR #713.
- Kitchen metrics không tự làm `hasPerformanceActivity = true`.
- Performance chỉ được tính lại khi manager chủ động recalculate.

## 2. Productivity

Ghi:
- Dựa trên mức hoàn thành thời lượng làm việc so với lịch/ca.
- Không dùng order benchmark làm nguồn chính để tránh bất công do lượng khách không ổn định.
- Không dùng số order để so nhân viên ở các ca/khu vực khác nhau.

## 3. Punctuality

Ghi:
- Dựa trên attendance records:
  - đi trễ
  - về sớm
  - vắng mặt
  - phút vi phạm
- Nếu không có dữ liệu attendance thì dùng điểm trung lập theo logic hiện tại.

## 4. Quality

Ghi công thức:

Quality Score = baseSkillScore - roleEvidencePenalty

Trong đó:
- `baseSkillScore = review.skillScore` nếu manager đã nhập review.
- Nếu chưa có manager review thì `baseSkillScore = 75`.
- Không có evidence xấu thì không trừ tự động.
- Có evidence xấu thì trừ nhẹ, có giới hạn.
- Các role khác ngoài nhóm chính giữ `skillScore`.

## 5. Role-aware Quality

### Order staff / phục vụ

Nguồn:
- `skillScore` từ manager review.
- `customerRatingScore` nếu review khách hàng gắn với nhân viên.

Logic:
- `customerRatingScore` thấp hơn 75 thì trừ nhẹ.
- Không dùng số lượng order.
- Không dùng doanh thu.
- Không dùng lượng khách.

### Cashier / thu ngân

Nguồn:
- `skillScore` từ manager review.
- `customerRatingScore` nếu có dữ liệu gắn với cashier.

Logic:
- customer penalty nhẹ hơn order staff.
- Chưa dùng payment metrics trong giai đoạn này.
- Payment error/refund/cash drawer discrepancy là hướng phát triển sau.

### Bếp chính / head chef

Nguồn:
- `skillScore` từ manager review.
- `kitchenMetrics`:
  - `lateItems`
  - `veryLateItems`
  - `kitchenRelatedReturnedItems`
  - `kitchenRelatedCancelledItems`
  - `unacceptedItems` với trọng số nhẹ hơn

Logic:
- Không dùng `returnedItems`/`cancelledItems` raw.
- Chỉ dùng `kitchenRelatedReturnedItems`/`kitchenRelatedCancelledItems` đã lọc lý do liên quan bếp.
- Bếp chính chịu nhiều hơn ở `veryLateItems` và món trả/hủy do lỗi bếp.

### Phụ bếp / assistant chef

Nguồn:
- `skillScore` từ manager review.
- `kitchenMetrics`:
  - `unacceptedItems`
  - `lateItems`
  - `veryLateItems`
  - `kitchenRelatedReturnedItems`
  - `kitchenRelatedCancelledItems`

Logic:
- Phụ bếp chịu chính ở món chưa nhận.
- Món trả/hủy do lỗi bếp chỉ trừ nhẹ.
- Không trừ phụ bếp bằng raw `cancelledItems`/`returnedItems`.

### Other roles

Nguồn:
- `skillScore` từ manager review.

Logic:
- Không dùng kitchen metrics.
- Không dùng customer rating nếu không phù hợp.
- Không thêm checklist nguyên liệu, payment metrics, inventory metrics trong giai đoạn này.

## 6. Kitchen/bar metrics

Ghi:
- Kitchen/bar metrics được aggregate vào snapshot factors.
- Sau PR #713, kitchen metrics có thể ảnh hưởng Quality thông qua `qualityEvidence`.
- Raw metrics vẫn dùng để hiển thị/report.
- Penalty bếp chỉ dùng field đã lọc:
  - `kitchenRelatedCancelledItems`
  - `kitchenRelatedReturnedItems`

Không dùng trực tiếp:
- `cancelledItems`
- `returnedItems`

Lý do:
- Khách đổi ý, order sai, sai bill không được trừ bếp.

## 7. Phân loại lý do hủy/trả món

Ghi các category:
- `kitchen_quality`
- `kitchen_delay`
- `kitchen_wrong_item`
- `kitchen_unavailable`
- `service_order_mistake`
- `customer_request`
- `payment_or_bill`
- `unknown`

Kitchen-related gồm:
- `kitchen_quality`
- `kitchen_delay`
- `kitchen_wrong_item`
- `kitchen_unavailable`

Không kitchen-related:
- `service_order_mistake`
- `customer_request`
- `payment_or_bill`
- `unknown`

Ví dụ kitchen-related:
- Món cháy / khét
- Món sống hoặc chưa chín
- Món nguội
- Bếp làm sai món
- Ra món quá lâu
- Hết món / hết nguyên liệu

Ví dụ không trừ bếp:
- Nhân viên nhập sai món
- Khách đổi ý
- Khách gọi nhầm
- Sai bill / sai hóa đơn

## 8. Unaccepted audit

Ghi:
- Khi recalculate performance, hệ thống refresh unaccepted kitchen work items.
- Không dùng `periodEnd` tương lai làm `now`.
- `resolveUnacceptedAuditNow` dùng `min(current time, periodEnd)`.
- Snapshot lưu `unacceptedAuditEffectiveAt` để biết audit dùng mốc nào.

## 9. Report/UI/CSV

Ghi:
- Detail panel hiển thị "Cơ sở điểm Quality".
- Report HTML có section Quality evidence.
- CSV chỉ thêm note "Quality có điều chỉnh theo dữ liệu vai trò" khi `totalPenalty > 0`.
- Nếu `totalPenalty = 0` thì không nói là đã bị trừ điểm.
- Không hiển thị copy "chưa ảnh hưởng điểm" khi `kitchenPenalty > 0`.

## 10. Out of scope / phát triển sau

Ghi rõ chưa làm:
- Checklist nguyên liệu.
- Payment metrics cho cashier.
- Inventory metrics cho kho.
- Incident/penalty tự động mới.
- Thay đổi `PERFORMANCE_WEIGHTS`.
- Áp KPI order count/doanh thu/lượng khách cho productivity.

## 11. Regression checklist

Link tới:
- `../regression/staff-performance-quality-regression-checklist.md`

Không sửa code.
Không đổi test.
Không đổi schema.
Không đổi công thức.

## Cashier Quality Logic

- `baseSkillScore`: dùng `review.skillScore` nếu có đánh giá quản lý, nếu không dùng trung lập `75`.
- `customerPenalty`: giữ nguyên logic hiện tại cho thu ngân (`<= 5` điểm khi `customerRatingScore < 75` và có review).
- `cashierOperationalPenalty`: mới, tính theo các tỷ lệ issue nghiệp vụ thu ngân và giới hạn tối đa `15`.

Công thức:
- `cashierQualityScore = baseSkillScore - customerPenalty - cashierOperationalPenalty`
- `cashierOperationalPenalty = min(15, wrongBillRate*8 + paymentErrorRate*6 + cashierRefundRate*8 + cashVarianceRate*20 + latePaymentRequestRate*4 + unauthorizedDiscountRate*6)`

Bao gồm các nhóm issue:
- Sai bill có thể quy trách nhiệm thu ngân (void/return đã duyệt và reason/reviewNote/payment clear reason có keyword phù hợp).
- Lỗi thanh toán có thể quy trách nhiệm thu ngân (tránh phạt lỗi provider/system callback).
- Refund do thao tác thu ngân.
- Xử lý chậm `PAYMENT_REQUEST` (>3 phút để acknowledge hoặc >8 phút để resolve).
- Discount không hợp lệ (discount thủ công thiếu lý do và không có voucher/promotion hợp lệ).

Loại trừ (không phạt thu ngân):
- Lý do thuộc khách/bếp/hệ thống/cổng thanh toán hoặc không đủ dữ liệu quy trách nhiệm.
- Voucher/promotion hợp lệ.

Ghi chú:
- `cashVarianceRate` hiện đặt `0` (chưa có dữ liệu reconciliation ca thu ngân); sẽ bổ sung khi có mô hình dữ liệu phù hợp.
- Điểm chất lượng vẫn giữ clamp hiện tại: nếu có penalty thì không thấp hơn `50`; fallback trung lập vẫn là `75` khi thiếu evidence.
