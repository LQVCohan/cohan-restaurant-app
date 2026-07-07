# Customer checkout restaurant id payload fix

## Current behavior
Customer add-to-cart stores `restaurantId` in local/server cart lines, but the shared checkout mapper omits `restaurantId` from `CheckoutCartItemInput`. `createCheckoutOrders` rejects any checkout item without a valid restaurant id before payment sessions can be created.

## Root cause
Frontend checkout payload contract drift: `CheckoutCartItemInput.restaurantId` is required by the GraphQL schema and resolver, but `mapCartItemToOrderItemInput` does not include it.

## Flow traced
Mongoose/cart hold -> cart resolver `addCartItem` -> `myCart`/CartProvider mapping -> CartPage checkout -> CheckoutPage -> OrderSummaryTransferModalUpload -> `mapCartItemToOrderItemInput` -> `createCheckoutOrders` -> transfer payment creation.

## Change
Add `restaurantId` to the shared checkout item mapper and cover it with the existing unit test.

## Acceptance criteria
- Checkout mapper includes `restaurantId` in `CreateCheckoutOrders` payloads.
- Existing sanitization behavior for non-checkout discount preview stays unchanged.
- Targeted unit test passes.
