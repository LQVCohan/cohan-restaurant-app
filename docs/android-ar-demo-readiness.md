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

Luồng render AR thật chỉ tải model `.glb` hoặc `.gltf`. Thiếu `modelUrl` hoặc model không phải GLB/GLTF chỉ ảnh hưởng phần render model trong WebXR; người dùng vẫn có thể dùng hit-test/manual calibration để lấy và lưu tọa độ nếu các điều kiện lưu khác hợp lệ.

### Đang ngoài geofence

Mặc định không thể lưu vị trí AR nếu location hiện tại nằm ngoài bán kính geofence nhà hàng. Trong local/demo có thể bật `VITE_AR_DEMO_ALLOW_SAVE_OUTSIDE_GEOFENCE=true` cùng DEV mode để override an toàn.

### Transform invalid vì 2 mốc quá gần

Hai điểm AR cần cách nhau tối thiểu khoảng 0.1m và hai điểm trên sơ đồ cần cách nhau tối thiểu 1 đơn vị sơ đồ. Chọn hai mốc xa nhau, dễ nhận diện, và tương ứng đúng giữa thực tế và sơ đồ.

## Ghi chú task

Không chạy test/build/lint trong task này theo yêu cầu.

## Cách đọc preflight checklist

- **OK**: điều kiện đã sẵn sàng cho luồng demo tương ứng.
- **Cảnh báo**: luồng AR hoặc manual vẫn có thể tiếp tục, nhưng có giới hạn cần biết trước khi demo. Ví dụ: thiếu `modelUrl` hoặc model không phải GLB/GLTF thì WebXR vẫn có thể lấy hit-test point, nhưng không render được model bàn.
- **Lỗi**: cần xử lý trước khi dùng phần liên quan. Các lỗi WebXR/canvas như thiếu secure context, thiếu `navigator.xr`, không hỗ trợ `immersive-ar`, thiếu `XRWebGLLayer`, hoặc không tạo được WebGL context sẽ chặn nút bắt đầu AR thật. Các lỗi geofence/location ảnh hưởng khả năng lưu vị trí, không có nghĩa là manual input bị xóa.

## Khi nào dùng AR native, khi nào dùng AR thật để lưu vị trí

- **AR native để xem mẫu**: dùng khi chỉ muốn xem model bàn trong không gian thật bằng trình xem hệ thống/model-viewer. Luồng này giúp đánh giá kích thước và hình dáng mẫu, nhưng không lưu tọa độ vào sơ đồ.
- **AR thật để lưu vị trí**: dùng khi cần lấy hit-test point WebXR, hiệu chỉnh với 2 mốc sơ đồ tầng và lưu `Table.position` nếu geofence + transform hợp lệ.
- **Manual calibration**: dùng khi thiết bị không hỗ trợ WebXR hoặc khi cần nhập mốc thủ công. Manual vẫn cần dữ liệu geofence/override hợp lệ để lưu theo logic frontend hiện tại.

## Lưu ý cho demo Android qua mạng thật

Nếu đang demo bằng điện thoại Android, nên dùng HTTPS tunnel hoặc deploy staging để đảm bảo Chrome chạy trong secure context. HTTP LAN thông thường có thể làm WebXR không khả dụng.

Nếu bật `VITE_AR_DEMO_ALLOW_SAVE_OUTSIDE_GEOFENCE=true`, app vẫn phải chạy trong DEV mode vì production không có hiệu lực với demo override này.

## Nâng cấp sau

Muốn lưu chính xác nhiều bàn theo từng tầng, bước nâng cấp sau nên lưu `arCalibration` theo floor nếu backend floor model/update API có field phù hợp. Task này không sửa backend/schema/database và không tự thêm field mới.
