# Fix initial attendance restaurant scope

## Current behavior and root cause

`StaffManagement.jsx` passes the selected restaurant to the attendance entry component. `AttendancePageScoped.jsx` uses that value only to synchronize the URL, then renders `AttendancePage` without forwarding the prop.

`AttendancePage.jsx` initializes its query restaurant state as an empty string and reads the URL only in an effect. Therefore, its first `useAttendanceManagement` call can run without `restaurantId`.

The combined attendance query includes `staffList`. On the backend, `staffList` without `restaurantId` is intentionally restricted to `ADMIN`. A manager account therefore receives HTTP 403 before the URL effect supplies the restaurant scope.

The refresh endpoint 401 shown in the browser is a separate stale-session condition. This task does not weaken authentication or permissions.

## Flow traced

`StaffManagement selectedRestaurant -> AttendancePageScoped -> AttendancePage -> useAttendanceManagement -> AttendancePageData -> staffList/staffAttendanceRecords -> requireRestaurantAccess / admin-only unscoped guard`.

## Files changing

- `AttendancePageScoped.jsx`: forward the normalized selected restaurant.
- `AttendancePage.jsx`: use the forwarded restaurant as the immediate query and quick-action fallback.
- `AttendancePage.test.jsx`: verify the first hook call is restaurant-scoped.

## Acceptance criteria

- A manager opening Chấm công sends the first attendance query with the selected restaurant ID.
- The page no longer touches the admin-only unscoped `staffList` path during initial mount.
- Schedule deep links can still override the selected restaurant through the query string.
- Staff self-service still falls back to `user.restaurantForStaff` when no manager scope is provided.
- Quick attendance actions use the selected manager restaurant even before records exist.
- No schema, resolver, role, restaurant-access, or overtime workflow changes.

## Validation

- `npx vitest run src/components/Dashboard_Manager/Staff/components/Attendance/AttendancePage.test.jsx`
- `npm run build`

## Out of scope

- Changing refresh-token security or converting 403 errors into empty data.
- Granting managers access to unscoped staff lists.
- Changing attendance or overtime calculations.
