# Customer QR table experience

## Current behavior and root cause

- Managers already have `TableQrManagementPage` to generate, print, open, copy and revoke a signed QR link for each table.
- The generated link already opens `TableCurrentSessionPage` at `/table/:restaurantId/:tableId?token=...` so customers can see active orders, call staff and request payment.
- Customer navigation has no in-app QR scanner. Customers can only use the phone camera or manually open a link outside the app.
- The table session screen is functional but visually disconnected from the warm COHAN customer shell, and its invalid-link state offers no recovery path.
- Global floating utilities can compete with the scanner and live table controls on small screens.

## End-to-end flow

`Table.tableAccessToken/tableAccessUrl/tableQrCodeDataUrl` -> `generateTableAccessQr` -> printed QR URL -> customer scanner/parser -> internal `/table/:restaurantId/:tableId?token=...` route -> `publicActiveTableSessionOrders` plus public staff/payment mutations -> live table session UI.

## Scope

1. Add a public in-app scanner at `/scan-table` using the browser camera and native `BarcodeDetector` when available.
2. Provide a manual-link fallback when the browser cannot scan QR codes.
3. Parse only signed COHAN table URLs and rebuild an internal route instead of following arbitrary QR destinations.
4. Expose the scanner in desktop and mobile customer navigation without expanding the mobile bottom bar.
5. Improve mobile route titles, focus states and table-session recovery.
6. Polish the live table page with the existing warm ivory, orange and deep green COHAN customer direction.
7. Hide the global chatbot and meal utility from focused QR/table flows so controls are not covered.

## Acceptance criteria

- `/scan-table` works without authentication.
- A valid QR URL opens the matching internal table route with its token.
- Missing token, invalid IDs, unrelated QR content and non-table paths remain on the scanner with actionable feedback.
- Camera permission is requested only after the customer presses the camera button.
- Unsupported browsers receive a manual-link fallback rather than a broken camera view.
- Scanner controls are keyboard accessible, have visible focus and respect reduced motion.
- Mobile 390x844 and 430x932 layouts have no horizontal overflow or controls hidden under the bottom navigation.
- Existing GraphQL, token signing, permissions, table-session polling and mutations remain unchanged.
- No new dependency is added.

## Out of scope

- Changing QR token lifetime, backend authorization, table schema or QR generation.
- Decoding arbitrary third-party QR destinations.
- Rewriting every customer feature page or introducing a new design system.

## Files and purpose

- `src/utils/tableQrAccess.js` and test: validate QR payloads and build safe internal table paths.
- `src/components/Customer/TableQrScanner/*`: scanner UI, camera lifecycle and fallback.
- `src/routes/AppRouter.jsx`: lazy public scanner route.
- `src/components/Customer/Homepage_Client/components/Header.jsx`: desktop scanner navigation.
- `src/components/Customer/MobileCustomerShell/*`: mobile scanner shortcut and complete route titles.
- `src/layouts/MainLayout.jsx`, `src/App.jsx`: focused QR-flow shell behavior.
- `src/components/Customer/TableCurrentSession/*`: visual polish and invalid-link recovery.

## Validation plan

- `npx vitest run src/utils/tableQrAccess.test.js src/components/Customer/TableQrScanner/TableQrScannerPage.test.jsx`
- `npm run check:conflicts`
- `npm run check:graphql:operations`
- `npm run build`
- Browser smoke at desktop, 390x844 and 430x932 when a runtime is available.
