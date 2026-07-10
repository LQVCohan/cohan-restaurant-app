# Brand Admin staff role scope fix

## Current behavior

The add-employee modal renders `Server - Nhân viên phục vụ` from frontend `STAFF_ROLE_OPTIONS`. Clicking **Tiếp theo** validates that slug against the backend `roleList` result. A Brand Admin can therefore see a role label even when the authoritative query failed or returned no records.

## Root cause

1. `BrandMembership.role = admin` grants Brand-wide restaurant scope.
2. The account role supplies operational capabilities such as `staff.write`.
3. Staff create/update resolvers already authorize through `requireRestaurantPermission` using the selected restaurant.
4. `UserQuery.roleList` is the exception: it receives no restaurant and only calls legacy `requireRole(admin/manager/hr)`.
5. The staff Apollo query also requests `department` and `parentRole` although the modal only uses role id, name, and slug, increasing unrelated serialization failure surface.
6. The modal reads the earlier Apollo error locally, so the Next button correctly sends no request.

## Scope

- Add optional `restaurantId` to the `roleList` GraphQL field.
- When supplied, authorize with `requireRestaurantPermission(ctx, restaurantId, staff.write)`.
- Preserve legacy global-role authorization for existing callers without restaurant context.
- Pass the selected restaurant from `useStaffManagement` and skip the query until selection is ready.
- Request only `id`, `name`, and `slug` for the employee modal.
- Add a focused resolver regression test.

## Acceptance criteria

- A manager-capable account with active Brand owner/admin membership can load roles for a restaurant in that Brand.
- A restaurant outside the membership scope remains forbidden.
- Existing unscoped role-list callers retain their legacy admin/manager/hr behavior.
- The employee modal maps the selected slug to a real backend role id.
- No database mutation, hard-coded Mongo id, new dependency, or UI-only bypass is added.

## Validation

- Run the focused user resolver test and GraphQL validation when a runnable checkout is available.
- Re-fetch and review all changed files on main.

## Out of scope

- Automatically seeding missing Role records.
- Changing BrandMembership compatibility rules.
- Redesigning the employee modal.
