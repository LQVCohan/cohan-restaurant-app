# Customer menu responsive refresh

## Current behavior

The /cus-menu landing page loads up to 100 restaurants but offers no local search. The selected restaurant menu has search, sort, grid/list, meal and category controls, but the sort selector is unstyled, several controls are below the 44px touch target, iconography mixes Unicode and emoji, and phone cards produce a long vertical scroll.

A logic regression also exists: RestaurantMenu now passes the current meal as initialTimeSlot for normal ordering, while MenuDetailView treats every initialTimeSlot as a booking lock. Switching meals in normal ordering can therefore show the booking-only mismatch warning and disable ordering.

## Direction

Warm editorial food marketplace using the existing cream and amber system. Search is the primary control, current context and result count are visible, filters can be reset in one action, and phone cards become compact horizontal rows.

## Scope

- Add client-side restaurant discovery search without changing publicRestaurants.
- Separate initial displayed meal from booking-locked meal.
- Replace menu-control Unicode icons with installed Lucide icons.
- Style sort/search-clear/view controls and keep touch targets at least 44px.
- Add result context and one-action filter reset.
- Show real low-stock quantities only when maxAvailable is a positive number at or below five.
- Keep closed or out-of-stock dishes browseable while ordering remains disabled.
- Compact menu cards at 390x844 and 430x932 without horizontal page overflow.

## Constraints

- Preserve GraphQL schema, resolver filtering, restaurant scope, menu availability, inventory source of truth, cart hold and checkout behavior.
- Preserve serviceAt through booking add-on and food-detail navigation.
- Do not add dependencies or duplicate menu data flows.
- Do not report a restaurant closed when only the selected meal mismatches a booking.

## Acceptance criteria

1. Normal remote ordering can switch meals without a booking mismatch warning.
2. Booking add-on still blocks ordering from a meal different from the reservation meal.
3. Restaurant search filters name, cuisine and address and can be cleared.
4. Search, sort, view and meal controls have visible focus and mobile touch targets.
5. Active meal, category, visible result count and filters are understandable without inspecting the URL.
6. Empty search/filter state offers a reset action.
7. Phone cards remain readable and compact; floating cart remains above mobile navigation.
8. No backend, GraphQL or cart-hold contract changes.
