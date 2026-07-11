# Customer success experience

## Current behavior

The reservation flow opens `SuccessModal` after booking confirmation or deposit payment. The modal uses emoji labels and a long single-column list. It does not emphasize the reservation code, deposit amount, or linked menu order data already attached by `TableBooking`.

The remote checkout flow stores `checkoutCode`, `orderCodes`, `orders`, `totalPaid`, and `paymentMethod` in `receipt`, but its success state only shows the checkout code and total. Its footer also renders both `Đóng` and `Hoàn tất`, which perform the same action.

## End-to-end trace

### Reservation

1. `reservation.graphql` defines `Reservation` and `createReservation`.
2. `ReservationMutation.createReservation` validates restaurant/table availability, creates the reservation, computes the deposit, and returns the reservation document.
3. `useBookingTable` requests the confirmation fields.
4. `TableBooking` optionally creates a linked food order, enriches the reservation with `linkedCartItems`, `linkedMenuSubtotal`, `linkedMenuDeposit`, and `linkedOrders`, then opens `SuccessModal`.
5. `SuccessModal` renders the final customer confirmation.

### Order checkout

1. `orderOperations.graphql` exposes `createCheckoutOrders`.
2. The order resolver creates one or more orders and returns checkout metadata plus order DTOs.
3. `OrderSummaryCheckoutModal` stores `checkoutCode`, `orderCodes`, `orders`, `totalPaid`, and `paymentMethod` in `receipt`.
4. The success view renders the final customer confirmation.

## Visual direction

A calm warm-neutral confirmation surface with one clear green success signal, a prominent confirmation code, compact operational details, and a single primary completion action. Mobile first; no emoji or technical wording.

## Scope

- Redesign reservation success content and responsive layout.
- Show linked menu confirmation when the booking included food.
- Redesign checkout success content using receipt data already returned by the mutation.
- Remove duplicate success footer actions.
- Keep all booking, checkout, payment, navigation, and persistence behavior unchanged.

## Acceptance criteria

- Booking-only confirmation clearly shows restaurant, table, time, party size, contact, reservation code, and deposit when present.
- Booking with dishes clearly states that both the table and dishes were recorded, with item count/subtotal or linked order codes when available.
- Order confirmation clearly shows checkout/order codes, number of created orders, total, and payment method.
- Success layouts remain readable without horizontal overflow at 390x844 and 430x932.
- Success actions use one obvious primary completion action; no duplicate close/finish buttons.
- Icons use the installed Lucide set, not emoji.
- No GraphQL, resolver, payment, cart, or order creation contract changes.

## Validation

```bash
npx vitest run src/components/Customer/SuccessModal/SuccessModal.test.jsx src/components/Customer/BookingDishesModal/OrderSummaryCheckoutModal.test.jsx
npm run build
```
