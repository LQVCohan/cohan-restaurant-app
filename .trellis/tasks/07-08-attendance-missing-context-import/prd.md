# Attendance module load failure

## Current behavior

Opening the manager attendance page causes Vite to request `src/context/AttendanceScopeContext` and return HTTP 404. The lazy-loaded manager component then throws `Failed to fetch dynamically imported module`, so the page falls into `AppErrorBoundary`.

## Root cause

`useAttendanceManagement.js` imports `@/context/AttendanceScopeContext` without an extension. The tracked context module was stored as `.jsx`, while the failing local checkout had no resolvable module at that path. Because the hook is imported by the lazy attendance page, this missing module prevents the entire manager screen from loading before any GraphQL request runs.

## Traced flow

1. `AttendancePageScoped` applies the selected restaurant before `AttendancePage` mounts.
2. `AttendancePage` and `OvertimePanel` import `useAttendanceManagement`.
3. `useAttendanceManagement` imports `@/context/AttendanceScopeContext`.
4. Vite cannot resolve that module in the affected checkout and returns 404.
5. React rejects the lazy module and `AppErrorBoundary` shows the load-failure page.

Backend schema, attendance resolvers, restaurant guards, Apollo operations and user actions are not reached by this failure.

## Files

- `src/context/AttendanceScopeContext.js`: canonical context module using the repository's standard JavaScript extension.
- `src/context/AttendanceScopeContext.jsx`: removed to avoid two files exporting separate context instances.

## Acceptance criteria

- The extensionless attendance context import resolves to a tracked `.js` module.
- Attendance page lazy loading no longer fails because of `AttendanceScopeContext` 404.
- The existing context export names and behavior remain unchanged.
- No GraphQL operation, resolver, authorization rule or attendance data is changed.

## Validation

```bash
npx vitest run src/hooks/useAttendanceManagement.test.js src/components/Dashboard_Manager/Staff/components/Attendance/AttendancePageScoped.test.jsx
npm run build
```

## Out of scope

- Attendance data changes.
- Scheduling seed scripts.
- Backend authorization changes.
