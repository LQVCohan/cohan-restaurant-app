# Implementation plan

## Backend

- Add `publicTableOrderAccess.service.js` for device hashing, request/session JWTs, HMAC confirmation codes, active-session validation and staff request listing.
- Extend `publicTableSession.graphql` with access request/confirm operations and the staff-only request query.
- Register query/mutation wrappers after the existing public table resolvers so static QR access can only return a restricted table summary until verification succeeds.
- Guard order submission and identity OTP with an orderable verified table session.
- Guard staff call and payment request with a verified active table session.
- Store verified session token and device id in table-scoped HttpOnly cookies using the existing Fastify cookie plugin and Apollo credentialed requests.

## Frontend

- Keep only the opaque browser device id in `sessionStorage`; never persist the signed session token in JavaScript storage.
- Mount `TableOrderAccessGate` before the optional customer-identity modal and menu launcher.
- Auto-open the gate when the active table session requires verification, while retaining a visible launcher if the customer closes it.
- Add staff verification cards to the existing POS QR queue and keep the six-digit code hidden until “Đã tới đúng bàn – hiện mã”.

## Tests

- Security service: deterministic six-digit code, device binding and JWT purpose/scope.
- Cookie transport: table-specific cookie names, HttpOnly settings and per-table credential injection.
- Resolver boundary: unverified static QR strips orders; verified access restores data; submit validates before calling the original resolver.
- Customer UI: request label and six-digit code are required before the access-confirm mutation succeeds.
- POS UI: request label visible, code hidden until explicit staff action.

## Validation commands

```bash
npx vitest run cohan-restaurant-backend/tests/services/publicTableOrderAccess.service.test.js
npx vitest run cohan-restaurant-backend/tests/resolvers/table-order-session-cookies.test.js
npx vitest run cohan-restaurant-backend/tests/resolvers/public-table-order-access.test.js
npx vitest run cohan-restaurant-backend/tests/resolvers/public-table-order-transaction.test.js
npx vitest run src/components/Customer/TableCurrentSession/TableOrderAccessGate.test.jsx
npx vitest run src/components/Customer/TableCurrentSession/TableOrderExperience.test.jsx
npx vitest run src/components/Dashboard_Manager/POS/components/pos/PosIncomingTableOrderQueue.test.jsx
npm run check:graphql:operations
npm run check:conflicts
npm run build
```
