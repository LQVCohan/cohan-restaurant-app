# COHAN - Checklist test AR/3D trên điện thoại

Tài liệu này dùng để test các luồng 3D/AR mở từ trang **Quản lý bàn**.

## 0. Chạy test tự động trước khi test tay

Chạy nhóm test riêng cho AR/3D bàn:

```bash
npm run test:table-ar
```

Hoặc tách riêng:

```bash
npm run test:table-ar:unit
npm run test:table-ar:e2e
```

Nhóm test này bao phủ:

- Utility tạo báo cáo test AR/mobile.
- Action bar 3D/AR: xem camera, xem AR native, đặt bàn bằng AR, áp dụng mẫu.
- Modal 3D: trạng thái HTTPS/WebXR, nút **Báo cáo test**, mở modal đặt bàn.
- Modal đặt bàn bằng AR: preflight, fallback khi thiếu WebXR, trạng thái chưa chọn bàn.
- Trang quản lý bàn: mở modal 3D/AR với đúng bàn và tầng được chọn.
- Catalog 3D: dùng catalog local sạch khi chưa cấu hình URL catalog online.
- Playwright mobile smoke: mở trang quản lý bàn, mở modal 3D, copy báo cáo test, kiểm tra fallback AR.

## 1. Chuẩn bị máy tính và điện thoại

- Máy tính và điện thoại dùng chung một mạng Wi-Fi nếu test bằng IP LAN.
- Tắt VPN nếu điện thoại không truy cập được IP máy tính.
- Tắt firewall hoặc cho phép Node/Vite qua firewall nếu Windows hỏi quyền.
- Dùng Chrome/Edge Android để test WebXR AR. iPhone thường chỉ phù hợp để xem 3D/Quick Look, không dùng luồng WebXR hit-test giống Android.
- Cập nhật **Google Play Services for AR (ARCore)** trước buổi demo.
- Camera/AR thật cần HTTPS hoặc secure context. Truy cập bằng `http://IP-LAN:5173` chỉ dùng tốt cho xem UI/3D; AR/camera có thể bị chặn.
- Nhà hàng demo phải có `address.lat` và `address.lng` hợp lệ, gần vị trí test thực tế.

## 2. Chạy web cho điện thoại

Chạy backend ở cổng `4000`, sau đó chạy frontend:

```bash
npm run dev:mobile
```

Terminal sẽ in ra URL dạng:

```txt
Phone: http://192.168.x.x:5173
```

Mở URL đó trên điện thoại để kiểm tra giao diện và model 3D qua mạng LAN.

Nếu cần test AR/camera thật, dùng HTTPS hoặc tunnel rồi mở URL HTTPS trên điện thoại. Khi đó kiểm tra trong modal 3D phải thấy trạng thái **Kết nối an toàn: Đã bảo mật**.

### Chạy qua ngrok để demo AR thật

1. Giữ backend chạy ở `http://127.0.0.1:4000`.
2. Giữ frontend chạy bằng `npm run dev:mobile`; script này ép API dùng `/graphql` cùng origin và proxy về backend local.
3. Mở terminal khác và chạy:

```bash
ngrok http 5173
```

4. Mở URL dạng `https://...ngrok-free.app` trên điện thoại.
5. Không lưu URL ngrok vào `.env` hay Git vì URL miễn phí có thể thay đổi sau mỗi lần chạy.
6. Cấp quyền camera và vị trí khi trình duyệt hỏi.
7. Nếu Vite báo host không được phép, kiểm tra domain ngrok thuộc `.ngrok-free.app` hoặc `.ngrok.app` và cấu hình `VITE_DEV_ALLOWED_HOSTS`.

Luồng khuyến nghị khi demo:

```txt
Điện thoại HTTPS
  → ngrok
  → Vite :5173
  → /graphql cùng origin
  → Vite proxy
  → Backend :4000
```

## 3. Luồng test nhanh UI trên điện thoại

Vào:

```txt
/manager#tables
```

Checklist:

- [ ] Trang Quản lý bàn mở được trên điện thoại.
- [ ] Header không vỡ layout.
- [ ] Card bàn vẫn đọc được.
- [ ] Mỗi card bàn có nút **3D / AR**.
- [ ] Bấm **3D / AR** trên bàn A1 mở modal với trạng thái **Bàn đang chọn: Đã chọn bàn**.
- [ ] Bấm **Chi tiết** mở modal cấu hình bàn.
- [ ] Modal không tràn ngang.
- [ ] Footer modal vẫn bấm được.
- [ ] Bấm **Mô phỏng 3D** ở header vẫn mở thư viện mẫu chung nhưng không chọn sẵn bàn.

> Khi cần lưu vị trí AR cho một bàn, luôn mở từ nút **3D / AR** trên card bàn. Nút **Mô phỏng 3D** ở header chỉ dành cho xem thử và áp dụng mẫu chung.

## 4. Test modal 3D

Trong modal **Xem thử và bố trí bàn 3D**:

- [ ] Danh sách mẫu bàn hiển thị.
- [ ] Không có cảnh báo “không tải được catalog online” khi chưa cấu hình catalog online.
- [ ] Chọn được một mẫu có nhãn 3D/AR.
- [ ] Model 3D tải thành công.
- [ ] Có thể xoay model bằng tay.
- [ ] Nút xoay/trái/phải/phóng to/thu nhỏ hoạt động.
- [ ] Nút **Báo cáo test** copy được báo cáo.
- [ ] Nếu model lỗi, thông báo lỗi dễ hiểu và có nút **Thử lại**.

Ghi lại:

```txt
Model test:
Trạng thái hiển thị:
Có lỗi không:
```

## 5. Test camera preview

Bấm:

```txt
Xem thử 2D bằng camera
```

Checklist:

- [ ] Trình duyệt hỏi quyền camera.
- [ ] Cho phép camera.
- [ ] Camera preview hiển thị.
- [ ] Nếu không chạy, UI có thông báo lỗi rõ.

Ghi lại:

```txt
Thiết bị:
Trình duyệt:
Camera hoạt động: Có/Không
Lỗi nếu có:
```

## 6. Test AR native chỉ xem mẫu

Bấm:

```txt
Xem AR trên thiết bị
```

Checklist:

- [ ] Nếu URL chưa phải HTTPS, nút bị khóa hoặc báo cần HTTPS.
- [ ] Nếu thiết bị hỗ trợ, mở được AR viewer.
- [ ] Model xuất hiện trong môi trường thật.
- [ ] Thoát AR quay lại web ổn định.

Ghi lại:

```txt
Mở AR native: Có/Không
Model xuất hiện: Có/Không
Lỗi nếu có:
```

## 7. Test đặt bàn vào sơ đồ bằng AR

Mở từ nút **3D / AR** trên một card bàn cụ thể, sau đó bấm:

```txt
Đặt bàn vào sơ đồ bằng AR
```

Checklist preflight:

- [ ] Secure context OK.
- [ ] navigator.xr OK.
- [ ] immersive-ar OK.
- [ ] WebGL XR OK.
- [ ] Model URL OK.
- [ ] Tọa độ nhà hàng hiển thị hợp lệ.
- [ ] Điện thoại đang nằm trong bán kính geofence của nhà hàng demo.

Checklist thao tác:

- [ ] Bấm **Bắt đầu AR thật**.
- [ ] Camera AR mở fullscreen.
- [ ] Di chuyển điện thoại chậm để quét mặt sàn.
- [ ] Có điểm hit-test mới nhất.
- [ ] Bấm **Ghim vị trí bàn**.
- [ ] Scale + / Scale - hoạt động.
- [ ] Xoay trái / Xoay phải hoạt động.
- [ ] Kết thúc AR không làm treo web.
- [ ] Nhập/điền đủ 2 mốc sơ đồ và 2 mốc AR.
- [ ] Có Table.position.
- [ ] Bấm **Chọn vị trí này** lưu được.
- [ ] Quay lại sơ đồ tầng thấy bàn đổi vị trí đúng.
- [ ] Tải lại trang vẫn giữ vị trí và metadata AR đã lưu.

Ghi lại:

```txt
Hit-test hoạt động: Có/Không
Ghim vị trí: Có/Không
Lưu Table.position: Có/Không
Vị trí sau khi lưu đúng: Có/Không
Lỗi nếu có:
```

## 8. Khi lỗi, copy báo cáo test

Trong modal 3D bấm:

```txt
Báo cáo test
```

Sau đó dán nội dung vào đây hoặc gửi cho người sửa code.

Báo cáo cần có:

- `secureContext`
- `browser.userAgent`
- `browser.mediaDevices`
- `browser.webxr`
- `capabilities.webxr`
- `selectedModel`
- `modelUrl`
- `arStatusLabel`
- `modelError`

## 9. Kết luận test

| Hạng mục | Kết quả | Ghi chú |
|---|---|---|
| UI mobile trang bàn |  |  |
| Nút 3D / AR theo từng bàn |  |  |
| Modal cấu hình bàn |  |  |
| Modal 3D |  |  |
| Camera preview |  |  |
| AR native |  |  |
| AR placement WebXR |  |  |
| Lưu vị trí về sơ đồ |  |  |
| Tải lại vẫn giữ vị trí |  |  |

## 10. Tiêu chí đạt để demo

Đạt demo nếu:

- Mở được modal từ đúng card bàn và hệ thống nhận đúng bàn/tầng.
- Xem 3D mượt, không phát sinh request catalog rỗng.
- Có báo cáo test khi lỗi.
- Camera preview hoặc AR native chạy được trên ít nhất một điện thoại.
- Android hỗ trợ WebXR có thể quét sàn, ghim và lưu vị trí bàn.
- Nếu WebXR không hỗ trợ, modal giải thích rõ và cho fallback manual.
- Lưu vị trí bàn không làm lỗi dữ liệu và vẫn còn sau khi tải lại trang.
