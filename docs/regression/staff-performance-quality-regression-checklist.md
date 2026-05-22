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
