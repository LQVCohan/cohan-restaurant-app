# Fix initial attendance restaurant scope

## Current behavior and root cause

`StaffManagement.jsx` passes the selected restaurant to the attendance entry component. `AttendancePageScoped.jsx` previously used that value only to synchronize the URL.

`AttendancePage.jsx` initializes its query restaurant state as an empty string and reads the URL only in an effect. Its first `useAttendanceManagement` call therefore used `user.restaurantForStaff`; manager accounts normally do not have that staff-assignment field, so the first query could omit `restaurantId`.

The combined attendance query includes `staffList`. On the backend, `staffList` without `restaurantId` is intentionally restricted to `ADMIN`. A manager account therefore received HTTP 403 before the URL effect supplied the restaurant scope.

The refresh endpoint 401 shown in the browser is a separate stale-session condition. This task does not weaken authentication or permissions.

## Flow traced

`StaffManagement selectedRestaurant -> AttendancePageScoped -> AttendancePage/AuthContext fallback -> useAttendanceManagement -> AttendancePageData -> staffList/staffAttendanceRecords -> requireRestaurantAccess / admin-only unscoped guard`.

## Files changed

- `AttendancePageScoped.jsx`: provide the normalized selected restaurant through the existing `AuthContext.user.restaurantForStaff` fallback before `AttendancePage` mounts; keep the real user ID and role unchanged.
- `AttendancePageScoped.test.jsx`: verify the child receives the selected restaurant immediately and the URL remains synchronized.

## Acceptance criteria

- A manager opening Chấm công has the selected restaurant available before the first attendance query.
- The page no longer touches the admin-only unscoped `staffList` path during initial mount.
- Schedule URL synchronization remains unchanged.
- Staff self-service remains unchanged when no manager scope is provided.
- Backend role and restaurant-access guards still validate the real authenticated account.
- No schema, resolver, role, restaurant-access, or overtime workflow changes.

## Validation

- `npx vitest run src/components/Dashboard_Manager/Staff/components/Attendance/AttendancePageScoped.test.jsx`
- `npm run build`

## Out of scope

- Changing refresh-token security or fabricating data after authentication failure.
- Granting managers access to unscoped staff lists.
- Changing attendance or overtime calculations.
