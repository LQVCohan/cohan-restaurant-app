# ✅ Test Cases: Order and Reservation Flow

## ✅ Test Case 1: Tạo order trước, sau đó thêm thông tin người dùng (guest)

- **Mục tiêu:** Đảm bảo có thể tạo order trước và cập nhật thông tin khách sau đó.
- **Bước kiểm thử:**
  1. Truy cập màn hình POS, chọn bàn và tạo order mới (chưa cần nhập thông tin người dùng).
  2. Lưu order (status = `unpaid`, chưa có user).
  3. Chọn lại order vừa tạo → nhập thông tin: `customerName`, `customerPhone`.
  4. Hệ thống tạo 1 user dạng `guest` và gán vào order.
- **Kết quả mong đợi:**
  - Order được cập nhật với thông tin user guest.
  - User guest có `isGuest: true`, `status: active`, và `guestExpiresAt` được set 30 ngày.

---

## ✅ Test Case 2: Tạo order với thông tin người dùng ngay từ đầu

- **Mục tiêu:** Đảm bảo khi nhập thông tin người dùng ngay, hệ thống tạo và gán user đúng cách.
- **Bước kiểm thử:**
  1. Truy cập POS, chọn bàn, chọn món ăn.
  2. Nhập ngay thông tin `customerName`, `customerPhone` hoặc `customerEmail`.
  3. Lưu order.
- **Kết quả mong đợi:**
  - Hệ thống tự động tạo user guest và gán userId vào order.
  - Không có lỗi `BAD_USER_INPUT`.

---

## ✅ Test Case 3: Đặt bàn trước (reservation), sau đó chuyển sang order

- **Mục tiêu:** Đảm bảo thông tin user từ reservation được tái sử dụng khi tạo order.
- **Bước kiểm thử:**
  1. Tạo reservation trước: nhập đầy đủ `customerName`, `customerPhone` hoặc `customerEmail`.
  2. Đến giờ, vào lại bàn đó → bắt đầu order.
  3. Hệ thống nhận diện user từ reservation và gán vào order.
- **Kết quả mong đợi:**
  - Order mới được tạo ra với user giống từ reservation.
  - Không tạo thêm user guest mới nếu đã tồn tại.

---

## ✅ Test Case 4: Không nhập thông tin khách hàng (negative case)

- **Mục tiêu:** Kiểm tra hệ thống có báo lỗi đúng khi thiếu thông tin bắt buộc.
- **Bước kiểm thử:**
  1. Cố gắng tạo reservation chỉ nhập `customerName`, không có `customerPhone` hoặc `customerEmail`.
  2. Submit form.
- **Kết quả mong đợi:**
  - Lỗi trả về: `"Customer name and (phone or email) are required."`
  - Không tạo reservation.

---

## ✅ Test Case 5: Xóa table draft sau khi lưu order

- **Mục tiêu:** Đảm bảo sau khi lưu order, draft của bàn được xóa để tránh dữ liệu rác.
- **Bước kiểm thử:**
  1. Chọn bàn, thêm món, tạo draft.
  2. Lưu order.
  3. Kiểm tra backend/database → không còn tableDraft theo `tableId`.
- **Kết quả mong đợi:**
  - Draft bị xóa khỏi hệ thống sau khi order chính thức được tạo.

---

## ✅ Test Case 6: Đặt bàn trùng thời gian (reservation)

- **Mục tiêu:** Đảm bảo không thể đặt bàn đã được đặt/reserved.
- **Bước kiểm thử:**
  1. Đặt bàn A với giờ `19:00`, thời lượng 90 phút.
  2. Tạo thêm một reservation trùng giờ với bàn A.
- **Kết quả mong đợi:**
  - Lỗi trả về: `"Table is not available."`
  - Reservation không được tạo.
