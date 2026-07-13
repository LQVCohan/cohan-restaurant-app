# PRD

## Current behavior

The supplied report contains 55 screenshots covering manager, staff, customer and POS flows. The failures are a mix of presentation defects, technical error leakage, route/history drift, incomplete business rules and GraphQL contract failures. Several screens already contain partial fixes from earlier tasks, so the new work must verify current `main` rather than reapply old patches.

## Root-cause themes

1. Shared overlays and feedback are inconsistent: some paths still use cramped dialogs, local stacking contexts, browser alerts or raw GraphQL messages instead of the existing portal/toast patterns.
2. URL state and account-workspace state are not consistently authoritative, which breaks browser back navigation, deep links and role switching.
3. Some UI labels and cards display raw identifiers, technical terminology or derived placeholders instead of resolved server data.
4. Reservation/table state conflates a future reservation with an occupied or currently reserved table, and customer QR sessions do not expose the required staff-call/order handoff early enough.
5. Forms expose fields that are operationally optional as required, or collect free text that is not enforced by runtime rules.
6. Dense operational screens and modals have inconsistent information hierarchy, responsive containment and accessible interaction states.

## End-to-end areas to trace

- Order/KDS: `Order and order-item models -> order resolvers/status transitions -> useOrderManagement -> order detail/history/item dialogs -> tests`.
- Menu/inventory: `Menu/MenuItem/stock models -> menu and receiveStock resolvers -> Apollo hooks -> menu catalog and quick-stock modal -> tests`.
- Tables/reservations: `Table/Reservation/public table session models -> table/reservation/session services -> GraphQL/Apollo -> manager table/POS/customer booking/session screens -> tests`.
- Staff/payroll: `User/Employee/Leave/Shift/PayrollSetting -> staff/payroll resolvers -> hooks -> staff detail, leave, schedule and settings screens -> tests`.
- Customer/promotion/reviews: `Customer/Promotion/Review -> resolvers/services -> analytics and management hooks -> manager/customer UI -> tests`.

## Scope and acceptance criteria

### A. Manager order, menu and stock (report images 1-7)

- Order detail and item detail use correct Vietnamese titles, concise customer-facing wording and compact status controls.
- A kitchen user can cancel a problematic item immediately through the authorized status transition and must supply a human-readable reason.
- Order history/detail and new-order surfaces use space efficiently and table search works.
- The manager menu screen exposes both the named-menu catalog and actual management entry points without mixing sibling menus.
- Quick stock accepts any subset of rows with valid quantities instead of requiring every displayed row.

### B. Table and restaurant management (images 8-13)

- Linked customer details appear only in overview/customer tabs; other tabs do not repeat the panel.
- Table detail and table/type/space dialogs use compact responsive layouts.
- Table creation from the design map preserves the intended generated table names and reports conflicts clearly.
- Restaurant profile avoids visible blank remount flashes, places geolocation beside a smaller map and reports save failures through the shared toast with user-facing copy.

### C. Staff, leave, schedule, payroll and navigation (images 14-24)

- Staff detail is split into focused tabs and action/attendance panels are compact.
- Leave creation is compact, accepts valid local dates and never exposes GraphQL scalar errors.
- Schedule cards correctly distinguish part-time and full-time staff.
- Logging out of a staff account and then logging into a manager account cannot restore the staff workspace; the staff fallback provides Home and manager-workspace actions when allowed.
- Broken staff/customer detail layouts are corrected.
- Payroll settings show the currently saved value beside each editable input.
- Collapsed sidebar scrolls; expanding it keeps the active item visible.
- Recent customer history navigates to the selected order detail.

### D. Customer management and analytics (images 25-27)

- Add-customer actions remain visible on hover/focus and password is optional through the existing email invitation/temporary-login flow.
- Manager navigation uses real URL state so browser back and in-app back return to the previous view.
- High-value analytics deep-links to the already filtered high-value cohort rather than a generic list.
- Suggested actions target the exact data being described; decorative labels with no behavior are removed.

### E. Promotions and reviews (images 28-38)

- Promotion modal is portalled, scrollable, fully masks the viewport and does not stick under the header.
- Promotion copy is Vietnamese, priority is explained, date display follows Vietnamese locale, and displayed conditions are derived from enforceable settings.
- Promotion creation returns a non-null result or a stable, user-facing error rather than leaking GraphQL non-null failures.
- Customer review cards use actual dish/restaurant data; alerts become shared toasts.
- Review submission and review management layouts are compact and consistent with the customer visual system.
- AI handoff appears only after a materially slow answer or on completed answers, and availability copy replaces `FCFS` with plain Vietnamese.

### F. Customer discovery, booking, table session and POS (images 39-55)

- Multi-restaurant choices scroll horizontally; customer menu header and dish table/cards are compact.
- Menu cards support one-click quick add, while unresolved preparation/serving choices remain visibly pending in cart.
- Reservation history resolves table names, shows QR check-in, warns/flags overlapping second bookings in the same restaurant/session, treats zero deposit as free and compacts invoice/change dialogs.
- A future reservation does not lock the table now; the reserved/waiting state starts at the reservation time with a 15-minute arrival countdown and customer details then become visible.
- Manager table grids filter by floor and table; single-table cards do not break.
- Public QR users can call staff and start ordering before a staff-created session; the first accepted item opens/continues the table service flow.
- Only service staff and POS receive table-call notifications; payment/QR requests are promoted to the POS top action area.
- Item configuration displays preparation and serving mode, auto-selects single choices and uses compact cart cards.

## Constraints

- One PR from current `main`.
- Preserve restaurant scoping, permissions, audit logging, realtime side effects and payment safety.
- Reuse existing portals, notification/toast provider, routing utilities, design tokens and installed packages.
- Do not merge unrelated open PRs or depend on their branches.
- Do not add dependencies or replace the application design system.

## Out of scope

- New payment providers, new promotion formulas, speculative AI behavior or broad framework migration.
- Redesigning untouched pages solely for visual consistency.
- Database cleanup that is not required to preserve the corrected runtime contracts.
