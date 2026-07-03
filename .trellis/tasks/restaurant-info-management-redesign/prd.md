# PRD — Nâng cấp trang hồ sơ nhà hàng

## Hiện trạng

- Header compact không có số liệu nên để trống phần lớn chiều ngang.
- Ba KPI lặp lại thành hàng card rời bên dưới.
- Avatar dùng định vị tuyệt đối và khoảng đệm 60 px, tạo vùng trắng lớn trước tab form.
- Nút đổi avatar là `div onClick`, chưa hỗ trợ bàn phím.
- Nút AI dùng template cục bộ dù backend đã có `rewriteRestaurantProfileDescription`.
- File `RestaurantInfoCopyTuning.js` vá text và AI bằng DOM/fetch ngoài Apollo, không có caller trong repo.
- Các `Col span` cố định có nguy cơ bó form ở màn hình hẹp.

## Luồng thật

`Restaurant model` → `restaurant.graphql` → `RestaurantQuery/RestaurantMutation` → scope và `restaurant.write` permission → Apollo query/mutation trong `RestaurantInfoManagement.jsx` → form, upload, lưu, đồng bộ category và live preview.

## Phạm vi

1. Làm header đầy đủ thông tin bằng chính số liệu hiện có.
2. Bỏ KPI trùng và giảm chiều cao đầu trang.
3. Cấu trúc lại vùng ảnh bìa/avatar bằng CSS, không đổi upload contract.
4. Gọi mutation AI chính thức bằng Apollo.
5. Sửa semantic, focus, responsive và copy tiếng Việt.
6. Xóa DOM patch không còn caller.

## Tiêu chí nghiệm thu

- Header không còn vùng trống lớn ở desktop.
- Không còn hàng ba KPI trùng bên dưới header.
- Ảnh bìa, avatar, tên và tab nối thành một khối gọn; không còn khoảng trắng 60 px.
- Nút avatar thao tác được bằng chuột và bàn phím, có accessible name.
- AI Rewrite gọi `rewriteRestaurantProfileDescription` và hiển thị loading/error hợp lý.
- Form dùng được ở 390×844 và 430×932, không tràn ngang.
- Live preview và quyền/scoping/lưu dữ liệu giữ nguyên.

## Ngoài phạm vi

- Không đổi Restaurant schema hoặc resolver authorization.
- Không thêm package, font hay hệ thống thiết kế mới.
- Không thay đổi contract upload ảnh, category index hoặc preview route.
