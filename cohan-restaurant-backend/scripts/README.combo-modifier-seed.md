# Seed combo và modifier từ danh sách món

Script: `scripts/seedMenuCombosAndModifiers.js`

Script dùng `MenuItem.code` để tìm món trong đúng nhà hàng, không phụ thuộc `_id` của từng món. Mặc định script chỉ validate; chỉ ghi dữ liệu khi có cờ `--apply`.

## Dữ liệu được tạo

- 9 combo theo bữa sáng, cơm trưa, cơm gia đình, lẩu, hải sản và món thanh nhẹ.
- 11 nhóm modifier: kích cỡ đồ uống, mức đường, lượng đá, mức cay, topping phở/bún bò, topping cháo, rau thơm/hành, mức chín bò, món ăn kèm lẩu, topping cơm phần và khẩu phần gà nướng.
- Giá combo được tính từ giá món hiện tại trong DB rồi áp dụng tỷ lệ giảm và làm tròn đến 1.000đ.
- Combo, modifier group và modifier option dùng ID ổn định; chạy lại sẽ upsert thay vì tạo bản ghi trùng.

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

## Cách chạy

Từ thư mục gốc dự án:

```bash
cd cohan-restaurant-backend
npm install
```

Kiểm tra toàn bộ, không ghi DB:

```bash
npm run seed:combo-modifier:validate
```

Ghi toàn bộ combo và modifier:

```bash
npm run seed:combo-modifier:apply
```

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
node scripts/seedMenuCombosAndModifiers.js --validate-only --restaurantId=YOUR_RESTAURANT_ID
node scripts/seedMenuCombosAndModifiers.js --apply --restaurantId=YOUR_RESTAURANT_ID
```

## Cơ chế an toàn

- Dừng ngay nếu `restaurantId` không hợp lệ hoặc nhà hàng không tồn tại.
- Dừng nếu thiếu bất kỳ `MenuItem.code` cần dùng.
- Dừng nếu có code món bị trùng trong cùng nhà hàng.
- Cảnh báo nếu món tồn tại nhưng không ở trạng thái `available`.
- Không ghi DB nếu không có `--apply`.
