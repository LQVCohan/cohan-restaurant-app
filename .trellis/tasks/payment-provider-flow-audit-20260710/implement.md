# Implementation plan

1. Update provider signing and date generation in `providers.js`.
2. Tighten VNPAY success mapping in `paymentSession.service.js` and expose a non-settling return verification helper if needed.
3. Add protocol-correct VNPAY GET IPN handling and a user-facing ReturnURL response in `createServer.js`; preserve MoMo POST behavior.
4. Remove the environment selector from the restaurant payment tab while retaining `mode` in query/save state.
5. Update focused backend and frontend tests.
6. Run the narrow provider/service/component tests, then syntax/GraphQL checks if available.

## Smallest relevant validation commands

```bash
cd cohan-restaurant-backend && npm test -- tests/services/payment-providers.security.test.js
npm test -- src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.test.jsx
npm run check:graphql
```

If local execution is unavailable, record that clearly and rely on source-level review plus GitHub CI after opening the PR.
