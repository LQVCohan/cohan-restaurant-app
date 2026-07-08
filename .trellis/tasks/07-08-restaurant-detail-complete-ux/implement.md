# Kế hoạch triển khai

## File sẽ sửa và lý do

- `RestaurantDetail.jsx`: mở rộng query công khai, bỏ ảnh bìa giả định, cải thiện quick facts và truyền dữ liệu đầy đủ xuống tab Thông tin.
- `RestaurantDetail.refinements.scss`: trạng thái hero không ảnh và bố cục quick facts mới.
- `RestaurantInfo.jsx`: bỏ query lặp, hiển thị giờ, dịch vụ, chính sách và dữ liệu customerInfo đã có.
- `RestaurantInfo.scss`: bố cục fact grid, giờ tuần, chính sách và FAQ responsive.
- `MenuSection.jsx`: tách quyền xem chi tiết món khỏi quyền đặt món; dùng placeholder trung tính.
- `PhotoGallery.jsx`: bỏ nút chết và triển khai chia sẻ ảnh bằng API trình duyệt/clipboard.
- `ReviewsSection.jsx`: bỏ hành động bình luận chưa có luồng xử lý.
- `RestaurantDetail.ux-contract.test.jsx`: khóa hợp đồng query và các hành vi UX cốt lõi.

## Trình tự

1. Fetch bản mới nhất của từng file trên branch.
2. Cập nhật query cha và dữ liệu hero.
3. Cập nhật `RestaurantInfo` và SCSS.
4. Cập nhật hành vi thực đơn, ảnh và đánh giá.
5. Thêm kiểm tra tự động tối thiểu.
6. Chạy kiểm tra hẹp, sau đó build nếu môi trường cho phép.
7. Review diff để tránh logic lặp, dữ liệu giả và contract drift.

## Validation

- `npm run check:conflicts`
- `npm run check:graphql`
- `npx vitest run src/components/Customer/RestaurantDetail/RestaurantDetail.ux-contract.test.jsx src/components/Customer/RestaurantDetail/RestaurantDetail.record-recent.test.jsx`
- `npm run build`
- smoke desktop, 390x844 và 430x932
