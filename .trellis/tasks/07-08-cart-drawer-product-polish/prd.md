# Polish customer cart drawer for production

## Current behavior and root cause

The customer cart drawer leaks a raw restaurant ObjectId because it groups cart lines by `restaurantId`, then performs a separate `restaurant(id)` query. That query is scoped to restaurant staff/admin access, so a customer receives `null` and the component falls back to `Nhà hàng <ObjectId>`.

The cart data contract already exposes `CartItem.restaurant`. `CartProvider` simply does not request the restaurant name in `myCart`. Fetching the name with the authoritative cart removes the restricted query and the raw-ID fallback.

The current drawer also compresses product information and controls into a narrow two-column row. It omits the dish image, repeats price information without clear labels, exposes internal serving keys such as `portion`, and uses mixed Vietnamese/English wording.

## End-to-end flow

`CartItemSchema.restaurantId -> CartItemFieldResolvers.restaurant -> MY_CART in CartProvider -> mapServerCartItem -> Cart grouping -> RestaurantGroup/product actions -> checkout navigation`.

## Requirements

- Fetch and preserve the restaurant display name with the authoritative server cart.
- Never display a restaurant ObjectId to customers.
- Keep existing cart grouping, quantity, removal, hold countdown, booking add-on and checkout behavior unchanged.
- Show a compact dish thumbnail with a safe fallback.
- Translate technical serving keys such as `portion` into customer-facing Vietnamese.
- Use plain production wording: `Tạm tính`, `Tiếp tục thanh toán`, `Hoàn tất chọn món`, and direct hold messages.
- Keep keyboard focus, disabled states, screen-reader labels and reduced-motion behavior.
- Keep the existing React/Apollo/SCSS stack and cream-orange customer visual language.

## Acceptance criteria

1. Authenticated customers see the restaurant name from `myCart`; no raw ObjectId appears.
2. Each line clearly presents image, name, unit price, serving choice, hold countdown, quantity, line total and remove action.
3. `portion` displays as `Phần tiêu chuẩn`.
4. The drawer remains usable at 390x844 and 430x932 without controls colliding or covering content.
5. Checkout, booking add-on, quantity updates and removal callbacks are unchanged.
6. Focused tests, GraphQL validation and build pass, or unavailable checks are reported.

## Out of scope

- Changing cart, inventory or checkout business rules.
- Changing the five-minute hold duration.
- Adding dependencies, animations libraries or a new cart state abstraction.
