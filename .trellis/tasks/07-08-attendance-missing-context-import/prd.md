# Attendance module load failure

## Current behavior

Opening the manager attendance page causes Vite to request `src/context/AttendanceScopeContext` and return HTTP 404. The lazy-loaded manager component then throws `Failed to fetch dynamically imported module`, so the page falls into `AppErrorBoundary`.

## Root cause

`useAttendanceManagement.js` still imports and reads `AttendanceScopeContext`. The current attendance flow no longer relies on that context: `AttendancePageScoped` injects the selected restaurant into `AuthContext`, and `AttendancePage`/`OvertimePanel` pass `restaurantId` explicitly into the hook. The context import is therefore dead coupling and can break module loading when the local checkout no longer contains the obsolete file.

## Traced flow

1. Backend authorization remains in restaurant-scoped attendance resolvers and BrandMembership guards.
2. `AttendancePageScoped` applies the selected restaurant before `AttendancePage` mounts.
3. `AttendancePage` derives the restaurant from URL/AuthContext and passes it to `useAttendanceManagement`.
4. `OvertimePanel` also passes an explicit restaurant ID.
5. `useAttendanceManagement` builds GraphQL variables from the explicit argument.

## Files

- `src/hooks/useAttendanceManagement.js`: remove `useContext`, the obsolete context import, and the fallback lookup.
- `src/context/AttendanceScopeContext.jsx`: remove the unused context module.

## Acceptance criteria

- Attendance page module loads without requesting `AttendanceScopeContext`.
- Query variables still use the explicit `restaurantId` passed by attendance callers.
- No GraphQL operation, resolver, authorization rule, or UI behavior is changed.
- Existing attendance hook tests continue to import and execute.

## Validation

```bash
npx vitest run src/hooks/useAttendanceManagement.test.js src/components/Dashboard_Manager/Staff/components/Attendance/AttendancePageScoped.test.jsx
npm run build
```

## Out of scope

- Attendance data changes.
- Scheduling seed scripts.
- Backend authorization changes.
