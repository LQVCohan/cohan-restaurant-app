# Implementation plan

## Backend

- Extend `utils/publicTableSession.js` with device normalization/hash, request/session JWTs, HMAC confirmation code and shared session validation.
- Extend `publicTableSession.graphql` with access request/confirm operations, staff request query, optional session credentials on public session query and required session credentials on protected actions.
- Update `publicTableSessionQuery.js` to hide orders and customer requests without a confirmed token and expose staff request codes only behind `order.read`.
- Update `publicTableOrderMutation.js` to create/confirm access requests and require confirmed session access for OTP and order submission.
- Update `publicTablePaymentMutation.js` to require confirmed session access for staff calls and payment requests.

## Frontend

- Add a small shared session-storage utility for device ID, token scope and change event.
- Add the verification gate/modal before identity and menu in `TableOrderExperience`.
- Pass session credentials into table page query/actions and react to access-token changes.
- Add staff request cards to the existing POS QR queue; hide code until explicit in-person confirmation action.

## Tests

- Security utility: request/session token scope, device mismatch, deterministic code.
- Resolver: request creation/reuse, confirmation, missing token rejection, active-session mismatch.
- Customer UI: cannot open menu before verification; stores token after correct code.
- POS UI: request label visible, code hidden until staff action.

## Validation commands

```bash
npx vitest run cohan-restaurant-backend/tests/services/publicTableSession.security.test.js
npx vitest run cohan-restaurant-backend/tests/resolvers/public-table-order-transaction.test.js
npx vitest run src/components/Customer/TableCurrentSession/TableOrderExperience.test.jsx
npx vitest run src/components/Dashboard_Manager/POS/components/pos/PosIncomingTableOrderQueue.test.jsx
npm run check:graphql:operations
npm run check:conflicts
npm run build
```
