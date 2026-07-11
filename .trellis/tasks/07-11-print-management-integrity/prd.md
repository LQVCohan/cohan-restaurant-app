# Print management integrity

## Current behavior and root cause

- `PrintManagement` kept a local restaurant selection sourced from `AuthContext.restaurants` instead of the canonical manager brand/restaurant scope, so the page could query or save another branch than the one selected in the manager header.
- The print-setting resolver authorized by hard-coded `admin`/`manager` roles. It did not distinguish scoped reads, configuration writes, and operational POS enqueue actions.
- `enqueuePrintJob`, `retryPrintJob`, `updatePrintJobStatus`, and `testPrint` rebuilt and `$set` the whole mixed `jobs` array. Concurrent writes could overwrite newer jobs, and normalization dropped order-ticket fields not represented in the management view.
- Retry was not restricted to failed jobs, manual enqueue could target an unknown printer, and job statuses were not validated.
- `PosContext` could send its initial empty printer/station state before the settings query hydrated. For a manager with write access this could erase an existing configuration.
- Station configuration stores arrays of printer IDs, but confirmed-order kitchen/bar routing and temporary-bill cashier routing used only the first ID.
- The simulated test treated any non-empty IP as a real online handshake and labeled the printer ready even though no hardware connection occurred.

## End-to-end flow

1. `models/printSetting.model.js` stores printers, station mappings, templates, and print jobs.
2. `printSetting.graphql` exposes settings, queue actions, retry, status update, and test operations.
3. `graphql/resolvers/printSetting/index.js` normalizes, authorizes, saves configuration, and mutates the queue.
4. `confirmedOrderPrintMutation.js` creates station tickets after a pending order is confirmed and kitchen/bar snapshots exist.
5. `temporaryBillPrintMutation.js`, composed through `accessGuard.js`, creates cashier temporary-bill jobs for confirmed orders.
6. `PosContext.jsx` and `RightPanel.jsx` read settings and enqueue operational POS jobs.
7. `PrintManagement.jsx` edits printers, routes, templates, tests, and failed jobs.
8. `ManagerLayout.jsx` and `Sidebar.jsx` expose the page by permission.

## Implemented behavior

- The manager page follows `useManagerRestaurantSelection`, so header and page use the same canonical restaurant.
- Manager route/sidebar access requires `print.read`; page edits require `print.write` and read-only controls remain usable for viewing and refresh.
- POS reads and enqueue actions accept existing operational permissions (`order.update` or `payment.write`) without granting configuration-write access.
- Configuration/test/retry/status mutations remain restricted to `print.write`.
- Reads no longer create a settings document, and an early partial empty POS autosave cannot erase a hydrated printer configuration.
- Queue append uses `$push/$position/$slice`; retry and status changes use positional updates on one job and preserve ticket details.
- Unknown printers, disabled templates, invalid statuses, and retrying non-failed jobs are rejected.
- Confirmed kitchen/bar tickets and cashier temporary bills create one job per unique valid assigned printer.
- Explicitly offline printers create failed jobs that remain visible for retry.
- Simulated checks store `configured`, keep `hardwareHandshake: false`, and the UI describes them as configuration validation rather than a live connection.

## Acceptance criteria

- The page always follows the canonical manager restaurant selection.
- Read-only users can inspect and refresh but cannot edit, test, enqueue, delete, or retry from the management page.
- Operational POS users can read configured printers and enqueue print jobs through their existing scoped order/payment permission.
- Queue mutations update only the intended job or append atomically; concurrent jobs and order-ticket fields are not rewritten.
- Manual enqueue rejects unknown printers and disabled/unknown templates.
- Retry is accepted only for a failed job, and status updates accept only supported states.
- Confirming an order creates one job for every valid printer assigned to its kitchen/bar station.
- Printing a temporary bill creates one job for every valid printer assigned to the cashier station.
- Simulated configuration checks never claim a hardware connection.
- Focused backend and frontend regression tests cover permissions, hydration protection, atomic queue behavior, multi-printer routing, canonical scope, and read-only controls.

## Constraints

- Reuse the existing `PrintSetting` document and GraphQL contract.
- Add no dependency, print daemon, hardware protocol, or new persistence collection.
- Preserve order confirmation, inventory, kitchen work-item, audit/event behavior, and the existing 300-job retention intent.

## Validation record

Automated Vitest, GraphQL validation, frontend build, and real printer/LAN tests were not run because the GitHub connector does not provide a repository runtime or printer hardware.

## Out of scope

- Implementing a real LAN print agent, WebUSB/WebSerial connector, printer discovery, or hardware heartbeat.
- Redesigning the entire page or changing receipt/template syntax.
- Adding historical exports, pagination, or a new queue collection.
