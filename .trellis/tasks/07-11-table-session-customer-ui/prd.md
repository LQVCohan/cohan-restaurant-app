# PRD — Tối ưu trang theo dõi bàn cho khách hàng

## Hiện trạng và nguyên nhân

Trang `/table/:restaurantId/:tableId` đã lấy đúng dữ liệu từ `publicActiveTableSessionOrders` và các thao tác gọi nhân viên/thanh toán hoạt động qua mutation hiện có. Vấn đề nằm ở lớp trình bày: trang đang giống bảng vận hành nội bộ, hiển thị các từ hoặc giá trị kỹ thuật như `Live`, mã order, `portion`, `default`, nhiều tiền tố trạng thái và mô tả quy trình bếp không cần thiết với khách hàng.

## Luồng đã trace

`publicTableSession.graphql` → `publicActiveTableSessionOrders` resolver → `buildPublicActiveTableSessionOrdersResult` → Apollo query/mutations trong `TableCurrentSessionPage` → route công khai → `TableOrderExperience` launcher.

## Phạm vi

- Giữ nguyên schema, resolver, token, polling, mutation và dữ liệu trả về.
- Đổi nội dung sang tiếng Việt đơn giản, hướng theo nhu cầu khách hàng.
- Không hiển thị mã order và giá trị kỹ thuật của đơn vị/phần ăn khi chúng không có ý nghĩa với khách.
- Sắp xếp lại phân cấp thị giác, giảm số khối dạng dashboard và làm nổi bật thao tác gọi thanh toán/gọi nhân viên.
- Giữ responsive, focus, disabled, loading, error và reduced-motion hiện có.

## File thay đổi

- `src/components/Customer/TableCurrentSession/TableCurrentSessionPage.jsx`: nội dung và cấu trúc hiển thị.
- `src/components/Customer/TableCurrentSession/TableCurrentSessionPage.scss`: bố cục và responsive.
- `src/components/Customer/TableCurrentSession/TableOrderExperience.jsx`: mô tả nút gọi món.

## Tiêu chí nghiệm thu

- Không còn `Live`, mã order, `portion`, `default` trên trang theo dõi bàn.
- Khách hiểu ngay món đang được xác nhận, chuẩn bị, sẵn sàng hay đã phục vụ.
- Tạm tính và hai thao tác chính dễ tìm nhưng không che nội dung trên điện thoại.
- Không thay đổi contract GraphQL hoặc nghiệp vụ gọi món/thanh toán.
- Không thêm dependency hoặc abstraction mới.

## Kiểm tra dự kiến

- `npm run check:graphql:operations`
- Targeted component test nếu có; nếu chưa có, chạy build frontend phù hợp.
- Kiểm tra diff và responsive bằng mã nguồn; ghi rõ browser smoke chưa chạy nếu runtime không có trình duyệt.
