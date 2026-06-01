# Hệ thống tính toán Staff Performance

Tài liệu này chốt lại trạng thái hiện tại của module **Staff Performance** trong dự án Cohan Restaurant App. Mục tiêu là giúp team nắm rõ công thức, nguồn dữ liệu, vai trò từng chỉ số, luồng tính toán, phần đã hoàn thiện và phần còn là giới hạn cần lưu ý.

## 1. Mục tiêu của hệ thống

Staff Performance dùng để đánh giá hiệu suất nhân viên theo từng kỳ thời gian, thường là tuần/tháng hoặc khoảng ngày do quản lý chọn. Hệ thống tạo `StaffPerformanceSnapshot` cho từng nhân viên trong nhà hàng, lưu lại điểm thành phần, điểm tổng, mức xếp loại và toàn bộ evidence trong `factors`.

Hệ thống không chỉ dựa vào cảm tính của quản lý mà kết hợp dữ liệu vận hành thực tế:

- Chấm công, lịch ca và thời lượng làm việc.
- Đi trễ, về sớm, vắng mặt.
- Đánh giá khách hàng gắn với nhân viên.
- Dữ liệu bếp/bar từ `KitchenOrderWorkItem`.
- Lỗi nghiệp vụ thu ngân có thể quy trách nhiệm.
- Đánh giá định kỳ của quản lý.
- Yêu cầu chỉnh công.
- Incident/appeal đã được áp dụng vào điểm.

## 2. Công thức tổng

Điểm cuối cùng được tính theo 5 nhóm điểm chính:

```txt
Final Score =
  Productivity   * 25%
+ Punctuality    * 25%
+ Quality        * 20%
+ Manager Review * 20%
+ Compliance     * 10%
```

Trọng số hiện tại:

| Thành phần | Trọng số | Ý nghĩa |
|---|---:|---|
| `productivity` | 25 | Năng suất, dựa chủ yếu trên tỷ lệ hoàn thành thời lượng ca được phân công. |
| `punctuality` | 25 | Đúng giờ, đi trễ, về sớm, vắng mặt và tổng số phút vi phạm. |
| `quality` | 20 | Chất lượng chuyên môn theo vai trò: phục vụ, thu ngân, bếp chính, phụ bếp hoặc vai trò khác. |
| `managerReview` | 20 | Điểm đánh giá tổng quan của quản lý trong kỳ. |
| `compliance` | 10 | Tuân thủ quy trình, chủ yếu dựa trên số yêu cầu chỉnh công. |

Điểm được clamp trong khoảng `0–100`. Khi thiếu dữ liệu hoàn toàn trong kỳ, hệ thống đặt các component về `0`, `finalPerformanceScore = 0`, và `performanceLevel = poor`.

## 3. Xếp loại hiệu suất

| Điểm cuối | Level |
|---:|---|
| `>= 90` | `excellent` |
| `>= 80` | `good` |
| `>= 65` | `average` |
| `>= 50` | `needs_attention` |
| `< 50` | `poor` |

## 4. Nguồn dữ liệu chính

### 4.1. Chấm công và lịch ca

Dùng các model:

- `Timesheet`
- `Shift`
- `AttendanceCorrectionRequest`

Các dữ liệu lấy ra gồm:

- `scheduledMinutes`: tổng phút ca được phân công trong kỳ.
- `actualWorkedMinutes`: tổng phút làm việc thực tế từ timesheet.
- `recordCount`: số dòng chấm công.
- `lateEvents`: số lần đi trễ.
- `earlyEvents`: số lần về sớm.
- `absenceEvents`: số dòng không có check-in.
- `totalLateMinutes`: tổng phút đi trễ.
- `totalEarlyMinutes`: tổng phút về sớm.
- `correctionsCount`: số yêu cầu chỉnh công có trạng thái `pending`, `approved`, `applied`, `rejected`.

### 4.2. Order/khách hàng

Dùng các model:

- `Order`
- `Review`

Dữ liệu order hiện dùng chủ yếu để:

- Tham khảo benchmark số order theo nhân viên.
- Tính lỗi nghiệp vụ thu ngân nếu order có payment state, request clear, return/void request hoặc customer payment request gắn với nhân viên.

Dữ liệu review khách hàng:

- Chỉ lấy review `published`.
- Rating hợp lệ từ `1–5`.
- Gắn với `staffId`.
- Có phân biệt `verifiedPurchase` để lưu evidence.
- Chỉ ảnh hưởng điểm mạnh khi nhân viên có ít nhất 3 review trong kỳ.

### 4.3. Bếp/bar

Dùng model:

- `KitchenOrderWorkItem`

Các metric gồm:

- `totalItems`, `kitchenItems`, `barItems`.
- `preparedItems`, `servedItems`.
- `cancelledItems`, `returnedItems`.
- `kitchenRelatedCancelledItems`, `kitchenRelatedReturnedItems`.
- `nonKitchenCancelledItems`, `nonKitchenReturnedItems`.
- `onTimeItems`, `lateItems`, `veryLateItems`.
- `unacceptedItems`.
- `headChefItems`, `assistantItems`, `teamItems`.
- `barLeadItems`, `barStaffItems`.
- `avgPrepMinutes`, `targetPrepMinutesAvg`.

Bếp/bar dùng để tạo evidence chất lượng theo vai trò, đặc biệt cho bếp chính và phụ bếp.

### 4.4. Đánh giá quản lý

Dùng model:

- `StaffPerformanceReview`

Các điểm quản lý nhập:

- `managerRatingScore`: điểm tổng quan của quản lý.
- `attitudeScore`: thái độ.
- `teamworkScore`: phối hợp.
- `skillScore`: kỹ năng/chuyên môn.
- `note`: ghi chú.

Trong công thức hiện tại:

- `managerReview.score` lấy từ `managerRatingScore`, fallback `75` nếu chưa có review.
- `quality` dùng `skillScore` làm base skill score, fallback `75` nếu chưa có review.

### 4.5. Incident, adjustment và appeal

Dùng các model:

- `PerformanceIncident`
- `StaffPerformanceScoreAdjustment`
- `StaffPerformanceScoreReversal`

Luồng hiện tại:

- Chỉ lấy incident có `scoreImpactStatus = applied` trong kỳ.
- Cộng tổng `scoreDelta` từ adjustment.
- Cộng tổng `reversalDelta` từ appeal reversal.
- `finalAdjustmentDelta = incidentAdjustmentDelta + appealReversalDelta`.
- Điểm cuối = `baseFormulaScore + finalAdjustmentDelta`, sau đó clamp `0–100`.

Hệ thống lưu lại trong `factors`:

- `incidentAdjustmentDelta`
- `appealReversalDelta`
- `finalAdjustmentDelta`
- `appliedAdjustmentCount`
- `reversedAppealCount`
- `appliedIncidentIds`
- `scoreReversalIds`

## 5. Cách tính từng thành phần

### 5.1. Productivity

Mục tiêu: đo mức hoàn thành thời lượng ca được phân công.

Cách tính:

```txt
Nếu không có dữ liệu hoạt động trong kỳ:
  productivity = 0

Nếu có scheduledMinutes > 0:
  productivity = actualWorkedMinutes / scheduledMinutes * 100

Nếu có timesheet nhưng thiếu lịch phân ca:
  productivity = 75

Ngược lại:
  productivity = 0
```

Ghi chú hiện tại trong UI/evidence:

- Có lịch ca: “Dựa trên tỷ lệ hoàn thành thời lượng ca được phân công trong kỳ; order chỉ dùng làm dữ liệu tham khảo.”
- Có chấm công nhưng thiếu lịch ca: “Có dữ liệu chấm công nhưng thiếu lịch phân ca, dùng điểm trung lập.”
- Không có dữ liệu: “Không có dữ liệu làm việc trong kỳ.”

### 5.2. Punctuality

Mục tiêu: đo đúng giờ và kỷ luật thời gian.

Penalty hiện tại:

```txt
punctualityPenalty =
  lateEvents       * 6
+ earlyEvents      * 5
+ absenceEvents    * 12
+ totalLateMinutes * 0.15
+ totalEarlyMinutes * 0.12
```

Cách tính:

```txt
Nếu có record chấm công:
  punctuality = clamp(100 - punctualityPenalty, fallback 75)

Nếu không có record:
  punctuality = 75

Nếu thiếu toàn bộ dữ liệu hoạt động:
  punctuality = 0
```

### 5.3. Compliance

Mục tiêu: đo mức tuân thủ quy trình, đặc biệt liên quan chỉnh công.

Penalty hiện tại:

```txt
compliancePenalty = correctionsCount * 7
complianceScore = clamp(100 - compliancePenalty, fallback 75)
```

`correctionsCount` tính các yêu cầu chỉnh công trong kỳ có trạng thái:

- `pending`
- `approved`
- `applied`
- `rejected`

Nếu thiếu toàn bộ dữ liệu hoạt động, compliance = `0`.

### 5.4. Manager Review

Mục tiêu: phản ánh đánh giá tổng quan của quản lý.

Cách tính:

```txt
Nếu có StaffPerformanceReview:
  managerReview = managerRatingScore
Nếu chưa có:
  managerReview = 75
Nếu thiếu toàn bộ dữ liệu hoạt động:
  managerReview = 0
```

Các điểm `attitudeScore`, `teamworkScore`, `skillScore` được lưu trong review; trong công thức hiện tại, `skillScore` còn dùng làm base cho `quality`.

### 5.5. Quality

Mục tiêu: đánh giá chất lượng chuyên môn theo vai trò, không dùng một công thức chung cho mọi vị trí.

Hệ thống xác định `roleGroup` theo text vai trò và dữ liệu bếp:

| Role group | Nhận diện |
|---|---|
| `cashier` | `cashier`, `thu ngan` |
| `order_staff` | `waiter`, `waitress`, `server`, `phuc vu`, `order`, `le tan`, `host` |
| `assistant_chef` | `assistant chef`, `kitchen helper`, `phu bep`, hoặc dữ liệu assistant items |
| `head_chef` | `head chef`, `chef`, `bep truong`, `dau bep chinh`, `bep chinh`, hoặc dữ liệu head chef items |
| `other` | Không khớp nhóm trên |

Base quality:

```txt
baseSkillScore = review.skillScore nếu có review, ngược lại 75
```

Nếu có evidence phù hợp vai trò, điểm quality:

```txt
quality = baseSkillScore - rolePenalty
```

và clamp tối thiểu theo logic bảo thủ. Nếu có penalty, điểm không bị kéo quá mạnh dưới 50 chỉ vì một vài evidence nhỏ.

## 6. Quality theo từng vai trò

### 6.1. Order staff / phục vụ / lễ tân

Nguồn chính:

- `Review` khách hàng gắn với nhân viên.

Điểm review:

```txt
customerRatingScore = averageRating * 20
```

Chỉ phạt nếu:

```txt
staffRateCount >= 3
và customerRatingScore < 75
```

Penalty:

```txt
orderStaffPenalty = min(4, (75 - customerRatingScore) * 0.12)
```

Ý nghĩa: review khách hàng ảnh hưởng nhẹ, tránh phạt mạnh khi ít review hoặc rating chưa đủ đại diện.

### 6.2. Cashier / thu ngân

Nguồn chính:

- Review khách hàng gắn với thu ngân.
- Lỗi nghiệp vụ thu ngân có thể quy trách nhiệm từ order/payment/customer requests.

Customer penalty:

```txt
Nếu staffRateCount < 3 hoặc customerRatingScore >= 75:
  penalty = 0
Ngược lại:
  penalty = min(2.5, (75 - customerRatingScore) * 0.08)
```

Cashier operational penalty:

```txt
penalty =
  wrongBillRate             * 8
+ paymentErrorRate          * 6
+ cashierRefundRate         * 8
+ cashVarianceRate          * 20
+ latePaymentRequestRate    * 4
+ unauthorizedDiscountRate  * 6

cashierOperationalPenalty = min(15, penalty)
```

Các lỗi có thể quy trách nhiệm thu ngân gồm keyword như:

- Sai hóa đơn.
- Tính nhầm, thu nhầm.
- Nhầm bàn/order.
- In nhầm bill.
- Áp sai giá, sai khuyến mãi, sai voucher, sai discount.
- Chọn sai phương thức thanh toán.
- Xác nhận thanh toán sai.

Các lý do không quy trách nhiệm thu ngân gồm:

- Khách đổi ý/hủy.
- Lỗi bếp, món nguội, món sai, hết món.
- Lỗi hệ thống/cổng thanh toán/provider/callback/MoMo/VNPAY.

Giới hạn hiện tại:

- `cashVarianceRate` đang để `0` vì chưa có model `CashierShiftReconciliation`.
- PaymentSession/reconciliation sau #774/#781 đã rất tốt nhưng chưa được đưa trực tiếp vào scoring thu ngân; service còn TODO để tích hợp khi cần.

### 6.3. Head chef / bếp chính

Nguồn chính:

- `KitchenOrderWorkItem`.

Penalty:

```txt
penalty =
  lateItems / denom                    * 4
+ veryLateItems / denom                * 12
+ kitchenRelatedReturnedItems / denom  * 10
+ kitchenRelatedCancelledItems / denom * 6
+ unacceptedItems / denom              * 3

headChefQualityPenalty = min(20, penalty)
```

`denom` ưu tiên `headChefItems`, nếu không có thì dùng `kitchenItems` hoặc `totalItems`.

### 6.4. Assistant chef / phụ bếp

Nguồn chính:

- `KitchenOrderWorkItem`.

Penalty:

```txt
penalty =
  unacceptedItems / denom              * 12
+ lateItems / denom                    * 3
+ veryLateItems / denom                * 4
+ kitchenRelatedReturnedItems / denom  * 3
+ kitchenRelatedCancelledItems / denom * 2

assistantChefQualityPenalty = min(18, penalty)
```

`denom` ưu tiên `assistantItems`, nếu không có thì dùng `teamItems`, `kitchenItems` hoặc `totalItems`.

### 6.5. Other role

Nếu không thuộc các nhóm trên, quality chủ yếu dựa vào `skillScore` từ quản lý. Nếu chưa có review, dùng điểm trung lập `75`.

## 7. Snapshot lưu những gì

Model `StaffPerformanceSnapshot` lưu:

- `employeeId`
- `restaurantId`
- `periodStart`, `periodEnd`
- `productivity`, `punctuality`, `quality`, `managerReview`, `compliance`
- `finalPerformanceScore`
- `performanceLevel`
- `factors`
- `generatedBy`, `generatedByName`
- `reviewedBy`, `reviewedAt`, `lockedAt`

Mỗi component có:

```txt
score
weight
note
```

Snapshot có unique index:

```txt
employeeId + restaurantId + periodStart + periodEnd
```

Nghĩa là mỗi nhân viên trong một kỳ chỉ có một snapshot; khi recalculation chạy lại thì upsert, không tạo trùng.

## 8. Quyền truy cập

### 8.1. Quyền quản lý/tính lại

Các role được cập nhật/recalculate performance:

- `admin`
- `manager`
- `hr`

Nếu không thuộc nhóm này, hệ thống trả lỗi không có quyền cập nhật hiệu suất nhân viên.

### 8.2. Quyền xem

Các role được xem performance:

- `admin`
- `manager`
- `hr`
- `accountant`

Nhân viên role `staff` chỉ được xem performance của chính mình.

## 9. Luồng tính toán

Luồng chính khi gọi recalculation:

```txt
1. Kiểm tra quyền quản lý performance.
2. Chuẩn hóa periodStart về đầu ngày và periodEnd về cuối ngày.
3. Nếu có employeeId thì tính cho một nhân viên, nếu không thì tính cho toàn bộ staff của nhà hàng.
4. Chạy audit KitchenOrderWorkItem chưa nhận qua markUnacceptedKitchenOrderWorkItems.
5. Với từng nhân viên:
   - Lấy staff profile.
   - Lấy timesheet, shift, attendance corrections.
   - Lấy review quản lý nếu có.
   - Lấy benchmark order cùng kỳ.
   - Lấy review khách hàng published gắn với nhân viên.
   - Lấy kitchen metrics nếu có liên quan bếp/bar.
   - Lấy cashier metrics nếu có liên quan payment/order/customer request.
   - Tính 5 component score.
   - Tính baseFormulaScore.
   - Cộng adjustment/reversal từ incident/appeal.
   - Upsert StaffPerformanceSnapshot.
6. Trả danh sách snapshot đã tính.
```

## 10. UI/Frontend hiện có

Frontend có file `performanceFormula.js` định nghĩa cùng bộ 5 component và trọng số để hiển thị đóng góp điểm:

```txt
Năng suất: 25
Đúng giờ: 25
Chất lượng: 20
Đánh giá quản lý: 20
Tuân thủ: 10
```

UI dùng `getWeightedContribution(score, weight)` để hiển thị contribution theo công thức:

```txt
score * weight / 100
```

## 11. Những gì đã ổn

- Công thức tổng rõ ràng, đủ 5 nhóm điểm.
- Có snapshot theo kỳ, không tạo trùng nhờ unique index.
- Có fallback trung lập `75` khi có hoạt động nhưng thiếu review/dữ liệu phụ.
- Có xử lý thiếu toàn bộ dữ liệu bằng điểm `0`, level `poor`.
- Có phân quyền quản lý/xem dữ liệu.
- Có evidence chi tiết trong `factors` để giải thích vì sao điểm thay đổi.
- Có hỗ trợ vai trò khác nhau: phục vụ, thu ngân, bếp chính, phụ bếp, role khác.
- Review khách hàng được dùng bảo thủ, dưới 3 review chỉ lưu evidence, không phạt mạnh.
- Cashier scoring đã có logic quy trách nhiệm theo keyword, tránh đổ lỗi cho thu ngân khi lỗi do khách, bếp, hệ thống hoặc payment provider.
- Incident/appeal có thể cộng/trừ điểm sau công thức gốc.
- Kitchen unaccepted work item được audit lại trước khi tính snapshot.

## 12. Giới hạn hiện tại cần nắm

### 12.1. Cash variance chưa vào điểm thực tế

`cashVarianceRate` hiện đang để `0`. Hệ thống chưa có model riêng kiểu `CashierShiftReconciliation` để lấy chênh lệch tiền mặt cuối ca đưa vào điểm thu ngân.

Sau #774/#781, payment/reconciliation đã chắc hơn nhưng Performance service vẫn chưa tích hợp trực tiếp `PaymentSession`, `BankTransaction`, `PaymentReconciliation` vào scoring thu ngân. Đây là phần có thể làm sau nếu muốn production-grade hơn.

### 12.2. Productivity chưa dùng order count để tăng điểm chính

`orderCount` và `peerMaxOrderCount` được lưu trong `factors`, nhưng productivity hiện dựa chủ yếu vào tỷ lệ hoàn thành thời lượng ca. Order count chỉ là dữ liệu tham khảo.

### 12.3. Chưa có payroll/ranking chính thức

Performance snapshot có thể dùng làm nền cho:

- Ranking nhân viên.
- Thưởng/phạt.
- Payroll.
- KPI dashboard.

Nhưng các phần này chưa nên xem là hoàn tất nếu chưa có nghiệp vụ HR/payroll riêng.

### 12.4. Chưa có automated test phủ toàn bộ vai trò

Đã có test liên quan công thức core/customer rating, nhưng nếu tiếp tục phát triển nên thêm test cho:

- Bếp chính.
- Phụ bếp.
- Thu ngân với nhiều loại lỗi payment.
- Incident + appeal reversal.
- Không dữ liệu.
- Thiếu lịch ca nhưng có timesheet.

## 13. Đánh giá mức hoàn thiện

| Mảng | Mức hoàn thiện |
|---|---:|
| Công thức core | 95–98% |
| Snapshot/recalculate | 95–98% |
| Role-based quality | 90–95% |
| Customer rating evidence | 90–95% |
| Kitchen/bar evidence | 88–93% |
| Cashier operational evidence | 85–90% |
| Incident/appeal adjustment | 90–95% |
| Payroll/bonus integration | Chưa chốt |
| Cash variance thực tế | Chưa tích hợp |

Kết luận tổng thể:

```txt
Performance hiện đã đủ tốt cho demo, báo cáo đồ án và vận hành nội bộ mức MVP+.
Nếu dùng production thật, phần nên bổ sung tiếp là cash variance cuối ca, payroll/ranking và test tự động sâu hơn theo từng vai trò.
```

## 14. Checklist demo Performance

Nên demo theo thứ tự:

```txt
1. Tạo dữ liệu staff có lịch ca và timesheet.
2. Tạo một số đi trễ/về sớm/vắng mặt.
3. Tạo review quản lý cho nhân viên.
4. Tạo review khách hàng gắn với phục vụ/thu ngân.
5. Tạo kitchen work items cho bếp chính/phụ bếp.
6. Tạo lỗi nghiệp vụ thu ngân có reason rõ ràng.
7. Chạy recalculate performance snapshots.
8. Mở Staff Performance UI.
9. Xem final score, level và từng component contribution.
10. Kiểm tra `factors.qualityEvidence`, `kitchenMetrics`, `cashierMetrics`, adjustment/reversal nếu có.
```

## 15. Không nên hiểu nhầm

- Performance không tự động kết luận phạt tiền/lương; nó chỉ tạo điểm và evidence.
- Review khách hàng ít hơn 3 không phạt mạnh, chỉ lưu tham khảo.
- Lỗi payment provider/MoMo/VNPAY/callback không tự quy trách nhiệm cho thu ngân.
- QR/chuyển khoản/payment reconciliation là module Payment; Performance chỉ dùng cashier operational evidence hiện có trong Order/customer request, chưa ăn trực tiếp toàn bộ PaymentReconciliation.
- Điểm cao không có nghĩa nhân viên không có lỗi; cần đọc `factors` và incident nếu có.
- Điểm thấp do thiếu dữ liệu có thể là dữ liệu chưa được nhập/chấm công/chưa tạo ca, không nhất thiết là hiệu suất thật kém.
