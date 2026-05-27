# Nearby Restaurant Search

## Frontend flow
- Homepage lấy vị trí hiện tại của user và truyền vào `nearbyCenter`.
- `RestaurantGrid` gọi GraphQL query `restaurantsNearby(lat, lng, radiusKm, limit, restaurantFilter)`.
- Ở nearby mode, frontend **không gửi `search` trong filter** để tránh lọc theo chuỗi địa chỉ giao hàng.

## Backend flow
- `restaurantsNearby` validate `lat/lng/radiusKm/limit`.
- Ưu tiên dùng MongoDB geospatial query với `location` GeoJSON Point (`[lng, lat]`) qua `$geoNear` + `2dsphere` index.
- Kết quả được trả về có `distanceKm` để frontend render dạng `m`/`km`.

## Backward compatibility
- Model vẫn giữ `address.lat` / `address.lng` và index cũ để tương thích dữ liệu legacy.
- Khi create/update restaurant có `address.lat/lng` hợp lệ, model hook sẽ tự sync `location`.
- Nếu `$geoNear` lỗi (chưa có index/môi trường chưa migrate) **hoặc trả rỗng**, resolver fallback về Haversine trên `address.lat/lng`.

## Backfill dữ liệu cũ
Chạy trong môi trường dev/safe DB:

```bash
npm --prefix cohan-restaurant-backend run backfill:restaurant-location
```

Script sẽ:
- cập nhật `location` cho bản ghi có `address.lat/lng` hợp lệ,
- unset `location` nếu tọa độ không hợp lệ,
- log `updatedLocation`, `unsetLocation`, `skipped`.

## Lưu ý vận hành
Nearby chỉ hiển thị chính xác khi nhà hàng có tọa độ hợp lệ (`location` hoặc tối thiểu `address.lat/lng` cho fallback).
