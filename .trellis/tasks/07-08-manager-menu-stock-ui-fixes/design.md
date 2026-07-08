# Design — Manager menu stock UI fixes

## Quyết định

### 1. Tái sử dụng dữ liệu tồn kho hiện có

`MenuItem.maxAvailable` đã được resolver tính từ tồn khả dụng (`onHand - reserved`) và định lượng của serving variant mặc định. Thẻ quản lý chỉ render dữ liệu này. Không gọi `menuItemLiveState` theo từng card để tránh N+1 query và vì live state của khách phụ thuộc lựa chọn serving variant.

### 2. Số lượng nằm trong quick note

Badge trạng thái phía trên đã cho biết món sẵn sàng/tạm dừng. Quick note hiện ghi “Có thể đặt món” nên được thay bằng `Còn X suất` khi món có tracking. Cách này không làm card cao thêm và loại bỏ nội dung trùng.

### 3. Dropdown dùng overflow visible

Card compact chuyển sang `overflow: visible`; các vùng ảnh và danh sách biến thể vẫn tự clip. Khi menu mở, card nhận class z-index để menu nằm trên card lân cận.

### 4. CategoryModal dùng cấu trúc Modal chuẩn

Dùng trực tiếp `Modal.Header` và `Modal.Body`; bỏ `modal-container` và header lồng. Nội dung list/form vẫn giữ state và mutation hiện tại.

### 5. Điều hướng kho dùng event hiện có

Nút định lượng dispatch `manager:navigate` với `page: inventory`, cùng pattern đang dùng trong repo. Không reload trang và không dùng hash id cũ.

## Responsive và accessibility

- Search dùng `type=search`, label/aria-label, autocomplete tắt cho bộ lọc và nút xóa có accessible name.
- Focus ring dùng `:focus-within`/`:focus-visible`.
- Modal giữ focus trap, Escape và scroll lock từ component chung.
- Không dùng CSS zoom hoặc dependency mới.
