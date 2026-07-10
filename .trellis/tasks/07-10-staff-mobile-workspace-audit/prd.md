# PRD — Responsive toàn bộ khu vực nhân viên

## Hiện trạng

Khu vực `/staff/*` dùng chung `StaffLayout`, sau đó render nhiều trang nghiệp vụ: tổng quan, lịch, chấm công, nghỉ phép, order, bếp, hiệu suất, hồ sơ, thông báo, liên lạc, bàn giao AI, phiếu lương, cài đặt và duyệt đổi đặt bàn.

Phần lớn trang con đã có breakpoint riêng, nhưng responsive không ổn định vì shell dùng class và DOM không khớp CSS, còn các bảng, ma trận, panel hội thoại và thanh sticky không có lớp containment chung trên điện thoại. Trang duyệt đổi đặt bàn vẫn dùng inline style thiên về desktop.

## Luồng thật

- Route: `AppRouter` → `StaffLayout` → trang `/staff/*`.
- Điều hướng: state `menuOpen` → class `staff-shell__nav is-open` → các `Link` theo role/permission.
- Dữ liệu nghiệp vụ giữ nguyên tại từng hook/query/mutation; task này chỉ thay đổi layout, semantic control và responsive CSS.
- Liên lạc: `StaffCommunicationPage` → `ContactsView` → `ChatThreadPanel`.
- Duyệt đổi đặt bàn: `ReservationChangeReviewPage` → query pending → approve/reject mutation → card hành động.

## Nguyên nhân gốc

1. React mở menu bằng `.staff-shell__nav.is-open`, nhưng SCSS mobile ẩn `.staff-shell__nav` và style `.staff-shell__drawer` không tồn tại.
2. Active link dùng `.is-active`, trong khi một phần SCSS vẫn chờ modifier `--active/--idle`.
3. Các trang con có responsive riêng nhưng thiếu ranh giới chung về `min-width: 0`, overflow cục bộ, safe-area, input 16 px và touch target 44 px.
4. `ReservationChangeReviewPage` sử dụng inline flex/grid desktop nên không có breakpoint có thể bảo trì.
5. Contact card và chat panel chưa tối ưu kích thước màn hình điện thoại và accessible name cho icon-only controls.

## Hướng giao diện

Không gian vận hành nhân viên gọn, rõ, dùng palette trắng–sage hiện có; header mobile ưu tiên tên tác vụ và menu; card một cột; bảng/ma trận cuộn trong chính vùng dữ liệu; hành động chính rộng, tối thiểu 44 px; modal hội thoại dùng chiều cao động và safe-area.

## Phạm vi

- Sửa menu mobile thật trong `StaffLayout`, giữ lọc role/permission.
- Chuẩn hóa active state, focus, touch target và đóng menu khi route thay đổi.
- Bổ sung lớp responsive chung cho mọi `.staff-page`, bảng, ma trận, form, sticky bar và modal thuộc staff shell.
- Chuyển trang duyệt đổi đặt bàn sang class/SCSS responsive, không đổi query/mutation.
- Sửa contact list và chat thread cho mobile, không đổi giao tiếp backend.
- Giữ nguyên GraphQL contract, restaurant scope, permission và nghiệp vụ.

## Tiêu chí nghiệm thu

- Menu nhân viên mở/đóng được ở màn hình nhỏ, không che nội dung sai và active link hiển thị đúng.
- Không có overflow ngang toàn trang tại 390×844 và 430×932; bảng/ma trận dài chỉ cuộn trong vùng của chúng.
- Input/select/textarea trên mobile tối thiểu 16 px; nút chính và icon control tối thiểu 44 px khi phù hợp.
- Dashboard, schedule, attendance, leave, orders, kitchen, performance, profile, notifications, contacts, AI handoff, payslips, settings và reservation change review giữ cấu trúc đọc được trên điện thoại.
- Sticky action/footer không che nội dung và có safe-area bottom.
- Không thay đổi resolver, hook nghiệp vụ hoặc payload mutation.

## Ngoài phạm vi

- Không thiết kế lại nghiệp vụ, thêm dependency hoặc thay component library.
- Không đổi quyền truy cập, trạng thái đơn, lịch, công, nghỉ phép, lương hay AI handoff.
- Không thay đổi desktop ngoài các sửa lỗi class/style cần thiết để đồng bộ shell.
