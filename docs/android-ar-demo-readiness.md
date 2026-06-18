# Android AR demo readiness

## Mục tiêu demo AR trên Android

Tài liệu này mô tả cách chuẩn bị và vận hành demo đặt vị trí bàn bằng AR trên điện thoại Android trong phạm vi frontend hiện có. Mục tiêu là giúp luồng demo rõ ràng hơn: kiểm tra thiết bị trước khi mở AR thật, ghim vị trí bàn, hiệu chỉnh 2 mốc giữa không gian AR và sơ đồ tầng, rồi lưu vị trí nếu dữ liệu hợp lệ.

Đây là luồng demo hỗ trợ WebXR hit-test và manual calibration; không phải cam kết AR production chính xác 100% trong mọi thiết bị/môi trường.

## Điều kiện thiết bị

- Dùng Android Chrome phiên bản mới.
- Thiết bị cần hỗ trợ ARCore/WebXR.
- Cho phép quyền camera và location khi trình duyệt yêu cầu.
- Chạy site qua HTTPS hoặc localhost để có secure context cho WebXR.
- Model bàn nên có `modelUrl` dạng `.glb` hoặc `.gltf`.
- Nhà hàng cần có lat/lng hợp lệ để geofence xác minh khu vực lưu vị trí.

## Env demo

```env
VITE_AR_DEBUG=true
VITE_AR_DEMO_ALLOW_SAVE_OUTSIDE_GEOFENCE=true
```

- `VITE_AR_DEBUG=true`: bật debug panel trong modal đặt vị trí AR.
- `VITE_AR_DEMO_ALLOW_SAVE_OUTSIDE_GEOFENCE=true`: chỉ dùng local/demo. Cờ này chỉ có hiệu lực khi app đang chạy DEV và cho phép lưu khi chưa xác minh đúng geofence để phục vụ demo.
- Không bật demo override trong production.

## Quy trình demo

1. Mở màn hình manager table.
2. Chọn bàn cần đặt vị trí.
3. Mở mô phỏng 3D.
4. Chọn model GLB/GLTF.
5. Mở đặt vị trí bằng AR.
6. Kiểm tra preflight và xử lý các mục lỗi nếu có.
7. Bắt đầu AR thật bằng WebXR nếu thiết bị hỗ trợ.
8. Quét mặt sàn bằng cách di chuyển điện thoại chậm.
9. Ghim vị trí bàn khi model nằm đúng vị trí mong muốn.
10. Nhập/chọn mốc calibration: 2 mốc trên sơ đồ tầng và 2 điểm AR tương ứng.
11. Kiểm tra kết quả `Table.position`, geofence, transform rồi lưu vị trí.

## Các lỗi thường gặp

### Không HTTPS

WebXR yêu cầu secure context. Hãy chạy bằng HTTPS hoặc localhost.

### WebXR không hỗ trợ

Một số thiết bị/trình duyệt không có `navigator.xr`, không hỗ trợ `immersive-ar`, hoặc thiếu `XRWebGLLayer`. Khi đó dùng manual calibration fallback.

### Không có quyền camera/location

Nếu từ chối quyền camera/location, AR hoặc geofence có thể không hoạt động. Hãy bật lại quyền trong cài đặt site của Chrome.

### `modelUrl` không phải GLB/GLTF

Luồng render AR thật chỉ tải model `.glb` hoặc `.gltf`. Hãy chọn mẫu khác hoặc cập nhật catalog model.

### Đang ngoài geofence

Mặc định không thể lưu vị trí AR nếu location hiện tại nằm ngoài bán kính geofence nhà hàng. Trong local/demo có thể bật `VITE_AR_DEMO_ALLOW_SAVE_OUTSIDE_GEOFENCE=true` cùng DEV mode để override an toàn.

### Transform invalid vì 2 mốc quá gần

Hai điểm AR cần cách nhau tối thiểu khoảng 0.1m và hai điểm trên sơ đồ cần cách nhau tối thiểu 1 đơn vị sơ đồ. Chọn hai mốc xa nhau, dễ nhận diện, và tương ứng đúng giữa thực tế và sơ đồ.

## Ghi chú task

Không chạy test/build/lint trong task này theo yêu cầu.
