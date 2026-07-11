# Print management integrity

## Current behavior and root cause

- `PrintManagement` keeps a local restaurant selection sourced from `AuthContext.restaurants` instead of the canonical manager brand/restaurant scope, so the page can query or save another branch than the one selected in the manager header.
- The print-setting resolver authorizes by hard-coded `admin`/`manager` roles. It does not distinguish `print.read` from `print.write`, which conflicts with the repository permission model and the page route.
- `enqueuePrintJob`, `retryPrintJob`, `updatePrintJobStatus`, and `testPrint` rebuild and `$set` the whole mixed `jobs` array. Concurrent writes can overwrite newer jobs, and normalization drops order ticket fields not represented in the management view.
- Retry is not restricted to failed jobs, manual enqueue can target an unknown printer, and job statuses are not validated.
- Station configuration stores arrays of printer IDs, but confirmed-order routing only uses the first ID.
- The current simulated test treats any non-empty IP as a real online handshake and labels the printer ready even though `hardwareHandshake` is false.

## End-to-end flow

1. `models/printSetting.model.js` stores printers, station mappings, templates, and print jobs.
2. `printSetting.graphql` exposes settings, queue actions, retry, status update, and test operations.
3. `graphql/resolvers/printSetting/index.js` normalizes, authorizes, saves configuration, and mutates the queue.
4. `confirmedOrderPrintMutation.js` creates station tickets after a pending order is confirmed and kitchen/bar snapshots exist.
5. `PosContext.jsx` reads and updates printer/station configuration for POS.
6. `PrintManagement.jsx` edits printers, routes, templates, tests, and failed jobs.
7. `ManagerLayout.jsx` and `Sidebar.jsx` expose the page by permission.

## Acceptance criteria

- The page always follows the canonical manager restaurant selection.
- Reading requires `print.read`; configuration and queue mutations require `print.write` while preserving restaurant scope.
- A user with read-only permission can inspect and refresh but cannot edit, test, enqueue, delete, or retry.
- Queue mutations update only the intended job or append atomically; concurrent jobs and order-ticket fields are not rewritten.
- Manual enqueue rejects unknown printers and disabled/unknown templates.
- Retry is accepted only for a failed job, and status updates accept only supported states.
- Confirming an order creates one job for every valid printer assigned to its kitchen/bar station, not only the first.
- Simulated configuration checks never claim a hardware connection; the UI describes the result as configuration validation.
- Focused backend and frontend tests cover permissions, atomic queue behavior, multi-printer routing, canonical scope, and read-only controls.

## Constraints

- Reuse the existing `PrintSetting` document and GraphQL contract.
- Add no dependency, service layer, print daemon, hardware protocol, or new persistence collection.
- Preserve order confirmation, inventory, kitchen work-item, audit/event behavior, and the existing 200/300-job retention intent.

## Out of scope

- Implementing a real LAN print agent, WebUSB/WebSerial connector, printer discovery, or hardware heartbeat.
- Redesigning the entire page or changing receipt/template syntax.
- Adding historical exports, pagination, or a new queue collection.
