# Cấu trúc hệ thống Cohan Restaurant App

## 1. Mục đích tài liệu
- Tài liệu này là bản đồ hệ thống ngắn gọn để Codex/AI đọc trước khi sửa code.
- Nội dung chỉ phản ánh source code đã đọc tại thời điểm cập nhật file này.
- Khi kiến trúc hoặc luồng nghiệp vụ thay đổi đáng kể, cần cập nhật lại tài liệu.

**File đã xác minh cho section này**
- `README.md`

## 2. Tổng quan kiến trúc
- Frontend dùng React + Vite, entry tại `src/main.jsx`, root app tại `src/App.jsx`.
- Frontend dùng Apollo Client (`@apollo/client`) và bọc `ApolloProvider` ở `App.jsx`.
- Backend chạy Node.js (ESM), entry chạy thực tế qua `cohan-restaurant-backend/src/server/server.js` (theo script trong `cohan-restaurant-backend/package.json`).
- Backend có GraphQL layer với schema tại `cohan-restaurant-backend/graphql/schema/user.graphql` và resolver staff tại `cohan-restaurant-backend/graphql/resolvers/staff/query.js`, `.../mutation.js`.
- Model layer dùng Mongoose (MongoDB) theo các model trong `cohan-restaurant-backend/models/`.

**File đã xác minh cho section này**
- `package.json`
- `vite.config.js`
- `src/main.jsx`
- `src/App.jsx`
- `cohan-restaurant-backend/package.json`
- `cohan-restaurant-backend/graphql/schema/user.graphql`
- `cohan-restaurant-backend/graphql/resolvers/staff/query.js`
- `cohan-restaurant-backend/graphql/resolvers/staff/mutation.js`
- `cohan-restaurant-backend/models/user.model.js`

## 3. Cấu trúc thư mục chính

| Khu vực | Đường dẫn | Vai trò | Ghi chú |
|---|---|---|---|
| Frontend app root | `src/` | UI app, routing, context, Apollo consumer | Root mount ở `src/main.jsx`, provider ở `src/App.jsx`. |
| Schedule management frontend | `src/components/Dashboard_Manager/Schedule/` | Màn hình manager quản lý lịch, availability, attendance issue | Có `components/`, `hooks/`, `utils/`, test riêng. |
| Staff schedule frontend | `src/components/Staff/components/StaffSchedulePage.jsx` | Màn hình staff xem lịch, submit availability, ack, check-in/out | Query/mutation GraphQL trực tiếp trong file. |
| Backend GraphQL schema | `cohan-restaurant-backend/graphql/schema/user.graphql` | Định nghĩa type/query/mutation | Bao gồm `ShiftAttendance`, availability, schedule lifecycle, attendance ops. |
| Backend staff resolvers | `cohan-restaurant-backend/graphql/resolvers/staff/` | Query/mutation cho scheduling/attendance/availability/payroll liên quan staff-manager | Guard role/restaurant được gọi từ service permission. |
| Models | `cohan-restaurant-backend/models/` | Mongoose model | Bao gồm `user`, `shift`, `timesheet`, `schedule-publication`, availability models. |
| Services availability | `cohan-restaurant-backend/src/services/availability/` | Logic window/submission/schedule availability | Có `availabilityRegistrationWindow.service.js`, `availabilityRegistrationSchedule.service.js`. |
| Services scheduling | `cohan-restaurant-backend/src/services/scheduling/` | Lifecycle lịch, permission, validate assignment, auto schedule | Là nền cho publish/edit/permission. |
| Services attendance | `cohan-restaurant-backend/src/services/attendance/` | Correction workflow, overtime state, exception detection, off-schedule | Dùng bởi resolver mutation/query attendance. |
| Services payroll | `cohan-restaurant-backend/src/services/payroll/` | Runtime/validation/payment/payroll permission | Chỉ mô tả mức tổng quan trong tài liệu này. |
| Tests | `src/**/*.test.*`, `cohan-restaurant-backend/tests/` | Unit/integration test frontend + backend | Backend có `tests/resolvers/` và `tests/services/`. |

**File đã xác minh cho section này**
- `src/main.jsx`
- `src/App.jsx`
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx`
- `src/components/Staff/components/StaffSchedulePage.jsx`
- `cohan-restaurant-backend/graphql/schema/user.graphql`
- `cohan-restaurant-backend/graphql/resolvers/staff/query.js`
- `cohan-restaurant-backend/graphql/resolvers/staff/mutation.js`
- `cohan-restaurant-backend/models/user.model.js`
- `cohan-restaurant-backend/models/timesheet.model.js`
- `cohan-restaurant-backend/models/shift.model.js`
- `cohan-restaurant-backend/models/schedule-publication.model.js`
- `cohan-restaurant-backend/models/availability-registration-window.model.js`
- `cohan-restaurant-backend/models/staff-availability-submission.model.js`

## 4. Các domain/chức năng chính

### 4.1 Scheduling / Schedule Management
- Vai trò: Manager tạo/sửa/publish/lock/reopen lịch và theo dõi chất lượng lịch.
- File chính: `ScheduleManagement.jsx`, `scheduleLifecycle.service.js`, `schedulePublishValidation.service.js`.
- Luồng dữ liệu: Frontend gọi GraphQL query/mutation schedule; backend resolver thao tác `Shift`, `SchedulePublication`.
- Lưu ý khi sửa: kiểm tra `schedulePermissions` và read-only mode.

### 4.2 Availability Registration
- Vai trò: Quản lý kỳ đăng ký khả dụng của staff theo tuần.
- File chính: `AvailabilityRegistrationPanel.jsx`, `availability-registration-window.model.js`, `staff-availability-submission.model.js`, availability services.
- Luồng dữ liệu: tạo/mở/đóng window -> staff submit -> manager review late change (nếu có).
- Lưu ý khi sửa: phân biệt trạng thái window hiệu lực (`effectiveStatus`) và status lưu trữ.

### 4.3 Shift Acknowledgement
- Vai trò: Staff accept/decline shift, manager review decline classification.
- File chính: `StaffSchedulePage.jsx`, `ScheduleManagement.jsx`, resolver `myShiftAcknowledgements`, mutation `reviewShiftAcknowledgement`.
- Luồng dữ liệu: staff phản hồi -> manager phân loại valid/invalid/late.
- Lưu ý khi sửa: cần giữ guard role/restaurant và hành vi phân loại hiện có.

### 4.4 Attendance / Timesheet
- Vai trò: Check-in/check-out theo shift đã publish, manager theo dõi bất thường và ghi chú xử lý.
- File chính: `timesheet.model.js`, resolver attendance query/mutation trong staff resolver, `ScheduleManagement.jsx`, `StaffSchedulePage.jsx`.
- Luồng dữ liệu: check-in/out tạo/cập nhật Timesheet; manager query attendance theo period nhà hàng.
- Lưu ý khi sửa: không tự tạo Timesheet cho synthetic row chỉ để ghi chú.

### 4.5 Payroll
- Vai trò: tổng hợp và xử lý payroll dựa trên timesheet + policy/settings.
- File chính: `cohan-restaurant-backend/src/services/payroll/*`, resolver payroll trong staff query/mutation.
- Luồng dữ liệu: runtime build period items/summary/payment.
- Lưu ý khi sửa: attendance basic không nên đụng logic payroll nếu không có yêu cầu.

### 4.6 Staff UI
- Vai trò: staff thao tác availability, xem lịch, ack ca, check-in/check-out.
- File chính: `StaffSchedulePage.jsx`.
- Luồng dữ liệu: Apollo query/mutation trực tiếp trong component.
- Lưu ý khi sửa: không phá context Auth/Apollo hiện tại.

### 4.8 Wallet top-up security posture (updated)
- `createMyWallet` vẫn cho phép khách tạo ví nội bộ, nhưng provider/currency bị giới hạn whitelist.
- `topUpMyWallet` đã bị chặn cho khách hàng (temporary disable) cho tới khi có payment verification callback tin cậy.
- Quy tắc vận hành: số dư ví chỉ được tăng thông qua luồng đã xác minh thanh toán hoặc thao tác nội bộ có kiểm soát quyền.
- Avatar `fileUrl` chỉ chấp nhận đường dẫn an toàn dạng `/uploads/...` hoặc URL nằm trong `S3_PUBLIC_BASE_URL` với cùng origin + cùng phạm vi path prefix.

### 4.7 Manager UI
- Vai trò: quản lý lịch, availability, decline queue, attendance issue.
- File chính: `ScheduleManagement.jsx` + sub-components trong `Schedule/components/`.
- Luồng dữ liệu: nhiều query/mutation GraphQL, có mock test lớn trong `ScheduleManagement.test.jsx`.
- Lưu ý khi sửa: cập nhật test mock khi thêm query field mới.

**File đã xác minh cho section này**
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx`
- `src/components/Dashboard_Manager/Schedule/components/AvailabilityRegistrationPanel.jsx`
- `src/components/Staff/components/StaffSchedulePage.jsx`
- `cohan-restaurant-backend/graphql/resolvers/staff/query.js`
- `cohan-restaurant-backend/graphql/resolvers/staff/mutation.js`
- `cohan-restaurant-backend/src/services/scheduling/scheduleLifecycle.service.js`
- `cohan-restaurant-backend/src/services/availability/availabilityRegistrationWindow.service.js`
- `cohan-restaurant-backend/src/services/payroll/payrollRuntime.service.js`


### 4.7 GraphQL user privacy DTOs
- GraphQL user-facing resolvers must not return raw Mongoose `User`/`Customer` documents directly. Auth/session responses call `sanitizeAuthUser`, customer CRM lists call `sanitizeCustomerListUser`, and admin user lists call `sanitizeAdminUserListItem`.
- The general GraphQL `User` type intentionally contains only non-HR/non-payroll fields needed by auth, CRM, and general user management clients. Bank, identity, insurance, internal notes, login IP, and payroll/private staff fields are not exposed on the general `User` type.
- HR/payroll/identity fields are isolated in `StaffPrivateProfile` and may only be returned through staff management/private profile resolvers after role, restaurant-scope, and `staff.read` permission checks.
- New GraphQL user resolvers should choose an explicit DTO sanitizer before returning data; raw `.lean()` documents from `User.find*`/`Customer.find*` must be mapped through the correct sanitizer or replaced by an explicit projection.

**File đã xác minh cho section này**
- `cohan-restaurant-backend/src/security/userDtos.js`
- `cohan-restaurant-backend/graphql/schema/user.graphql`
- `cohan-restaurant-backend/graphql/resolvers/user/query.js`
- `cohan-restaurant-backend/graphql/resolvers/staff/query.js`

## 5. Luồng scheduling hiện tại
1. Manager mở availability window (manual action có trong `AvailabilityRegistrationPanel.jsx` + backend availability window service/model).
2. Staff submit availability (`submitStaffAvailability` trong `StaffSchedulePage.jsx`, model submission).
3. Manager đóng window (UI panel manager có action close; backend có lock submission cho window closed).
4. Submission lock (service `lockSubmissionsForClosedWindow`).
5. Manager tạo lịch (ScheduleManagement + AddShiftModal/auto schedule utils).
6. Manager publish schedule (SchedulePublication query/mutation + lifecycle service).
7. Staff accept/decline shift (`respondShiftAcknowledgement` ở StaffSchedulePage).
8. Manager xử lý decline hợp lệ/không hợp lệ (`reviewShiftAcknowledgement` trong ScheduleManagement).
9. Staff check-in/check-out (`checkInShift`, `checkOutShift`).
10. Manager xem attendance hôm nay (`managerShiftAttendances` trong ScheduleManagement).
11. Manager ghi chú xử lý bất thường attendance (`markShiftAttendanceReviewed`).

> Bước nào không thấy rõ full flow UI/backend end-to-end ở source đã đọc: **Chưa xác minh từ source**.

**File đã xác minh cho section này**
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx`
- `src/components/Staff/components/StaffSchedulePage.jsx`
- `cohan-restaurant-backend/graphql/resolvers/staff/query.js`
- `cohan-restaurant-backend/graphql/resolvers/staff/mutation.js`
- `cohan-restaurant-backend/src/services/availability/availabilityRegistrationWindow.service.js`

## 6. Luồng attendance hiện tại
- Staff check-in/check-out dùng mutation `checkInShift(shiftId)` và `checkOutShift(shiftId)`.
- Attendance lưu vào model `Timesheet` (`cohan-restaurant-backend/models/timesheet.model.js`).
- Manager query attendance bằng query `managerShiftAttendances(restaurantId, periodStart, periodEnd)`.
- Synthetic row `shift-...` là row fallback được trả về khi có Shift nhưng chưa có Timesheet (id dạng `shift-${shiftId}`).
- Synthetic row không được ghi chú xử lý vì không có Timesheet thật; UI hiển thị lỗi inline khi bấm ghi chú cho row này.
- `markShiftAttendanceReviewed` append nội dung note vào `Timesheet.note` (không tạo model mới).
- Review note lưu tại field `Timesheet.note`.
- `reviewNote` được expose qua GraphQL type `ShiftAttendance.reviewNote` và map từ `timesheet?.note || null` trong `managerShiftAttendances`.
- Chưa làm (theo source đã đọc):
  - chưa GPS/QR cho check-in/out
  - chưa payroll automation cho attendance review note
  - chưa tạo Timesheet cho synthetic row khi review
  - chưa auto-resolve issue sau khi ghi chú

**File đã xác minh cho section này**
- `cohan-restaurant-backend/graphql/schema/user.graphql`
- `cohan-restaurant-backend/graphql/resolvers/staff/query.js`
- `cohan-restaurant-backend/graphql/resolvers/staff/mutation.js`
- `cohan-restaurant-backend/models/timesheet.model.js`
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx`
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.test.jsx`
- `src/components/Staff/components/StaffSchedulePage.jsx`

## 7. GraphQL map quan trọng

| Operation | Type | File resolver | Frontend dùng ở đâu | Ghi chú |
|---|---|---|---|---|
| `myShiftAttendances` | Query | `graphql/resolvers/staff/query.js` | `StaffSchedulePage.jsx` | Trả attendance của chính staff theo period. |
| `checkInShift` | Mutation | `graphql/resolvers/staff/mutation.js` | `StaffSchedulePage.jsx` | Có guard publication + time window check-in. |
| `checkOutShift` | Mutation | `graphql/resolvers/staff/mutation.js` | `StaffSchedulePage.jsx` | Yêu cầu đã check-in trước. |
| `managerShiftAttendances` | Query | `graphql/resolvers/staff/query.js` | `ScheduleManagement.jsx` | Có thể trả synthetic row `shift-...`; có `reviewNote`. |
| `markShiftAttendanceReviewed` | Mutation | `graphql/resolvers/staff/mutation.js` | `ScheduleManagement.jsx` | Ghi chú vào `Timesheet.note` dạng append. |
| `myShiftAcknowledgements` | Query | `graphql/resolvers/staff/query.js` | `StaffSchedulePage.jsx` | Dùng để hiển thị trạng thái ack theo period. |
| `reviewShiftAcknowledgement` | Mutation | `graphql/resolvers/staff/mutation.js` | `ScheduleManagement.jsx` | Manager review decline classification + note. |
| `schedulePublication` / `publishSchedule` / `lockSchedule` / `reopenSchedule` / `closeSchedule` | Query/Mutation | `query.js` + `mutation.js` | `ScheduleManagement.jsx` | Lifecycle phụ thuộc `scheduleLifecycle.service.js`. |

**File đã xác minh cho section này**
- `cohan-restaurant-backend/graphql/schema/user.graphql`
- `cohan-restaurant-backend/graphql/resolvers/staff/query.js`
- `cohan-restaurant-backend/graphql/resolvers/staff/mutation.js`
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx`
- `src/components/Staff/components/StaffSchedulePage.jsx`

## 8. Model map quan trọng

| Model | File | Vai trò | Field quan trọng |
|---|---|---|---|
| User/Staff | `cohan-restaurant-backend/models/user.model.js` | Tài khoản + thông tin staff | `restaurantForStaff`, `userType`, `employeeCode`, `employmentType`, `employmentStatus` |
| Shift | `cohan-restaurant-backend/models/shift.model.js` | Ca làm theo nhân sự | `employeeId`, `restaurantId`, `shiftType`, `startTime`, `endTime`, `status` |
| Timesheet | `cohan-restaurant-backend/models/timesheet.model.js` | Bản ghi chấm công theo shift/ngày | `shiftId`, `employeeId`, `restaurantId`, `actualCheckInAt`, `actualCheckOutAt`, `status`, `note` |
| SchedulePublication | `cohan-restaurant-backend/models/schedule-publication.model.js` | Trạng thái vòng đời công bố lịch | `restaurantId`, `periodStart`, `periodEnd`, `status`, `publishedAt`, `lockedAt`, `closedAt` |
| AvailabilityRegistrationWindow | `cohan-restaurant-backend/models/availability-registration-window.model.js` | Kỳ đăng ký khả dụng theo tuần | `restaurantId`, `periodStart`, `periodEnd`, `openAt`, `closeAt`, `status`, `registrationModeSnapshot` |
| StaffAvailabilitySubmission | `cohan-restaurant-backend/models/staff-availability-submission.model.js` | Đăng ký khả dụng của staff theo window | `availabilityWindowId`, `employeeId`, `slots`, `pendingSlots`, `status`, `reviewNote` |

**File đã xác minh cho section này**
- `cohan-restaurant-backend/models/user.model.js`
- `cohan-restaurant-backend/models/shift.model.js`
- `cohan-restaurant-backend/models/timesheet.model.js`
- `cohan-restaurant-backend/models/schedule-publication.model.js`
- `cohan-restaurant-backend/models/availability-registration-window.model.js`
- `cohan-restaurant-backend/models/staff-availability-submission.model.js`

## 9. Frontend component map

| Component/file | Vai trò | Gọi GraphQL nào | Lưu ý khi sửa |
|---|---|---|---|
| `ScheduleManagement.jsx` | Manager schedule + availability + attendance issue + decline review | Nhiều query/mutation: `managerShiftAttendances`, `markShiftAttendanceReviewed`, schedule lifecycle ops, shift ack review | Cập nhật test mock khi thêm query field; kiểm tra `readOnly`. |
| `StaffSchedulePage.jsx` | Staff availability + lịch cá nhân + ack + check-in/out | `availabilityWindows`, `submitStaffAvailability`, `myShiftAttendances`, `checkInShift`, `checkOutShift`, `myShiftAcknowledgements`, `respondShiftAcknowledgement` | Không phá logic context Auth/Apollo và nhãn trạng thái. |
| `components/AvailabilityRegistrationPanel.jsx` | Panel manager cho availability window/submission | Dữ liệu truyền từ parent; callback mutation ở parent | Có review late change và policy modal. |
| `components/ShiftCard.jsx` | Card tóm tắt ca và coverage | Không gọi trực tiếp | Chỉ hiển thị; phụ thuộc cấu trúc `shift` normalize. |
| `components/AddShiftModal.jsx` | Modal tạo ca + chọn nhân sự + kiểm tra availability | Gọi callback parent để mutation | Có logic lọc theo workingDays/availability. |
| `components/ShiftDetailModal.jsx` | Modal chi tiết ca, đổi giờ, thêm/xóa staff, log thay đổi | Gọi callback parent | Tôn trọng `schedulePermissions` và `readOnly`. |

**File đã xác minh cho section này**
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx`
- `src/components/Staff/components/StaffSchedulePage.jsx`
- `src/components/Dashboard_Manager/Schedule/components/AvailabilityRegistrationPanel.jsx`
- `src/components/Dashboard_Manager/Schedule/components/ShiftCard.jsx`
- `src/components/Dashboard_Manager/Schedule/components/AddShiftModal.jsx`
- `src/components/Dashboard_Manager/Schedule/components/ShiftDetailModal.jsx`

## 10. Quy tắc quan trọng khi sửa code
- [ ] Không sửa payroll khi đang làm attendance cơ bản nếu không có yêu cầu rõ.
- [ ] Không tạo model attendance mới nếu `Timesheet` đã đáp ứng.
- [ ] Không tạo Timesheet cho synthetic attendance row `shift-...` chỉ để ghi chú.
- [ ] Không dùng `window.prompt` trong `ScheduleManagement`.
- [ ] Khi thêm GraphQL field, cập nhật schema + query frontend + test mock.
- [ ] Khi thêm Apollo query trong component test, cập nhật mock tương ứng.
- [ ] Khi sửa `ScheduleManagement`, kiểm tra `readOnly` mode.
- [ ] Khi sửa attendance, kiểm tra `requireRestaurantAccess` và role guard (`requireRoles`).
- [ ] Khi sửa staff/manager data, chú ý field nhà hàng staff là `restaurantForStaff`.

**File đã xác minh cho section này**
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx`
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.test.jsx`
- `cohan-restaurant-backend/graphql/resolvers/staff/query.js`
- `cohan-restaurant-backend/graphql/resolvers/staff/mutation.js`
- `cohan-restaurant-backend/models/user.model.js`

## 11. Test và lệnh kiểm tra
Lệnh đã xác minh từ `package.json`:
- Frontend root:
  - `npm run lint`
  - `npm run build`
  - `npm test`
  - `npm run test:frontend`
  - `npm run test:backend`
- Backend package (`cohan-restaurant-backend/package.json`):
  - `npm --prefix cohan-restaurant-backend run dev`
  - `npm --prefix cohan-restaurant-backend test`
  - `npm --prefix cohan-restaurant-backend run lint`
  - `npm --prefix cohan-restaurant-backend run build`

Nếu thêm lệnh mới: xác minh trong `package.json` trước khi chạy.

**File đã xác minh cho section này**
- `package.json`
- `cohan-restaurant-backend/package.json`

## 12. Những điểm chưa hoàn thiện / không nên suy đoán
- Test suite toàn repo có thể còn fail cũ ở một số khu vực; cần xem log test mới nhất trước khi kết luận regression.
- Attendance review note hiện là ghi chú quản lý, chưa phải workflow approval đầy đủ.
- Attendance flow đã đọc không thể hiện GPS/QR cho check-in/out.
- Tài liệu này không nên dùng để suy đoán phần chưa đọc; điểm nào thiếu phải ghi **“Chưa xác minh từ source”**.

**File đã xác minh cho section này**
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.test.jsx`
- `src/components/Staff/components/StaffSchedulePage.test.jsx`

## 13. Thư mục đã kiểm tra danh sách (không đọc nội dung từng file)
- `src/context/`
- `cohan-restaurant-backend/tests/resolvers/`
- `cohan-restaurant-backend/tests/services/`

## 14. File nguồn đã đọc để tạo tài liệu

| File | Nội dung đã xác minh |
|---|---|
| `package.json` | Scripts frontend root, dependencies chính (React/Vite/Apollo/Fastify/Mercurius). |
| `vite.config.js` | Alias `@`, cấu hình dev server và SCSS global inject. |
| `README.md` | Quick start và tài liệu liên quan trong repo. |
| `src/main.jsx` | Entry frontend + `initFrontendErrorTracking`. |
| `src/App.jsx` | `ApolloProvider`, router, Auth/Notification/Cart providers. |
| `src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx` | Luồng manager scheduling/availability/ack/attendance. |
| `src/components/Dashboard_Manager/Schedule/components/AvailabilityRegistrationPanel.jsx` | UI manager availability window và review submission. |
| `src/components/Dashboard_Manager/Schedule/components/ShiftCard.jsx` | Card hiển thị coverage ca. |
| `src/components/Dashboard_Manager/Schedule/components/AddShiftModal.jsx` | Tạo ca + lọc staff theo availability/working day. |
| `src/components/Dashboard_Manager/Schedule/components/ShiftDetailModal.jsx` | Chi tiết ca + thay đổi published shift. |
| `src/components/Dashboard_Manager/Schedule/hooks/useAvailabilityPolicyUpdate.js` | Hook cập nhật policy availability qua mutation. |
| `src/components/Dashboard_Manager/Schedule/utils/scheduleHelpers.js` | Mapping role/shift rules và helper chuẩn hoá. |
| `src/components/Dashboard_Manager/Schedule/utils/scheduleInsights.js` | Build insight hiển thị cho manager. |
| `src/components/Dashboard_Manager/Schedule/utils/scheduleQuality.js` | Build summary score chất lượng lịch. |
| `src/components/Dashboard_Manager/Schedule/utils/autoSchedule.js` | Logic hỗ trợ auto schedule/availability checks. |
| `src/components/Staff/components/StaffSchedulePage.jsx` | Luồng staff availability/ack/check-in/out. |
| `src/hooks/useNotification.js` | Hook lấy notification context. |
| `src/utils/graphqlErrorUtils.js` | Helpers phân tích GraphQL error code. |
| `cohan-restaurant-backend/package.json` | Script chạy backend thực tế tại `src/server/server.js`. |
| `cohan-restaurant-backend/graphql/schema/user.graphql` | Type/query/mutation liên quan schedule/attendance/ack. |
| `cohan-restaurant-backend/graphql/resolvers/staff/query.js` | Query staff-manager, `myShiftAttendances`, `managerShiftAttendances`. |
| `cohan-restaurant-backend/graphql/resolvers/staff/mutation.js` | Mutation check-in/out, review attendance, schedule ops. |
| `cohan-restaurant-backend/models/user.model.js` | Field staff `restaurantForStaff` và index liên quan. |
| `cohan-restaurant-backend/models/timesheet.model.js` | Schema timesheet và field `note`. |
| `cohan-restaurant-backend/models/shift.model.js` | Schema shift. |
| `cohan-restaurant-backend/models/schedule-publication.model.js` | Schema publication lifecycle. |
| `cohan-restaurant-backend/models/availability-registration-window.model.js` | Schema availability window. |
| `cohan-restaurant-backend/models/staff-availability-submission.model.js` | Schema submission + reviewNote/status. |
| `cohan-restaurant-backend/src/services/availability/availabilityRegistrationWindow.service.js` | Helpers tạo window, lock submissions. |
| `cohan-restaurant-backend/src/services/availability/availabilityRegistrationSchedule.service.js` | Build schedule open/close availability theo policy. |
| `cohan-restaurant-backend/src/services/scheduling/scheduleLifecycle.service.js` | Resolve status + permissions publish lifecycle. |
| `cohan-restaurant-backend/src/services/scheduling/schedulingPermission.service.js` | Role constants + restaurant access check. |
| `cohan-restaurant-backend/src/services/attendance/attendanceCorrectionWorkflow.service.js` | Attendance correction rules/permission core. |
| `cohan-restaurant-backend/src/services/payroll/payrollRuntime.service.js` | Runtime payroll tổng quan (đã đọc mức ngắn). |
| `src/components/Dashboard_Manager/Schedule/ScheduleManagement.test.jsx` | Mock/query structure và behavior UI manager schedule. |
| `src/components/Staff/components/StaffSchedulePage.test.jsx` | Query/mutation map cho staff page tests. |


## 13. Security hardening (2026-05 update)
- Public `createUser` chỉ tạo tài khoản `CUSTOMER`, ép `provider=local`, và status phụ thuộc `ENABLE_EMAIL_VERIFICATION` (pending/active); input role/status/provider đặc quyền từ client public không còn được áp dụng.
- Upload API (`/api/upload`, `/api/upload/sign`, `/api/upload/complete`) yêu cầu Bearer JWT; có giới hạn tần suất upload theo user+IP; S3 complete chỉ chấp nhận key trong prefix cấu hình.
- Socket.IO handshake cố gắng resolve JWT từ `Authorization` hoặc `auth.token`, sau đó room join cho restaurant/user/thread/order được kiểm tra quyền/ownership trước khi join.
- Production bật Helmet CSP với whitelist origin frontend + static/image/font cần thiết; dev giữ chế độ nới lỏng.
- Runtime GraphQL requests are validated with deterministic depth and selected-field count limits before resolver execution. Defaults are `GRAPHQL_MAX_DEPTH=12` and `GRAPHQL_MAX_FIELD_COUNT=500`; production rejects values above depth 25 or field count 2000 unless `ALLOW_UNSAFE_GRAPHQL_LIMITS=true`.

- CSP Helmet ở backend chỉ áp dụng cho response do backend phục vụ trực tiếp; nếu frontend React/Vite deploy tách riêng (Vercel/Netlify/Nginx/CDN) thì CSP tương đương phải cấu hình ở layer host frontend.

## 10. Authentication flow (access + refresh)
- Access token hiện là JWT thời hạn ngắn (`ACCESS_TOKEN_EXPIRES_IN`, mặc định 15 phút) và chỉ giữ trong memory ở frontend (không lưu `localStorage/sessionStorage`).
- Refresh token là opaque token ngẫu nhiên, chỉ gửi qua cookie `HttpOnly` (`REFRESH_TOKEN_COOKIE_NAME`, `SameSite`, `Secure` ở production) và không bao giờ trả qua GraphQL.
- Login GraphQL vẫn trả `token` + `user`; backend đồng thời set refresh cookie.
- Frontend startup gọi `POST /api/auth/refresh` (`credentials: include`) để khôi phục session; nếu thành công sẽ nhận access token mới.
- Refresh endpoint xoay vòng refresh token mỗi lần gọi; token cũ bị revoke.
- Logout gọi `POST /api/auth/logout`, revoke refresh token hiện tại, clear cookie, và frontend xóa token memory + legacy keys (`auth_token`, `auth_user`, `auth_remember`, `token`).
- Luồng localStorage token cũ đã bị deprecate/removed để giảm rủi ro XSS lấy JWT.

## 10. Authentication token architecture (post-PR #822 fixes)
- Access token có TTL ngắn và chỉ lưu trong memory (không lưu localStorage/sessionStorage).
- Refresh token chỉ được gửi/nhận bằng HttpOnly cookie, không expose cho JavaScript.
- Refresh token lưu trong DB dưới dạng hash (không lưu raw token).
- Refresh token rotate ở endpoint refresh; token cũ bị revoke.
- Logout gọi server-side revoke refresh token và clear cookie.
- Cookie refresh dùng path `/api/auth` để có mặt ở cả refresh và logout.
- Legacy localStorage/sessionStorage token flow đã bị loại bỏ/deprecated; chỉ còn cleanup legacy keys khi startup/logout.
- Refresh rotation có reuse detection: nếu token đã revoke bị dùng lại, backend coi là dấu hiệu theft và revoke toàn bộ token descendant chain qua `replacedByTokenHash` (iterative + visited set).
- Log bảo mật cho reuse chỉ chứa metadata an toàn (userId/hash prefix), không bao giờ log raw refresh token.
- RefreshToken có TTL index MongoDB `expiresAt` (`expireAfterSeconds: 0`) để tự dọn token hết hạn.
- `/api/auth/refresh` và `/api/auth/logout` có Origin guard: origin phải thuộc `CORS_ORIGINS`; response từ chối là `403 Forbidden` với message chung `Forbidden`.
- Request auth-cookie thiếu Origin: production reject mặc định, chỉ cho phép khi `ALLOW_AUTH_COOKIE_NO_ORIGIN=true`; development/test cho phép mặc định trừ khi ép `ALLOW_AUTH_COOKIE_NO_ORIGIN=false`.
- Có route-level rate limit riêng cho auth-cookie endpoints: refresh (`RL_AUTH_REFRESH_MAX`, `RL_AUTH_REFRESH_WINDOW`) và logout (`RL_AUTH_LOGOUT_MAX`, `RL_AUTH_LOGOUT_WINDOW`).
## Phase 12 - AI Chatbot Knowledge Base
- Added per-restaurant knowledge model: `AiChatbotKnowledgeItem` with manager CRUD and runtime retrieval.
- GraphQL aiChatbot schema now supports knowledge list/item queries and create/update/delete mutations.
- Manager page route/hash: `#ai-chatbot-knowledge` with sidebar entry `AI Chatbot Knowledge`.
- Permissions: read/list via `report.read`; write ops via `restaurant.write` through `requireRestaurantPermission`.
- Runtime chatbot now injects top relevant enabled knowledge snippets (capped chars) into prompt context before model generation.

### AI Chatbot Phase 13
- Added backend model/service/graphql and manager UI section for Knowledge Gap Suggestions.
- Runtime now records deduplicated pending suggestions by restaurant + normalized question.

### AI Chatbot Phase 14
- New collection: `AiChatbotAnswerFeedback` for answer quality loop.
- New AI feedback service + GraphQL query/mutations for submit/review/convert workflow.
- Widget now allows guest per-answer feedback and prevents duplicate feedback in-session.
- Manager knowledge page now includes feedback review section.


## Phase 15 - AI Chatbot Safety Rules & Moderation
- Added per-restaurant safety rules model `AiChatbotSafetyRule` with rule types: `blocked_topic`, `required_disclaimer`, `handoff_topic`, `allowed_scope`.
- Added GraphQL CRUD APIs for manager/admin to manage safety rules.
- Runtime `askAiChatbot` now evaluates enabled safety rules before AI generation.
- `blocked_topic` and out-of-scope (`allowed_scope`) can short-circuit AI and return safe fallback/handoff guidance.
- `required_disclaimer` appends managed disclaimers to response.
- Matching uses safe case-insensitive includes / escaped regex only (no raw user regex execution).
- Permissions: list uses `REPORT_READ`; create/update/delete use `RESTAURANT_WRITE`; runtime evaluation is internal.

## 10. AI Chatbot Evaluation Playground (Phase 16)

- Backend service mới: `cohan-restaurant-backend/src/services/ai/restaurantChatbotEvaluation.service.js`.
- Runtime chatbot (`restaurantChatbot.service.js`) hỗ trợ mode đánh giá với cờ:
  - `persist` (default true)
  - `recordSuggestions` (default true)
  - `evaluationMode` (default false)
- GraphQL mở rộng trong `graphql/schema/aiChatbot.graphql`:
  - Query evaluate prompt + run evaluation set
  - CRUD evaluation case
- Model mới: `AiChatbotEvaluationCase` (`cohan-restaurant-backend/models/ai-chatbot-evaluation-case.model.js`).
- Manager UI: bổ sung section Evaluation Playground trong `AiChatbotKnowledgePage.jsx`.

### Bảo toàn hành vi hiện hữu

- Guest widget (`askAiChatbot`) không đổi flow mặc định.
- Các side-effect production (persist chat/suggestion/handoff) chỉ chạy ở mode normal.
- Mode evaluation chỉ phục vụ internal manager QA.

### AI Chatbot Production Hardening (Phase 17)
- Manager UX now groups chatbot operations into maintainable functional tabs.
- Runtime side-effect boundary: evaluation mode never persists chat messages/conversations and never writes knowledge-gap suggestions.
- DTO/GraphQL safety convention: non-null list fields always return arrays; GraphQL IDs are string-safe at service boundaries.
- Added simple AI risk signal summary for managers (fallback spikes, not-helpful spikes, pending suggestion backlog).
- Known limitation: risk signals are threshold-based counters (no trend charting yet).

### AI Chatbot Phase 18 Completion
- Monitoring dashboard now includes production summary cards, risky signals, and recent quality queue data paths.
- Manager tools include bulk moderation actions and knowledge import/export.
- Runtime guardrails retained for safety-first response behavior and side-effect-free evaluation flows.
## 10. Auth security hardening (final cleanup)
- All auth/user mutation responses now pass through `sanitizeUserForClient` before being returned to clients.
- Sensitive fields (`passwordHash`, email verification tokens, deleted/internal lifecycle fields) are never included in login/refresh payloads.
- Refresh endpoint (`/api/auth/refresh`) only returns sanitized user objects.
- `seed-admin` now stores `role` as a single ObjectId value (not array) and builds payload via helper.
- `.env.example` documents split access/refresh token settings, refresh/logout rate limits, and auth cookie origin guard settings.
- Production env validation blocks disabling reCAPTCHA unless `ALLOW_DISABLE_RECAPTCHA_IN_PRODUCTION=true`; production also rejects missing/placeholder `RECAPTCHA_SECRET` when enabled.
- Production CSP blocks `unsafe-inline` styles by default; enable only with `CSP_ALLOW_UNSAFE_INLINE_STYLE=true`.


### AI Chatbot Phase 19 Stabilization (2026-05-27)
- Post-merge regression QA executed for backend chatbot services (runtime, knowledge, bulk-ops, analytics, safety, feedback, evaluation, evaluation safety).
- Fixed AI chatbot schema safety test path resolution so CI resolves `aiChatbot.graphql` correctly from backend test cwd.
- Frontend chatbot suite stabilized by removing duplicate aggregator execution path that re-imported and re-ran widget suites.
- Verified production build still succeeds after stabilization pass.

## Demo script safety

- Demo scripts are intended for local/development use only.
- Production-like environments are blocked by default.
- To intentionally run in production-like environments, set both `ALLOW_DEMO_SEED_IN_PRODUCTION=true` and `DEMO_PASSWORD=<strong temporary password>`.
- Do not use `Demo@123456` outside local/dev.
- Script logging masks MongoDB URI credentials to prevent secret leakage.

## 20. AI Chatbot rollout readiness map (Phase 20A)

### 20.1 Thành phần production

- GraphQL schema: `cohan-restaurant-backend/graphql/schema/aiChatbot.graphql`
- Resolver entry: `cohan-restaurant-backend/graphql/resolvers/aiChatbot/index.js`
- Core services:
  - `src/services/ai/restaurantChatbot.service.js`
  - `src/services/ai/restaurantChatbotSettings.service.js`
  - `src/services/ai/restaurantChatbotKnowledge*.service.js`
  - `src/services/ai/restaurantChatbotFeedback.service.js`
  - `src/services/ai/restaurantChatbotSafety.service.js`
  - `src/services/ai/restaurantChatbotEvaluation.service.js`
  - `src/services/ai/restaurantChatbotAnalytics.service.js`

### 20.2 Boundary công khai vs manager

- Public/guest: `askAiChatbot`, `publicAiChatbotSettings`, guest handoff follow-up flows, feedback submit.
- Manager/reporting:
  - knowledge/suggestion/feedback moderation,
  - safety rules,
  - evaluation playground,
  - analytics.
- Bulk write/import/export phải giữ `RESTAURANT_WRITE` boundary.
- Analytics phải giữ report permission boundary.

### 20.3 Vận hành và rollback

- Env vận hành chatbot nằm ở backend (`OPENAI_API_KEY`, `AI_CHATBOT_MODEL`, `AI_MODEL`).
- Nếu provider unavailable: chatbot chạy fallback theo service hiện tại.
- Checklist rollout/rollback chi tiết tại `docs/ai-chatbot-release-checklist.md`.

### 4.x AI Chatbot universal assistant
- Backend service: `cohan-restaurant-backend/src/services/ai/restaurantChatbot.service.js` builds sanitized chatbot context, classifies intents, enforces refusal logic, calls Gemini/OpenAI from the backend only, and falls back deterministically on provider failure.
- GraphQL API: `cohan-restaurant-backend/graphql/schema/aiChatbot.graphql` exposes `AskAiChatbotInput.pageContext` as JSON so the frontend can pass route/page state without exposing secrets.
- Frontend widget: `src/components/common/AiChatbotWidget.jsx` sends current route context and renders safe action buttons while preserving the customer cart open event.
- Feature map: `src/utils/aiChatbotFeatureMap.js` maps Home, restaurant detail, menu, food detail, cart, checkout, orders, reservations/table booking, profile/account, manager dashboard, staff/schedule, storage/inventory, and AI chatbot manager tools.
- Scope: menu assistant, ordering assistant, reservation assistant, account/profile assistant, feature navigation assistant, and support handoff assistant.
- Safety: user context is limited to guest/authenticated status, display name, visible email, and role/user type; passwords, tokens, API keys, secrets, unrelated internal IDs, other users' data, and unauthorized manager data are not exposed.
## 10. Frontend GraphQL schema validation
- Frontend GraphQL documents in `src/**/*.js`, `src/**/*.jsx`, `src/**/*.ts`, and `src/**/*.tsx` are validated by `src/__tests__/graphql-schema-validation.test.js` against the merged backend schema files in `cohan-restaurant-backend/graphql/schema/*.graphql`.
- The validation test extracts `gql` template literals from frontend source files, builds an executable schema from the backend SDL, and runs GraphQL `validate()` without starting the backend server or making network calls.
- When backend schema return types or fields change, update any affected frontend `gql` queries/fragments at the same time and run `npx vitest run src/__tests__/graphql-schema-validation.test.js` before merging.
- Runtime backend GraphQL validation also enforces query depth and selected-field count limits using `GRAPHQL_MAX_DEPTH`, `GRAPHQL_MAX_FIELD_COUNT`, and `ALLOW_UNSAFE_GRAPHQL_LIMITS`; keep new frontend operations comfortably within those limits instead of raising limits by default.
- This check is intended to catch schema drift such as querying removed fields (for example `noteInternal` on `User`) or spreading fragments on incompatible return types (for example a `StaffPrivateProfile` fragment on a field that returns `User`).

**File đã xác minh cho section này**
- `src/__tests__/graphql-schema-validation.test.js`
- `cohan-restaurant-backend/graphql/schema/*.graphql`

### 4.x+ Phase 23 AI Chatbot query-aware workflows
- Query-aware matching lives in `src/utils/aiChatbotFeatureMap.js`; it combines route matching with Vietnamese aliases and message text so feature discovery works from any page.
- `src/components/common/AiChatbotWidget.jsx` builds `pageContext` at send time with the current message, selected menu item, restaurant id, role, and sanitized feature matches only.
- Backend sanitization in `cohan-restaurant-backend/src/services/ai/restaurantChatbot.service.js` accepts only safe action types (`link`, `search`, `handoff`, `openCart`), only internal feature links beginning with `/`, and `openCart` without a path.
- Guided customer workflows are deterministic fallbacks for ordering and table reservations, with current-user-only Q&A for identity, cart, orders, reservations, coupons, restaurant, and menu context.
- Provider prompts describe the role as an AI App Assistant for Cohan Restaurant App and continue to forbid hallucinated data, credentials/secrets, other-user data, and unauthorized manager data.

### Phase 24 AI chatbot safe action cards

The AI chatbot service now includes a deterministic action-card layer in `cohan-restaurant-backend/src/services/ai/restaurantChatbot.service.js`. It builds safe in-app actions from intent, page context, sanitized feature-map matches, safe user profile, cart/order/reservation summaries, restaurants, and in-context menu items before considering provider output.

Action shape:

```json
{
  "type": "link | openCart | handoff | search",
  "label": "string",
  "href": "optional string",
  "description": "optional string",
  "icon": "optional string",
  "priority": 1
}
```

Allowed workflows are navigation and guidance only: open the cart drawer, view menu/food detail, open checkout through the existing checkout route when appropriate, view current-user orders/profile, open a reservation layout for a known restaurant, choose a restaurant when no id exists, or request staff handoff. The model must not auto-create orders, payments, reservations, cart lines, profile changes, or destructive operations.

Both backend and frontend reject unsafe action payloads including script/data/mail/telephone schemes, protocol-relative external URLs, unknown action types, provider-suggested add-to-cart candidates, destructive operations, and automatic payment/checkout/reservation actions. The frontend renders safe actions as cards in `src/components/common/AiChatbotWidget.jsx` and styles them in `src/components/common/AiChatbotWidget.scss`.
