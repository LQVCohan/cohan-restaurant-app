# RBAC permission matrix

## Model

Backend RBAC follows `User → Role → Permission`.

- A user references a concrete `Role`.
- A `Role` can inherit permissions from a `ParentRole`.
- Effective permissions are the union of parent role permissions, concrete role permissions, and legacy role fallbacks used while older accounts are migrated.
- `admin` is treated as a wildcard/system role by the authorization service.

## Restaurant scope

Restaurant-owned data is guarded in two layers:

1. `requireRestaurantAccess(ctx, restaurantId)` verifies that the authenticated user can access the target restaurant.
2. `requirePermission` verifies that the user has the module permission required for the action.

Resolvers should use `requireRestaurantPermission(ctx, restaurantId, permissionCode)` for restaurant-owned data. If a resolver receives only an entity id, it should load the entity first, read its `restaurantId`, and then check the permission and scope before mutating or returning sensitive data.

## Frontend vs backend

Frontend role or permission checks are only for hiding navigation and reducing accidental clicks. Backend resolvers are the source of truth and must enforce permissions even when the UI is bypassed.

## Role matrix

| Role | Typical permissions | Notes |
| --- | --- | --- |
| `admin` | `*` / all permissions | Bypasses restaurant scope through existing admin logic. |
| `manager` | Restaurant operations: `restaurant.read`, `restaurant.write`, `menu.*`, `order.*`, `payment.*`, `staff.*`, `shift.*`, `table.*`, `inventory.*`, `stock.*`, `reservation.read/update/cancel`, `promotion.*`, `coupon.*`, `report.read/export`, `role.read`, `permission.read` | Does **not** receive sensitive write permissions such as `role.write`, `permission.write`, `config.write`, or `system.manage`. |
| `server` | `menu.read`, `order.read`, `order.create`, `order.update`, `table.read` | Can operate dine-in orders inside their restaurant scope. |
| `cashier` | `order.read`, `payment.read`, `payment.write`, `table.read` | Can process payments inside their restaurant scope. |
| `chef` / kitchen roles | `kitchen.read`, `kitchen.write`, `order.read`, `order.update` | Can update kitchen/order item state when scoped to the restaurant. |
| `storekeeper` | `inventory.read`, `inventory.write`, `stock.read`, `stock.write`, `supplier.read`, `supplier.write` | Can maintain inventory and stock movements. |
| `customer` | `profile.update`, `address.*`, `cart.*`, `reservation.create`, `review.create`, `notification.read` | Customer flows remain separate and should not require staff/admin permissions. |

## Current enforcement coverage

This PR adds backend guards for menu, order, payment, inventory/stock, reservation management, promotion/coupon, table, and restaurant mutation flows. Staff scheduling, payroll, attendance, and report screens still have some legacy role-based guards and should continue to be converted incrementally without changing customer flows.
