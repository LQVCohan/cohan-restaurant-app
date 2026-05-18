# Schedule Incident roadmap

Hiện tại module lịch làm việc chưa bật model/service ScheduleIncident ở runtime backend.

Phạm vi hiện tại:
- Vẫn lưu ShiftAcknowledgement state và EventLog như hiện hữu.
- Không tạo incident record mới để tránh thay đổi schema/risk trước đợt bảo vệ luận văn.

Kế hoạch sau bảo vệ:
1. Thêm ScheduleIncident model với các field: restaurantId, shiftId, employeeId, type, severity, status, reason, createdBy, createdAt, resolvedAt, metadata, eventLogId.
2. Gắn incident khi publish có warning/danger và khi nhân sự decline ca muộn.
3. Bổ sung dashboard theo dõi schedule quality theo kỳ.
