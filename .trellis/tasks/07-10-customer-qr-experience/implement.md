# Implementation plan

1. Keep the existing backend QR contract and public table-session GraphQL flow unchanged.
2. Add a pure parser for signed table URLs, including ObjectId and token validation, with focused tests.
3. Add a lazy scanner page using `getUserMedia` and native `BarcodeDetector`; clean up tracks and animation frames on stop/unmount.
4. Add the public route and customer navigation entry points.
5. Suppress unrelated floating utilities only on `/scan-table` and `/table/*`.
6. Add an invalid-link recovery link and restyle the table-session presentation without touching data logic.
7. Run targeted tests, GraphQL operation validation, conflict check and build; inspect the diff for contract drift.
