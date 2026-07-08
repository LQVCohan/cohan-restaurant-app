# PRD — Lưu đầy đủ cấu hình trong modal chi tiết bàn

## Hiện trạng

Modal chi tiết bàn cho phép cập nhật mã bàn, sức chứa, loại bàn, nhãn, khu vực phục vụ, ảnh/link 360, tiền đặt cọc, khuyến mãi, quyền lợi thêm và chính sách đặt bàn. Mutation hiện đã gửi các trường này và model `Table` đã lưu trực tiếp trong cùng document.

Sau khi refetch hoặc tải lại trang, một số giá trị biến mất khỏi modal vì resolver danh sách bàn dùng projection thiếu trường. Điều này khiến dữ liệu đã lưu trong MongoDB trông giống chỉ được giữ tạm ở frontend.

## Luồng thật

`Table model` → `floor_table.graphql` → resolver `updateTable` / query `tables` → fragment `TableMin` trong `useTableManagement` → `TableManagement` → `TableActionsLiteModal` → nút `Lưu thay đổi`.

## Nguyên nhân gốc

`Table.type` và các trường cấu hình đã tồn tại ở model, GraphQL update input và payload mutation. Tuy nhiên `TABLE_SELECT` trong resolver query chưa chọn:

- `zone`
- `promotionIds`
- `bookingPerks`
- `reservationHoldMinutes`
- `minSpend`
- `cancelPolicy`

Do đó query `tables` trả về thiếu các trường mà modal cần để khôi phục trạng thái đã lưu.

## Phạm vi thay đổi

- Bổ sung các trường cấu hình modal vào projection đọc bảng.
- Giữ `type` là trường trực tiếp của `Table`; không tạo model loại bàn hoặc model cấu hình con.
- Thêm kiểm tra backend cho projection.
- Thêm kiểm tra component để bảo đảm payload lưu chứa `type` và các trường cấu hình cần lưu.

## Tiêu chí nghiệm thu

- Đổi “Loại bàn” và bấm `Lưu thay đổi` gửi `type` qua mutation `updateTable`.
- Sau refetch hoặc tải lại, modal hiển thị lại đúng loại bàn, khu vực, khuyến mãi, quyền lợi và chính sách đã lưu.
- Dữ liệu tiếp tục nằm trực tiếp trong document `Table` hiện có.
- Không thay đổi quyền `TABLE_WRITE`, restaurant scope, audit log hoặc luồng trạng thái/ghép bàn.
- Không thêm model, collection, dependency hoặc abstraction mới.

## Ngoài phạm vi

- Không lưu kết quả gợi ý AI vì đây là dữ liệu phiên làm việc.
- Không lưu nội dung ô `quickPerk` trước khi người dùng bấm `Thêm`; chỉ mảng `bookingPerks` đã xác nhận được lưu.
- Không chuyển file ảnh 360 dạng base64 vào MongoDB; DB chỉ giữ `vrUrl` như thiết kế hiện tại.
