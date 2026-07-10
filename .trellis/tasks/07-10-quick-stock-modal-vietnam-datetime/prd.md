# Nâng cấp modal nhập kho nhanh và chuẩn hóa giờ Việt Nam

## Hiện trạng

- Modal nhập kho nhanh dùng `new Date().toISOString().slice(0, 16)` cho `datetime-local`, nên giờ mặc định là UTC và bị lệch 7 giờ so với Việt Nam.
- Khi gửi form, `new Date(row.datetime).toISOString()` diễn giải giá trị theo múi giờ của trình duyệt, vì vậy cùng một giờ nhập có thể tạo ISO khác nhau trên máy ở múi giờ khác.
- Nội dung modal có vùng cuộn riêng bên trong `Modal.Body`, tạo nguy cơ cuộn lồng; hệ thống phân cấp thị giác còn phẳng và các trường phụ chưa được nhóm rõ.
- Trường ngày giờ phụ thuộc cách hiển thị mặc định của trình duyệt, chưa có dòng xác nhận rõ theo định dạng Việt Nam.

## Luồng thực tế

`StockItem/StockMovement model -> inventory GraphQL receiveStock schema -> stock.mutation receiveStock + restaurant permission -> RECEIVE_STOCK Apollo mutation -> StorageManagement onSubmit/buildReason -> QuickStockModal`.

Schema và resolver đã nhận `DateTime` ISO hợp lệ; root cause nằm ở bước tạo và chuyển đổi giá trị ngày giờ tại modal.

## Phạm vi thay đổi

- `src/components/Dashboard_Manager/Storage/components/ingredients/QuickStockModal.jsx`: dùng helper giờ Việt Nam có sẵn để tạo giá trị mặc định và chuyển về ISO khi submit; thêm dòng hiển thị `dd/mm/yyyy, HH:mm`; cải thiện thứ bậc nội dung và nhãn lô.
- `src/components/Dashboard_Manager/Storage/components/ingredients/QuickStockModal.scss`: đồng bộ bảng màu modal hiện có, bỏ vùng cuộn lồng, làm rõ nhóm thông tin chính/phụ, tối ưu desktop và mobile.
- `src/components/Dashboard_Manager/Storage/components/ingredients/QuickStockModal.test.jsx`: kiểm tra giờ mặc định Việt Nam và payload ISO UTC ổn định.

## Tiêu chí chấp nhận

- Khi thời điểm hiện tại là `2026-07-10T01:29:00.000Z`, modal mặc định hiển thị `10/07/2026, 08:29` và giá trị form là `2026-07-10T08:29`.
- Khi submit `2026-07-10T08:29`, payload gửi lên GraphQL là `2026-07-10T01:29:00.000Z`, không phụ thuộc múi giờ máy người dùng.
- Giao diện có phần giới thiệu ngắn, số lượng lô, thông tin lô rõ ràng, dải quy đổi dễ đọc và nút hành động nhất quán với modal dùng chung.
- Modal chỉ dùng vùng cuộn của `Modal.Body`, không tạo scrollbar dọc lồng nhau.
- Trên màn hình nhỏ, các trường xếp một cột và hai nút hành động không che nội dung.
- Không thay đổi schema GraphQL, resolver, quyền `stock.write`, phạm vi nhà hàng hoặc dữ liệu tồn kho.

## Ngoài phạm vi

- Không thay đổi nghiệp vụ tính giá, quy đổi đơn vị hoặc cách ghi `StockMovement`.
- Không thêm thư viện ngày giờ hoặc UI mới.
- Không chạy toàn bộ CI.
