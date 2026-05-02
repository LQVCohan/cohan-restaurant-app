# Phase 4 PR8 — Staff Performance Scoring Policy Design

## 1) Mục tiêu

Phase 4 sử dụng `PerformanceIncident` như lớp dữ liệu truy cứu trách nhiệm (accountability) cho các nghiệp vụ attendance/correction/overtime/off-schedule trước khi ảnh hưởng điểm hiệu suất nhân sự.

Nguyên tắc cốt lõi của PR8:
- **Không trừ điểm trực tiếp** ngay khi mutation nghiệp vụ phát sinh.
- Incident phải đi qua **review thủ công** hoặc **rule explicit đủ rõ** trước khi được đánh dấu có thể ảnh hưởng `StaffPerformance`.
- PR này là **design/policy only**: chưa thay đổi runtime trừ điểm, chưa đụng payroll, chưa thay đổi workflow nghiệp vụ hiện có.

---

## 2) Nguyên tắc chính sách

1. Không trừ điểm nếu nguyên nhân gốc là lỗi hệ thống (system outage, sync lỗi, bug clock/check-in).
2. Không trừ điểm nếu nhân sự có `LeaveRequest` hợp lệ, đã duyệt và khớp thời gian ca.
3. Không trừ điểm nếu manager yêu cầu đổi lịch hợp lệ và có dấu vết audit.
4. Không trừ điểm người xếp lịch nếu revision sau publish xuất phát từ lý do hợp lệ của nhân viên (`unavailable`/`decline hợp lệ`/`leave hợp lệ`).
5. Không trừ điểm nhân viên nếu off-schedule là do manager gọi hỗ trợ và request được duyệt.
6. `OVERTIME_REQUEST_REJECTED` mặc định không dùng để trừ điểm nếu lý do reject là business decision (không cần OT), trừ khi có bằng chứng vi phạm rõ (tự ý làm OT trái yêu cầu).
7. Accountant không có quyền apply/waive điểm, chỉ read-only phục vụ payroll reconciliation/audit.
8. HR có thể review/waive (và apply khi policy bật) nếu được phân công hoặc manager cấp quyền theo scope.
9. Manager/Admin có quyền review/apply/waive trong phạm vi nhà hàng (restaurant scope).

---

## 3) Event classification (policy draft)

> Ghi chú:
> - `defaultScoreDelta` âm là điểm trừ; `0` là không trừ mặc định.
> - `defaultScoreImpactStatus` ở đây là trạng thái policy đề xuất cho incident mới tạo (không phải apply thật ở PR8).
> - Các event “nếu có” được định nghĩa trước để đồng bộ design cho PR9/PR10.

| eventType | defaultSeverity | defaultResponsibilityStatus | defaultScoreImpactStatus | defaultScoreDelta | Review mode | Đối tượng có thể bị quy trách nhiệm | Điều kiện miễn trừ | Ghi chú nghiệp vụ |
|---|---|---|---|---:|---|---|---|---|
| OFF_SCHEDULE_CREATED | low | unresolved | not_applicable | 0 | manual (audit) | staff (info), manager (context) | manager yêu cầu hỗ trợ | Event tạo yêu cầu, chưa phản ánh vi phạm |
| OFF_SCHEDULE_APPROVED | low | resolved_no_fault | not_applicable | 0 | auto-eligible not_applicable | none | đã duyệt hợp lệ | Không trừ điểm khi được duyệt |
| OFF_SCHEDULE_REJECTED | medium | unresolved | pending | 0 | manual required | staff | lý do reject hợp lệ: nhầm thao tác/hệ thống | Chỉ xét trừ điểm nếu xác nhận tự ý đi làm |
| ATTENDANCE_CORRECTION_CREATED | low | unresolved | not_applicable | 0 | manual (audit) | none (ban đầu) | correction do hệ thống | Event nộp correction, chưa kết luận |
| ATTENDANCE_CORRECTION_APPLIED | low | resolved_no_fault | not_applicable | 0 | auto-eligible not_applicable | none | manager/HR xác nhận hợp lệ | Correction được chấp nhận không bị phạt |
| ATTENDANCE_CORRECTION_REJECTED | medium | unresolved | pending | 0 | manual required | staff | bằng chứng mới, lỗi hệ thống, guideline mơ hồ | Có thể trừ nhẹ nếu khai sai rõ ràng |
| OVERTIME_REQUEST_CREATED | low | unresolved | not_applicable | 0 | manual (audit) | none | manager yêu cầu OT | Chỉ là event tạo yêu cầu |
| OVERTIME_REQUEST_APPROVED | low | resolved_no_fault | not_applicable | 0 | auto-eligible not_applicable | none | approved hợp lệ | Không trừ điểm |
| OVERTIME_REQUEST_REJECTED | low/medium | unresolved | not_applicable (default) | 0 | manual exception-only | staff (chỉ khi vi phạm rõ), none | reject do không cần OT | Mặc định không phạt |
| OVERTIME_REQUEST_CANCELLED | low | unresolved | not_applicable | 0 | manual (audit) | staff/manager tùy ngữ cảnh | hủy do đổi kế hoạch hợp lệ | Không phạt mặc định |
| OVERTIME_REQUEST_COMPLETED | low | resolved_no_fault | not_applicable | 0 | auto-eligible not_applicable | none | hoàn thành hợp lệ | Event thông tin/audit |
| ATTENDANCE_LATE (nếu có) | medium/high theo phút | unresolved | pending hoặc eligible theo rule | 0 (derive by bracket) | auto-eligible + manual override | staff | grace period, leave hợp lệ, lỗi hệ thống | Dùng bảng mức trễ ở mục 4 |
| ATTENDANCE_EARLY_LEAVE (nếu có) | medium | unresolved | pending | 0 (derive) | manual preferred | staff | có duyệt về sớm/điều phối manager | Chỉ trừ khi chưa duyệt |
| ATTENDANCE_MISSING_CHECKOUT (nếu có) | medium | unresolved | pending | 0 | manual required | staff / system | lỗi máy chấm công/sync | Warning trước, không auto trừ |
| ATTENDANCE_ABSENT (nếu có) | high | unresolved | pending/eligible | 0 (derive) | manual + rule | staff | leave hợp lệ, manager reassignment | Có mức phạt cao nếu không phép |
| SHIFT_DECLINED_VALID (nếu có) | low | resolved_no_fault | waived hoặc not_applicable | 0 | auto-eligible waived/not_applicable | none | leave/unavailable hợp lệ | Không trừ điểm |
| SHIFT_DECLINED_LATE (nếu có) | high | unresolved | pending | 0 (derive) | manual required | staff | tình huống khẩn cấp có bằng chứng | Có thể phạt do ảnh hưởng vận hành |
| SCHEDULE_RETURNED_FOR_REVISION (nếu có) | medium/high | unresolved | pending | 0 (derive) | manual required | scheduler/manager | revision do incident hợp lệ từ staff | Nếu revision vô căn cứ: manager_responsible |

---

## 4) Đề xuất điểm mặc định (policy only, chưa apply)

### 4.1 Attendance lateness
- Trễ 1–10 phút: **-1** (có grace period).
- Trễ 11–30 phút: **-2**.
- Trễ >30 phút: **-4**.

### 4.2 Early leave
- Về sớm chưa duyệt: **-2 đến -4** tùy số phút và mức ảnh hưởng ca.

### 4.3 Missing checkout
- Mặc định: **warning + pending review**, chưa auto trừ điểm.
- Nếu lặp lại nhiều lần và đã được hướng dẫn quy trình: có thể **-1 đến -2** sau review.

### 4.4 Absence
- Vắng không phép: **-8 đến -10**.
- Vắng có phép hợp lệ/được điều phối: **0 (waived/not_applicable)**.

### 4.5 Off-schedule
- `OFF_SCHEDULE_REJECTED` do tự ý đi làm: **-2** hoặc warning lần đầu.
- `OFF_SCHEDULE_APPROVED`: **0**.

### 4.6 Attendance correction
- `ATTENDANCE_CORRECTION_REJECTED` do thông tin sai rõ ràng: **-1 đến -3** tùy mức độ/ý thức.

### 4.7 Overtime
- `OVERTIME_REQUEST_REJECTED`: **0** mặc định.
- Chỉ trừ điểm khi có kết luận vi phạm “tự ý OT trái yêu cầu”: **-2 đến -4**.

### 4.8 Shift decline / schedule revision
- `SHIFT_DECLINED_LATE` không lý do hợp lệ: **-3 đến -5**.
- `SCHEDULE_RETURNED_FOR_REVISION` không có incident hợp lệ: **manager_responsible, -2 đến -5**.

---

## 5) SLA xử lý incident

1. Incident ở trạng thái `pending` cần được review trong **24–48 giờ**.
2. Incident có thể ảnh hưởng payroll (kỳ đang chạy) phải được chốt trước mốc **finalize payroll**.
3. Staff có thời hạn khiếu nại sau khi incident được mark `eligible`/`applied` (đề xuất: **3–7 ngày** theo policy nhà hàng).
4. Incident quá SLA chưa review sẽ phát sinh warning cho manager queue; **không tự động trừ điểm** chỉ vì quá hạn.

---

## 6) Trạng thái scoring lifecycle

- `not_applicable`: incident chỉ mang tính audit/info, không dùng để chấm điểm.
- `pending`: có khả năng ảnh hưởng điểm nhưng cần review thêm.
- `eligible`: đã xác định đủ điều kiện trừ điểm, chờ apply.
- `applied`: điểm đã được ghi vào `StaffPerformance` (idempotent, không apply lặp).
- `waived`: xác nhận miễn trừ, không trừ điểm.

### Quy tắc chuyển trạng thái (đề xuất)
- `pending -> eligible`: khi reviewer xác minh đủ chứng cứ vi phạm.
- `pending -> waived`: khi có điều kiện miễn trừ hợp lệ.
- `eligible -> applied`: khi actor có quyền thực hiện apply.
- `eligible -> waived`: khi có override hợp lệ trước apply.
- `not_applicable` là terminal trong đa số trường hợp (trừ khi policy đổi ở phiên bản sau).

---

## 7) Quyền và phân vai

### Staff
- Được xem incident của chính mình trong scope cho phép.
- Có thể gửi phản hồi/khiếu nại khi UI flow được triển khai.
- Không có quyền `apply`/`waive`.

### Manager/Admin
- Review incident, mark responsibility, apply/waive trong `restaurant scope`.
- Chịu trách nhiệm SLA xử lý queue.

### HR
- Có thể review/waive/apply khi được phân công hoặc policy nhà hàng bật quyền.
- Không vượt scope nếu không có assignment/ủy quyền.

### Accountant
- Read-only để đối soát payroll/audit.
- Không được apply/waive.

### System
- Tạo incident từ workflow nghiệp vụ.
- Không tự apply trừ điểm nếu chưa có rule explicit được bật chính thức.

---

## 8) Roadmap giai đoạn tiếp theo

- **PR9:** Expose query/mutation cho review `PerformanceIncident` (phân quyền + scope).
- **PR10:** Implement scoring engine draft (evaluate/predict), **chưa auto apply**.
- **PR11:** `StaffPerformance` aggregation + score history (idempotent apply log).
- **PR12:** UI manager incident review queue.
- **PR13:** Staff appeal/response flow.
- **PR14:** Payroll/performance reporting integration.

---

## 9) Regression tests đề xuất cho PR9/PR10

1. `PerformanceIncident` mặc định `scoreDelta = 0` khi tạo mới.
2. Incident trạng thái `waived` không đi vào `StaffPerformance`.
3. Incident trạng thái `applied` chỉ apply một lần (idempotent).
4. `Accountant` bị từ chối khi gọi apply/waive.
5. `Staff` bị từ chối khi gọi apply/waive.
6. `Manager` ngoài scope bị `forbidden`.
7. `LeaveRequest` hợp lệ có thể waive `ATTENDANCE_ABSENT`.
8. `OFF_SCHEDULE_APPROVED` không trừ điểm.
9. `OVERTIME_REQUEST_REJECTED` mặc định không trừ điểm nếu không có violation reason.

---

## 10) Phạm vi PR8 (nhắc lại để tránh hiểu nhầm)

PR8 là tài liệu chính sách để thống nhất rule trước khi hiện thực:
- Không tự động trừ điểm trong production flow.
- Không đổi payroll runtime.
- Không đổi attendance/correction/overtime/off-schedule workflow hiện tại.
- Không thay đổi incident logging foundation từ PR6.
