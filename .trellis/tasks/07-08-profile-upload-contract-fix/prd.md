# Sửa luồng cập nhật hồ sơ và upload avatar

## Hiện trạng và root cause

- Frontend gọi `updateUser(input: ...)`, resolver cũng lấy người dùng hiện tại từ access token, nhưng SDL lại yêu cầu thêm `id: ID!`. GraphQL từ chối operation bằng HTTP 400 trước khi resolver chạy.
- Resolver và các màn hình hồ sơ đã dùng `input.avatarUrl`, nhưng `UpdateUserInput` chưa khai báo trường này nên lưu avatar tiếp tục bị GraphQL validation 400.
- Shared upload hook gọi `/upload`, `/upload/sign` và `/upload/complete`. Backend có các route này, nhưng Vite dev proxy chỉ chuyển `/api` và `/uploads`, không chuyển `/upload`; URL tương đối vì vậy bị gửi nhầm vào frontend dev server.
- `ManagerAccountCenter` mới chỉ hiển thị `avatarUrl`, chưa có hành động chọn ảnh, upload và lưu URL.

## Luồng đã trace

`User` Mongoose model → `user.graphql` (`UpdateUserInput`, `Mutation.updateUser`) → `UserMutation.updateUser` lấy `ctx.user.id` và lưu `avatarUrl` → `useAvatarUploadLocal` gọi Fastify upload route → Apollo mutation trong `ManagerAccountCenter` → nút lưu hồ sơ quản lý.

Các route upload được đăng ký qua `upload.route.js`; local mode dùng `POST /upload`, S3 mode dùng `POST /upload/sign` và `POST /upload/complete`. Do đó root cause không phải đổi route backend sang endpoint mới mà là đồng bộ schema và proxy chung.

## Phạm vi thay đổi

- Bỏ đối số `id` bắt buộc khỏi `Mutation.updateUser` và thêm `avatarUrl` vào `UpdateUserInput`.
- Thêm proxy `/upload` vào Vite để bao phủ cả ba endpoint dùng chung.
- Nối chọn ảnh, preview, upload và cập nhật avatar tại trung tâm tài khoản quản lý bằng hook hiện có.
- Thêm kiểm tra hồi quy nhỏ cho contract GraphQL và URL upload.

## Tiêu chí chấp nhận

1. Các mutation `updateUser(input: ...)` hiện có vượt qua GraphQL validation.
2. `avatarUrl` được phép gửi trong `UpdateUserInput` và được resolver lưu.
3. Trong dev, `/upload`, `/upload/sign` và `/upload/complete` được chuyển đến backend.
4. Quản lý có thể chọn ảnh, xem preview và lưu avatar cùng họ tên.
5. Lỗi upload không làm mất thay đổi hồ sơ và hiển thị thông báo lỗi hiện có.
6. Không đổi auth, quyền, restaurant scoping, storage adapter hoặc thêm dependency.

## Ngoài phạm vi

- Không thay cơ chế local/S3 hoặc thêm dịch vụ lưu trữ mới.
- Không đổi luồng OTP cho email và số điện thoại.
- Không thiết kế lại toàn bộ giao diện trung tâm tài khoản.
