# Customer success experience

## Current behavior

The reservation flow opens `SuccessModal` after booking confirmation or deposit payment. The modal used emoji labels and a long single-column list. It did not emphasize the reservation code, deposit amount, or linked menu order data already attached by `TableBooking`.

The remote checkout flow stores a receipt and renders a minimal success state with the checkout code and total. Its footer also rendered both `Đóng` and `Hoàn tất`, which performed the same action.

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
3. `OrderSummaryCheckoutModal` stores the checkout code, orders, total, and payment method in `receipt`.
4. The existing success view renders the checkout code and total.

## Visual direction

A calm warm-neutral confirmation surface with one clear green success signal, a prominent confirmation code, compact operational details, and a single primary completion action. Mobile first; no emoji or technical wording.

## Scope

- Redesign reservation success content and responsive layout.
- Show linked menu confirmation when the booking included food.
- Restyle the existing checkout success markup into the same visual language.
- Remove the duplicate checkout success footer action without changing checkout logic.
- Keep all booking, checkout, payment, navigation, and persistence behavior unchanged.

## Acceptance criteria

- Booking-only confirmation clearly shows restaurant, table, time, party size, contact, reservation code, and deposit when present.
- Booking with dishes clearly states that both the table and dishes were recorded, with item count/subtotal or linked order codes when available.
- Checkout confirmation makes the existing checkout code and total easy to scan.
- Success layouts remain readable without horizontal overflow at 390x844 and 430x932.
- Success actions use one obvious primary completion action; no duplicate close/finish buttons.
- Booking confirmation icons use the installed Lucide set, not emoji.
- No GraphQL, resolver, payment, cart, or order creation contract changes.

## Out of scope

- Expanding the checkout success component contract to render every child order code or payment detail.
- Adding tracking/navigation actions that are not already available in the current flow.

## Validation

```bash
npx vitest run src/components/Customer/SuccessModal/SuccessModal.test.jsx
npm run build
```
