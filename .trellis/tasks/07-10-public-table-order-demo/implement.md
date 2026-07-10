# Implementation plan

1. Extend the public table GraphQL schema with table readiness, proof fields, sandbox identity operations, and pending table-order submission.
2. Extend `utils/publicTableSession.js` with short-lived challenge/candidate/identity signing, demo OTP validation helpers, table-order capability mapping, and public proof mapping.
3. Add `publicTableOrderMutation.js` to own the public trust boundary and QR-specific pending-order transaction.
4. Register the resolver in the existing order resolver merge without weakening staff order guards.
5. Update `publicTableSessionQuery.js` to return current table status/capability.
6. Update `confirmIncomingOrder` so acceptance is atomic and creates kitchen work items before printing.
7. Add `TableOrderExperience` and embed it in the public table page; keep existing view/call/payment behavior.
8. Add focused backend/frontend tests and update task validation state with commands actually run.
9. Review the final diff for public user-id trust, production demo OTP leakage, restaurant/table scope, duplicate kitchen work, and GraphQL contract drift.
