# Implementation plan

1. Preserve all Apollo hooks, mutations, variables, and inventory calculations.
2. Restructure the tab into overview, count, stock, and operations sections.
3. Add explicit labels and stable columns for responsive tables and movement history.
4. Replace the status select with accessible filter buttons while preserving the same `stockFilter` values.
5. Rebuild the scoped SCSS and remove the old visual rules instead of layering another override.
6. Review the final diff for desktop/mobile states, duplicate styling, and contract drift.
