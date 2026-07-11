# Role-aware staff workspace and responsive shell

## Current behavior

getDefaultPathForRole sends every operational staff role to /staff/dashboard; the direct /staff route also sends every role there. StaffLayout filters navigation correctly, but role-specific links appear after general HR/self-service links and the desktop nav behaves like one long horizontal strip.

## Direction

Compact staff operations shell using the existing sage palette: role-first workspace entry, grouped navigation, clear active state, and a mobile-first menu that keeps the primary task within one tap.

## Root-cause flow

Login -> routeGuard.getRoleHomeRoute -> frontendRoleAccess.getDefaultPathForRole -> AppRouter -> StaffLayout -> role/permission-filtered links -> StaffOrderingScoped or StaffKitchenPage.

No schema, resolver, Apollo operation or mutation is involved.

## Scope

- Map order-capable roles to /staff/orders and kitchen-capable roles to /staff/kitchen.
- Reuse the same mapping for direct /staff entry.
- Move the visible role workspace link to the front of the shared navigation.
- Make the desktop navigation grouped/wrapping and keep mobile containment/touch states.
- Preserve all existing role, permission, restaurant-scope, realtime and page-level behavior.

## Out of scope

- Changing backend authorization or station filtering.
- Changing order/kitchen data fetching or status transitions.
- Adding a new component library, dependency, route or duplicate workspace.
- Rewriting staff subpages individually.
