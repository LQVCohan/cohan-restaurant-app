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

- CSP Helmet ở backend chỉ áp dụng cho response do backend phục vụ trực tiếp; nếu frontend React/Vite deploy tách riêng (Vercel/Netlify/Nginx/CDN) thì CSP tương đương phải cấu hình ở layer host frontend.
