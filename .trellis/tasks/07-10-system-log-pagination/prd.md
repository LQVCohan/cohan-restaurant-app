# Check log UI pagination

Scope: improve the manager check log screen so it is easier to read and has pagination.

Files:
- src/components/Dashboard_Manager/SystemLogs/SystemLogsPage.jsx
- src/components/Dashboard_Manager/SystemLogs/SystemLogsPage.scss

Acceptance:
- show page number and total pages
- support next, previous, first, last
- support page size selection
- reset to first page when filters change
- keep existing access rules and data contracts

Out of scope: backend schema changes, export features, unrelated audit coverage.
