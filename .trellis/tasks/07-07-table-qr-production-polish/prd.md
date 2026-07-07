# Polish table QR management for production

## Current behavior

The manager table-QR page uses the shared compact header with three full statistic cards. A second full-width flow card then repeats contextual information as four pills, a public base URL, and a bulk action. At the reported desktop width, these two surfaces consume a large amount of above-the-fold space before the first table QR card.

The copy also mixes Vietnamese with implementation-facing terms such as “order”, “public”, “link”, and “copy”. Status and action labels are understandable but not consistently phrased for a production-facing management screen.

## End-to-end flow reviewed

1. `Table` stores the access token, public URL, QR data URL, generated time, and expiry time.
2. `floor_table.graphql` exposes `tableQrAccessList`, `generateTableAccessQr`, and `revokeTableAccessQr`.
3. `tableAccessQr.js` validates IDs and base URLs, enforces restaurant permissions, signs the table token, generates QR data, persists timestamps, and writes audit events.
4. `TableQrManagementPage` queries the table list, calls generate/revoke mutations, derives ready/expired/missing states, and exposes open/copy/print actions.
5. `ManagerLayout` mounts the page at `manager#table-qr` for users with `table.read` access.

The data contract, authorization, expiry calculation, audit logging, and mutation behavior are correct. The root cause is page composition and page-scoped styling, so no backend or GraphQL change is required.

## Scope

- Remove the large header statistic cards from this page and replace them with a compact inline summary.
- Keep total, active, expired, and missing QR counts visible without a second card grid.
- Collapse the usage guide into a native disclosure so it is available without permanently occupying space.
- Rewrite mixed or implementation-facing copy into clear Vietnamese management wording.
- Improve card action hierarchy, focus states, touch targets, long-URL handling, loading/empty/error status semantics, and narrow-screen layout.
- Reuse the existing manager palette, React component, SCSS stack, and GraphQL operations.

## Acceptance criteria

- The first row of table QR cards appears materially higher on the reported desktop viewport.
- Total tables, active QR codes, expired QR codes, and tables needing a QR remain visible at a glance.
- The usage guide is available on demand and does not occupy a permanent multi-pill row.
- Page title, description, statuses, notifications, metadata, and action labels use consistent user-facing Vietnamese.
- Generate, regenerate, open, copy, print, refresh, bulk generation, and revoke actions continue to work unchanged.
- QR images have explicit dimensions and useful alternative text.
- Error/loading/empty states and copied feedback remain understandable to assistive technology.
- Buttons have visible hover, active, and keyboard focus states; reduced-motion users do not receive unnecessary transitions.
- At 1180px, 760px, 430px, 390x844, and 430x932, the page has no horizontal overflow and actions remain usable.
- No schema, resolver, permission, token, audit-log, restaurant-scope, or realtime behavior changes.

## Out of scope

- Changing QR token lifetime or signing rules.
- Adding bulk GraphQL mutations, pagination, search, filters, or new dependencies.
- Rebuilding `ManagementPageHeader` for every manager page.
- Changing the public table experience or print template layout beyond wording.

## Validation plan

- Run `npm run check:conflicts`.
- Run `npm run check:graphql` because the component contains inline GraphQL operations.
- Run the frontend production build with `npm run build`.
- Review the authenticated page at desktop and 390x844 / 430x932 when a browser environment is available.
