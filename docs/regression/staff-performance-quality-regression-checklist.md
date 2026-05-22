# Staff Performance Quality Regression Checklist

## Recalculate
- [ ] Tính lại kỳ quá khứ không dùng current time thay periodEnd.
- [ ] Tính lại kỳ tương lai không mark unaccepted theo mốc tương lai.
- [ ] Snapshot có unacceptedAuditEffectiveAt.

## Order reason
- [ ] Trả món với "Món nguội" tạo issueReasonKitchenRelated = true.
- [ ] Trả món với "Khách đổi ý" tạo issueReasonKitchenRelated = false.
- [ ] Sai bill không trừ bếp.

## Quality
- [ ] Bếp chính bị điều chỉnh bởi veryLate/kitchen-related return/cancel.
- [ ] Phụ bếp bị điều chỉnh chủ yếu bởi unaccepted.
- [ ] Order staff bị điều chỉnh nhẹ bởi customer rating thấp.
- [ ] Cashier bị điều chỉnh nhẹ hơn order staff.
- [ ] Role khác giữ skillScore.
- [ ] Kitchen metrics không tự làm hasPerformanceActivity true.

## UI/report/CSV
- [ ] Detail panel hiển thị "Cơ sở điểm Quality".
- [ ] Report HTML có section Quality evidence.
- [ ] CSV không duplicate note.
- [ ] OrderModal reason preset hoạt động.

## Cashier Quality Regression

- [ ] Sai bill có reason liên quan thu ngân mới trừ điểm.
- [ ] Khách đổi ý / lỗi bếp / lỗi hệ thống không trừ thu ngân.
- [ ] Payment request xử lý chậm có tính penalty.
- [ ] Voucher/promotion hợp lệ không bị tính là discount issue.
- [ ] Manual discount thiếu lý do hoặc sai quyền có thể bị tính issue.
- [ ] Operational penalty capped at 15.
- [ ] Quality evidence hiển thị cashierOperationalPenalty và cashierMetrics.
- [ ] Cashier operational issue không có manager review/customer rating vẫn giảm Quality.
- [ ] Late PAYMENT_REQUEST chỉ trừ điểm cashier thực sự acknowledge/resolve trễ.
- [ ] Refund không bị double-count thành cả paymentError và cashierRefund.
- [ ] evidenceSource phân biệt đúng neutral_skill và manager_skill.
