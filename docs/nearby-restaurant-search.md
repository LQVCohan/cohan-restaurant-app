# Nearby Restaurant Search

## Frontend flow
- Homepage lấy vị trí hiện tại của user và truyền vào `nearbyCenter`.
- `RestaurantGrid` gọi GraphQL query `restaurantsNearby(lat, lng, radiusKm, limit, restaurantFilter)`.
- Ở nearby mode, frontend **không gửi `search` trong filter** để tránh lọc theo chuỗi địa chỉ giao hàng.
- Frontend hiển thị:
  - `🚗 X km • khoảng Y phút` hoặc `🚗 Cách bạn X km đường đi` khi có road distance.
  - `🧭 Cách bạn khoảng X km` khi fallback straight-line.

## Backend flow
- `restaurantsNearby` validate `lat/lng/radiusKm/limit`.
- Dùng `$geoNear` + `2dsphere` làm bước prefilter nhanh để lấy candidate gần theo đường chim bay.
- Candidate limit lớn hơn final limit để đủ dữ liệu cho bước road distance (`candidateLimit = min(max(limit * 4, 20), 50)`).
- Resolver gọi distance provider để tính khoảng cách theo đường chạy cho từng candidate.
- Resolver chỉ chấp nhận road distance hợp lệ: `0 km` chỉ hợp lệ khi origin và destination gần như trùng nhau (`straightLineDistanceKm < 0.05`). Nếu provider trả `0 km` hoặc giá trị nhỏ bất thường trong khi đường chim bay đã xa, resolver fallback về straight-line.
- Sort kết quả ưu tiên item có road distance, sau đó theo `distanceKm` tăng dần.

## Distance fields trả về
- `straightLineDistanceKm`: khoảng cách địa lý theo tọa độ (chim bay).
- `roadDistanceKm`: khoảng cách theo đường xe chạy.
- `estimatedTravelMinutes`: thời gian di chuyển ước tính.
- `distanceKm`: field tương thích ngược; ưu tiên bằng `roadDistanceKm` hợp lệ, fallback `straightLineDistanceKm`.
- `distanceSource`:
  - `road`
  - `straight_line_fallback`

## Provider strategy
Dùng biến môi trường:
- `ROAD_DISTANCE_PROVIDER=mock|osrm|google|mapbox` (default: `mock`)
- `OSRM_BASE_URL` (default: `https://router.project-osrm.org`)
- `GOOGLE_MAPS_API_KEY`
- `MAPBOX_ACCESS_TOKEN`

### Hành vi provider
- `mock`: luôn trả kết quả bằng straight-line * hệ số (1.25 hoặc 1.35) để dev/build không crash.
- `osrm`: gọi `/route/v1/driving/{originLng},{originLat};{destLng},{destLat}?overview=false`, đọc `distance` (m) và `duration` (s). Nếu OSRM trả `distance = 0` nhưng Haversine giữa origin/destination lớn hơn `0.05 km`, service trả `roadDistanceKm = null`, `estimatedTravelMinutes = null`, `status = "error:zero_distance_invalid"`.
- `google` / `mapbox`: skeleton an toàn; thiếu key hoặc chưa implement sẽ trả trạng thái lỗi theo destination, không làm crash resolver.

## Backward compatibility & fallback
- Model vẫn giữ `address.lat` / `address.lng` và index cũ để tương thích dữ liệu legacy.
- Khi create/update restaurant có `address.lat/lng` hợp lệ, model hook sẽ tự sync `location`.
- Nếu `$geoNear` lỗi (chưa có index/môi trường chưa migrate), resolver fallback Haversine trên `address.lat/lng`.
- Fallback vẫn trả `straightLineDistanceKm`, `distanceKm`, `distanceSource="straight_line_fallback"` để UI hiển thị "khoảng".
- Khi road provider trả kết quả bất thường, final response dùng `roadDistanceKm = null`, `estimatedTravelMinutes = null`, `distanceKm = straightLineDistanceKm`, `distanceSource = "straight_line_fallback"`; UI sẽ hiển thị `🧭 Cách bạn khoảng X km` thay vì `🚗 0 m`.

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
- Không gọi road provider cho toàn bộ database; chỉ tính trên candidate đã prefilter.
- Public OSRM phù hợp dev/demo, không nên dùng lưu lượng production lớn.
