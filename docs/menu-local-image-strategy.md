# Menu Local Image Storage Strategy

## Mục tiêu

Phần Menu cần hiển thị ảnh nhanh, tiết kiệm bộ nhớ và vẫn dùng được trong demo/offline. Vì vậy ảnh được xử lý theo hướng local-first:

1. Người dùng chọn file ảnh từ máy.
2. Frontend resize ảnh bằng canvas.
3. Frontend nén ảnh sang WebP nếu trình duyệt hỗ trợ, fallback JPEG nếu không hỗ trợ.
4. Frontend lưu 2 phiên bản vào IndexedDB:
   - `thumbBlob`: dùng cho card/list, tối đa khoảng 320px.
   - `previewBlob`: dùng cho modal/preview, tối đa khoảng 960px.
5. Form chỉ lưu chuỗi tham chiếu dạng `local-image://<id>`.

## Vì sao không lưu ảnh gốc?

Ảnh điện thoại thường có kích thước vài MB. Nếu lưu ảnh gốc cho hàng trăm món, IndexedDB sẽ phình rất nhanh.

Ví dụ:

```txt
100 món × 3MB = khoảng 300MB
```

Sau khi resize/nén:

```txt
100 món × 100-250KB = khoảng 10-25MB
```

## Các file chính

```txt
src/utils/localImageStore.js
src/hooks/useLocalImageUrl.js
src/components/common/LocalImageView.jsx
src/components/common/LocalImagePicker.jsx
```

## Quy tắc hiện tại

- Không lưu ảnh gốc vào IndexedDB.
- Không lưu base64 để tránh tăng dung lượng khoảng 33%.
- Không lưu object URL vì `blob:` URL chỉ sống trong phiên trình duyệt hiện tại.
- Dùng `local-image://<id>` làm tham chiếu ổn định.
- Khi render ảnh, `useLocalImageUrl` tạo `blob:` URL tạm và tự `URL.revokeObjectURL()` khi unmount.
- Store tự cleanup theo số lượng ảnh, tổng dung lượng và tuổi ảnh cũ.

## Giới hạn cần hiểu rõ

`local-image://<id>` chỉ tồn tại trên trình duyệt/máy đã lưu ảnh đó.

Điều này phù hợp cho:

- demo đồ án;
- local-first workflow;
- thao tác nhanh khi chưa có upload backend/CDN hoàn chỉnh.

Điều này chưa phù hợp cho production nhiều thiết bị vì máy khác sẽ không có blob trong IndexedDB.

## Roadmap production

Khi cần production, nên thêm bước sync:

```txt
local-image://id
→ upload thumb/preview/original đã tối ưu lên backend hoặc CDN
→ nhận URL thật
→ cập nhật Menu/MenuItem từ local-image://id sang https://...
→ đánh dấu ảnh local đã sync hoặc xóa sau một thời gian
```

Gợi ý API sau này:

```graphql
mutation SyncLocalMenuImage($input: SyncLocalImageInput!) {
  syncLocalMenuImage(input: $input) {
    localId
    url
    thumbUrl
    previewUrl
  }
}
```

## Kết luận

IndexedDB ở đây là tầng cache/local-first, không phải storage production cuối cùng. Cách lưu tối ưu là resize + compress trước, lưu Blob đã nén, hiển thị bằng object URL tạm thời.
