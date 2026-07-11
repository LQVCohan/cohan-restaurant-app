# Implementation plan

1. Add focused regression tests for permission separation, queue mutation behavior, multi-printer station routing, canonical restaurant scope, and read-only UI.
2. Add print permission constants and align backend/frontend manager fallbacks plus seeded manager permissions.
3. Harden the print-setting resolver with scoped read/write guards, input validation, atomic queue appends/updates, and honest simulated test state.
4. Expand confirmed-order routing to all valid assigned printers without changing order acceptance semantics.
5. Update the management page to consume canonical restaurant scope and disable all write actions without `print.write`.
6. Align manager route/sidebar access with `print.read`, refetch every changed file, inspect diffs, and record checks that could not run.
