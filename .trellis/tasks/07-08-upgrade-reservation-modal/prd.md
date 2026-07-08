# Upgrade customer Reservation modal

## Current behavior

The customer booking page loads public restaurant and floor/table data, then opens `BookingModal` after the customer selects a table. The modal independently calls the scoped management query `restaurant(id)`, so a customer/public route can receive 403/null and remain at `Đang tải...` even though the booking page itself works.

The modal also calls `eventPackagesByRestaurant` and `createTableEvent`, both of which require restaurant-management access. Those controls therefore expose a manager-only workflow in a customer modal. Its internal table picker/VR list can additionally change `pickedTable` without passing through `TableBooking.handleSelectTable`, bypassing the existing table view-lock acquisition/release flow.

Party size can be increased to 20 even when the selected table has a lower capacity. The server correctly rejects the final mutation, but the modal allows the customer to continue to the summary first. The unlimited-time checkbox passes the React change event object instead of `event.target.checked`.

The current single-column 600px modal places key time controls below a long table block, requires excessive scrolling, and separates the primary action from the information being reviewed.

## Root cause

- Customer UI calls private restaurant and event-management operations instead of customer-safe public contracts.
- Table selection responsibility is split between the floor-map container and the modal, while only the container owns the view-lock mutation.
- Client validation does not mirror the server capacity boundary.
- The checkbox handler uses the event object as state.
- The visual structure is a long single column instead of a compact reservation review layout.

## End-to-end flow

1. `Reservation` stores restaurant, table, customer contact, time, duration, party size, deposit, and status.
2. `CreateReservationInput` carries the booking data to `ReservationMutation.createReservation`.
3. The resolver checks restaurant capability, customer identity, table ownership, capacity, loyalty permission, opening hours, view lock, time conflict, deposit state, table status, and audit logging.
4. `useBookingTable` sends `createReservation` and returns the created reservation.
5. `TableBooking` loads public restaurant/floor/table data, acquires the selected table view lock, and opens `BookingModal`.
6. `BookingModal` reads only `publicRestaurant` and `publicTables`, validates and previews the locked table, then submits the unchanged reservation mutation.
7. The parent keeps the existing cart-addon, payment, and success-modal handling.

## Scope

- Replace the protected restaurant query with `publicRestaurant` and use `publicTables` only to refresh the already-selected table details.
- Remove manager-only event-package/table-event controls from the customer reservation modal rather than weakening their server authorization.
- Keep table selection in `TableBooking`; the modal previews the selected table/VR but cannot switch tables directly.
- Clamp and validate party size against table capacity before summary and submit.
- Store the unlimited-time checkbox boolean correctly and keep the loyalty guard.
- Redesign the modal with a wider two-column desktop layout, compact hierarchy, accessible dialog semantics, explicit loading/error states, responsive stacking, and a stable footer.
- Preserve `createReservation`, cart-addon, payment, conflict, permission, audit, view-lock, and realtime server behavior.

## Files changed

- `src/components/Customer/BookingTableModal/BookingModal.jsx`: customer-safe public queries, one selected-table path, capacity/time/contact validation, correct checkbox state, accessible dialog structure, and streamlined confirmation.
- `src/components/Customer/BookingTableModal/BookingModal.scss`: responsive two-column visual upgrade, stable body/footer layout, focus/pressed/disabled states, and 390/430px stacking rules.
- `src/components/Customer/BookingTableModal/BookingModal.test.jsx`: regression coverage for public restaurant/table rendering, capacity limit, and unlimited-time submission.

## Acceptance criteria

- Opening the modal does not issue protected `restaurant(id)`, `eventPackagesByRestaurant`, or `createTableEvent` operations.
- Restaurant name, address, opening hours, reservation deposit policy, and selected-table details come from customer-safe public queries.
- The displayed and submitted table is the table whose view lock was acquired by the parent; the modal cannot silently switch it.
- Party size cannot exceed table capacity and invalid external values are rejected before mutation.
- Unlimited-time state is a boolean; the control is disabled for ineligible customers and the server guard remains unchanged.
- At desktop widths the modal presents the form and table summary side by side; at 430px and 390px it stacks without horizontal overflow and the footer does not cover body content.
- Close and primary actions have accessible names, visible focus states, and pressed/disabled feedback.
- No reservation schema, resolver, permission, payment, deposit, conflict, or view-lock business rule is weakened.

## Out of scope

- Publishing event packages to customers or changing table-event authorization.
- Changing reservation schema, conflict rules, deposits, payment providers, loyalty tiers, or table view-lock server behavior.
- Rewriting QR payment or success modals.
- Adding a new component library or dependency.

## Validation plan

- `vitest run src/components/Customer/BookingTableModal/BookingModal.test.jsx`
- `npm run check:graphql`
- `npm run check:conflicts`
- `npm run build`
- Browser verification at desktop, 430x932, and 390x844 when a runnable environment is available.
