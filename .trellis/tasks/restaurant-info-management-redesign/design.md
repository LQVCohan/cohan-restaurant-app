# Design — Hồ sơ nhà hàng

## Hướng thị giác

Một “hồ sơ mặt tiền số” ấm, rõ thứ bậc và thiên về vận hành nhà hàng. Giữ bảng màu kem–nâu hiện có, dùng xanh lá chỉ cho trạng thái tốt. Không thêm gradient tím hoặc card SaaS chung chung.

## Bố cục

- Header: tiêu đề bên trái, bốn chỉ số thật ở giữa, cụm chọn nhà hàng/bản nháp/lưu bên phải.
- Khối ưu tiên: tên nhà hàng và các thông tin khách nhìn thấy đầu tiên, cạnh checklist hoàn thiện.
- Khu chỉnh sửa: cột form chính và live preview sticky; trên tablet/mobile chuyển thành một cột.
- Vùng nhận diện: cover ngắn hơn, avatar dạng squircle nằm trong luồng tài liệu và chồng nhẹ lên cover; tab bắt đầu ngay sau identity rail.

## Chi tiết tương tác

- Nút lưu chỉ bật khi có thay đổi và có nhà hàng được chọn.
- Nút ảnh đại diện là button native, có focus ring và aria-label.
- AI rewrite dùng mutation Apollo hiện có và thông báo rõ Gemini/fallback.
- Tab cuộn ngang trên mobile; toàn bộ AntD columns chuyển 100% ở màn hình nhỏ.
- Tôn trọng `prefers-reduced-motion`.

## Sai lệch có chủ ý so với ảnh hiện tại

- Bỏ hàng ba KPI rời vì dữ liệu được chuyển lên header.
- Thu nhỏ cover và avatar để giảm cuộn dọc.
- Giữ phone preview thay vì đổi sang mockup mới vì nó đang dùng route thật và postMessage thật.
