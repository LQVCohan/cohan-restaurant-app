# Seed combo, modifier và đồng bộ món tặng theo buổi

Các script chính:

- `scripts/seedMenuCombosAligned.js`: seed combo, bắt buộc toàn bộ món trong một combo thuộc cùng `menuId`/buổi phục vụ.
- `scripts/seedMenuCombosAndModifiers.js --only=modifiers`: seed các nhóm modifier.
- `scripts/repairBogoGiftMenuSlots.js`: kiểm tra và sửa promotion mua-tặng có món mua và món tặng lệch menu.

Các script dùng `MenuItem.code` để tìm món trong đúng nhà hàng, không phụ thuộc `_id` cố định. Mặc định chỉ validate; chỉ ghi dữ liệu khi có cờ `--apply`.

## Dữ liệu được tạo

- 13 combo được chia đúng theo menu sáng, trưa, tối và đêm.
- 11 nhóm modifier: kích cỡ đồ uống, mức đường, lượng đá, mức cay, topping phở/bún bò, topping cháo, rau thơm/hành, mức chín bò, món ăn kèm lẩu, topping cơm phần và khẩu phần gà nướng.
- Toàn bộ 36 `MenuItem.code` trong file nguồn được dùng ít nhất một lần trong combo hoặc modifier.
- Giá combo được tính từ giá món hiện tại trong DB, áp dụng tỷ lệ giảm và làm tròn đến 1.000đ.
- Combo, modifier group và modifier option dùng ID ổn định; chạy lại sẽ upsert thay vì tạo bản ghi trùng.
- Hai combo seed cũ bị lệch buổi được xóa khi chạy apply.
- Promotion `PHOTANGTRA` được chuyển sang món uống nằm cùng menu với món phở. Với dữ liệu hiện tại, phở buổi sáng sẽ tặng `Trà tắc`, thay vì trỏ tới `Trà đào cam sả` thuộc menu đêm.

## Chuẩn bị biến môi trường

Script ưu tiên `MONGODB_URI`, sau đó `MONGO_URI`. Có thể đặt thêm `MONGO_DB`.

```env
MONGO_URI=mongodb://127.0.0.1:27017/RestaurantDB
MONGO_DB=RestaurantDB
```

Nhà hàng mặc định lấy từ file menu đã cung cấp:

```text
6a5559eec3e3d7a76c59c0da
```

Có thể đổi bằng `SEED_RESTAURANT_ID` hoặc `--restaurantId=<id>`.

## Cách chạy toàn bộ

Từ thư mục gốc dự án:

```bash
cd cohan-restaurant-backend
npm install
```

Kiểm tra combo, modifier và promotion mua-tặng, không ghi DB:

```bash
npm run seed:combo-modifier:validate
```

Ghi toàn bộ dữ liệu và sửa promotion lệch buổi:

```bash
npm run seed:combo-modifier:apply
```

## Chỉ sửa lỗi món tặng đang có

Lệnh này phù hợp khi combo và modifier đã seed, nhưng POS đang báo không tìm thấy món tặng trong menu hiện tại:

```bash
npm run repair:promotion-gift-slots:validate
npm run repair:promotion-gift-slots:apply
```

Sau khi chạy apply, tải lại trang POS. Khuyến mãi gọi phở ở menu sáng sẽ đề xuất món uống cũng thuộc menu sáng.

## Chạy riêng từng phần

Chỉ chạy combo:

```bash
npm run seed:combos:validate
npm run seed:combos:apply
```

Chỉ chạy modifier:

```bash
npm run seed:modifiers:validate
npm run seed:modifiers:apply
```

Chạy cho nhà hàng khác:

```bash
node scripts/seedMenuCombosAligned.js --validate-only --restaurantId=YOUR_RESTAURANT_ID
node scripts/seedMenuCombosAligned.js --apply --restaurantId=YOUR_RESTAURANT_ID
node scripts/repairBogoGiftMenuSlots.js --validate-only --restaurantId=YOUR_RESTAURANT_ID
node scripts/repairBogoGiftMenuSlots.js --apply --restaurantId=YOUR_RESTAURANT_ID
```

## Cơ chế an toàn

- Dừng ngay nếu `restaurantId` không hợp lệ hoặc nhà hàng không tồn tại.
- Dừng nếu thiếu bất kỳ `MenuItem.code` cần dùng.
- Dừng nếu có code món bị trùng trong cùng nhà hàng.
- Dừng nếu một combo chứa món thuộc nhiều `menuId` khác nhau.
- Cảnh báo nếu món tồn tại nhưng không ở trạng thái `available`.
- Promotion mua-tặng chỉ được đổi sang món thay thế thuộc cùng menu với món mua.
- Không ghi DB nếu không có `--apply`.
