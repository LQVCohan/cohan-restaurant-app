# Sửa modal lịch rảnh bị giới hạn viewport và kẹt cuộn

## Hiện trạng

Modal **Lịch rảnh đã đăng ký** chỉ phủ vùng nội dung lịch, không phủ header/sidebar của trang quản lý. Sau khi tối ưu chiều cao, nội dung modal còn bị kẹt: body đã khóa cuộn nhưng vùng modal/bảng không nhận được vùng cuộn ổn định.

## Luồng thực tế

`ScheduleManagement -> AvailabilitySnapshotModal -> manager page shell -> AvailabilitySnapshotModal.scss -> AvailabilitySnapshotOverlayLight.css`.

Dữ liệu, GraphQL và logic lập bảng vẫn đúng. Lỗi nằm ở nơi modal được mount và hợp đồng overflow giữa overlay, modal và bảng.

## Nguyên nhân gốc

- `AvailabilitySnapshotModal` render trực tiếp bên trong `manager-page-shell__body`.
- Các lớp layout/schedule có animation, transform, overflow và stacking context riêng; vì vậy `position: fixed` của overlay bị giới hạn theo khung trang thay vì viewport trình duyệt.
- Component khóa cuộn body, trong khi modal desktop dùng `overflow: hidden`; khi overlay bị giới hạn bởi ancestor, người dùng không còn vùng cuộn hợp lệ.

## Hướng sửa

- Giữ nguyên component nội dung hiện tại trong `AvailabilitySnapshotModalInline.jsx`.
- Dùng `createPortal(..., document.body)` tại `AvailabilitySnapshotModal.jsx` để overlay thoát hoàn toàn khỏi layout quản lý.
- Ép overlay phủ `100vw x 100dvh` và cho chính overlay cuộn khi cần.
- Desktop giữ modal dạng flex cố định theo viewport; bảng là vùng cuộn chính.
- Điện thoại cho overlay cuộn toàn modal, đồng thời giữ bảng có vùng cuộn riêng.
- Thêm test xác nhận dialog là con trực tiếp của `document.body`.

## File thay đổi

- `src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.jsx`
- `src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModalInline.jsx`
- `src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.portal.test.jsx`
- `src/styles/AvailabilitySnapshotOverlayLight.css`
- `.trellis/tasks/07-11-availability-snapshot-light-overlay/prd.md`
- `.trellis/tasks/07-11-availability-snapshot-light-overlay/task.json`

## Tiêu chí chấp nhận

- Overlay phủ cả header, sidebar và toàn bộ viewport.
- Modal không còn bị định vị theo vùng nội dung lịch.
- Có thể cuộn bảng theo cả chiều ngang và dọc trên desktop.
- Trên màn hình thấp hoặc điện thoại, người dùng cuộn được toàn bộ modal.
- Đóng bằng nút và phím Escape vẫn hoạt động.
- Dữ liệu, bộ lọc và trạng thái lịch rảnh không thay đổi.

## Kiểm tra dự kiến

- `npm run test:component -- AvailabilitySnapshotModal.portal.test.jsx`
- `npm run check:conflicts`
- `npm run build`
- Kiểm tra trực quan desktop và 390x844 / 430x932.
