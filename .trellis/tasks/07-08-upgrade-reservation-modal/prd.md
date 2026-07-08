# Upgrade customer Reservation modal

## Current behavior

The customer booking page already loads a public restaurant and public floor/table data, then opens `BookingModal` after the customer selects a table. The modal performs another `restaurant(id)` query, which is the scoped management query. On a customer/public route this query can return 403/null, leaving the modal header at `Đang tải...` even though the parent page already knows the restaurant.

The modal also contains an internal table picker/VR list that changes `pickedTable` without going through `TableBooking.handleSelectTable`. That bypasses the existing table view-lock acquisition/release flow and can leave the lock on one table while creating a reservation for another.

Party size can be increased to 20 even when the selected table has a lower capacity. The server correctly rejects the final mutation, but the modal allows the customer to continue to the summary first. The unlimited-time checkbox passes the React change event object instead of `event.target.checked`.

The current single-column 600px modal puts key time controls below a long table block, requires excessive scrolling, and leaves the primary action detached from the information the customer is reviewing.

## Root cause

- The modal duplicates data fetching and uses the private `restaurant` field instead of the already-loaded public restaurant contract.
- Table selection responsibility is split between the floor-map container and the modal, while only the container owns the view-lock mutation.
- Client validation does not mirror the server capacity boundary.
- The checkbox handler uses the event object as state.
- The visual structure is a long single column rather than a compact reservation review layout.

## End-to-end flow

1. `Reservation` stores restaurant, table, customer contact, time, duration, party size, deposit, and status.
2. `CreateReservationInput` carries the booking data to `ReservationMutation.createReservation`.
3. The resolver checks restaurant capability, customer identity, table ownership, capacity, loyalty permission, opening hours, view lock, time conflict, deposit state, table status, and audit logging.
4. `useBookingTable` sends `createReservation` and returns the created reservation.
5. `TableBooking` loads `publicRestaurant`, `publicFloors`, and `publicTables`, acquires the selected table view lock, and opens `BookingModal`.
6. `BookingModal` validates and previews the booking, submits the existing mutation, then the parent opens payment/success handling.

## Scope

- Reuse the public restaurant and selected table already loaded by `TableBooking`; remove the duplicate protected restaurant query from the modal.
- Keep table selection in `TableBooking`; the modal may preview the selected table/VR but must not switch tables directly.
- Clamp and validate party size against the selected table capacity before summary and submit.
- Store the unlimited-time checkbox boolean correctly and keep the loyalty guard.
- Keep optional package/event side effects from causing a second reservation when the reservation itself was already created.
- Redesign the modal with a wider two-column desktop layout, compact hierarchy, accessible dialog semantics, clear loading/empty/error states, responsive stacking, and a stable footer.
- Preserve the existing `createReservation`, payment, event-package, cart-addon, permission, conflict, audit, and realtime server contracts.

## Files to change

- `src/components/Customer/TableBooking/TableBooking.jsx`: extend the public restaurant query and pass the loaded restaurant plus selected table into the modal.
- `src/components/Customer/BookingTableModal/BookingModal.jsx`: remove duplicate/private data queries and unsafe table switching; fix validation, checkbox state, semantics, and post-create handling.
- `src/components/Customer/BookingTableModal/BookingModal.scss`: responsive two-column visual upgrade and interaction states.
- `src/components/Customer/BookingTableModal/BookingModal.test.jsx`: regression coverage for public data rendering, capacity limit, and unlimited-time checkbox behavior.

## Acceptance criteria

- Opening the modal on the public booking route does not issue the protected `restaurant(id)` query and does not show a 403-driven `Đang tải...` state.
- The restaurant name/address/opening hours come from the public restaurant data already loaded by the parent.
- The selected table displayed and submitted is the table whose view lock was acquired by the parent; the modal cannot silently switch it.
- Party size cannot exceed table capacity and an inline validation message appears for invalid external/prefilled values.
- Unlimited-time state is a boolean and non-eligible customers cannot continue with it enabled.
- Once `createReservation` succeeds, a failure creating an optional package order/event shows a warning but does not invite the user to submit the reservation again.
- At desktop widths the modal presents customer/time controls and the booking summary side by side; at 430px and 390px it stacks without horizontal overflow and fixed controls do not cover body content.
- Close and primary actions have accessible names, visible focus states, and pressed/disabled feedback.

## Out of scope

- Changing reservation schema, conflict rules, deposits, payment providers, loyalty tiers, or table view-lock server behavior.
- Rewriting QR payment or success modals.
- Adding a new component library or dependency.

## Validation plan

- `vitest run src/components/Customer/BookingTableModal/BookingModal.test.jsx`
- `npm run check:graphql`
- `npm run check:conflicts`
- `npm run build`
- Browser verification at desktop, 430x932, and 390x844 when a runnable environment is available.
