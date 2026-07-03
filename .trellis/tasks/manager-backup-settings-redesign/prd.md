# PRD — Nâng cấp trang Sao lưu và Cài đặt

## Hiện trạng

- Trang Cài đặt còn nhiều wording Anh–Việt như `SYSTEM CONTROL CENTER`, `Timezone`, `Currency`, `Quick actions`, `RBAC`, `Backup`.
- Fallback frontend không đồng nhất backend: giờ bắt đầu ngày vận hành là 6 thay vì 5, module sao lưu tắt thay vì bật.
- Trang Sao lưu có đầy đủ nghiệp vụ nhưng quá nhiều khối cùng cấp, khiến hành động chính bị chìm và khó phân biệt thao tác an toàn với thao tác có rủi ro.
- Hai trang chưa đồng nhất hoàn toàn với hệ màu sage của khu vực quản lý và chưa có dark mode riêng đủ rõ.

## Luồng thật

### Cài đặt
`SystemSetting schema/model` → `systemSetting/updateSystemSetting resolver` → quyền `restaurant.read/system.manage`, restaurant scope, audit log → Apollo query/mutation → form cấu hình → component tests.

### Sao lưu
`BackupRun + backup schema` → backup resolver/service → quyền `backup.read/write/export/import`, restaurant scope, audit log → Apollo preview/export/import → checklist, xử lý xung đột và lịch sử → component tests.

## Phạm vi

1. Việt hóa wording sản phẩm cuối cho trang Cài đặt.
2. Đồng bộ fallback frontend với mặc định backend.
3. Tái tổ chức phân cấp hành động, trạng thái và bố cục hai trang bằng React/SCSS hiện có.
4. Phân biệt rõ hành động chính, phụ và nguy hiểm trên trang Sao lưu mà không đổi markup nghiệp vụ.
5. Cải thiện focus, touch target, responsive, dark mode và reduced-motion.

## Tiêu chí nghiệm thu

- Không còn wording kỹ thuật Anh–Việt ở phần người dùng nhìn thấy của trang Cài đặt.
- Fallback frontend khớp backend: giờ bắt đầu 5, module sao lưu bật, phiên bản mặc định 1.
- Hành động chính/phụ/nguy hiểm phân biệt rõ bằng cả wording và style.
- Form, card cấu hình, checklist, export/import và xử lý xung đột không vỡ khi dữ liệu dài.
- Hai trang dùng được ở desktop, tablet, 430×932 và 390×844.
- Các luồng query/mutation, quyền, restaurant scope và audit không thay đổi.

## Ngoài phạm vi

- Không đổi schema GraphQL, resolver, service, permission code hoặc route.
- Không thêm dependency hoặc abstraction mới.
- Không thay đổi định dạng file sao lưu và thuật toán xử lý xung đột.
