# RBAC Audit Log

## Mục tiêu

RBAC audit log ghi lại các thao tác nhạy cảm liên quan đến role, parent role, permission và gán role nhân viên để phục vụ truy vết bảo mật và báo cáo đồ án. Audit log chỉ là lớp truy vết, không thay thế authorization guard hiện có.

## Event được ghi

- ROLE_CREATED
- ROLE_UPDATED
- ROLE_DELETED
- ROLE_PERMISSION_UPDATED
- PARENT_ROLE_CREATED
- PARENT_ROLE_UPDATED
- PARENT_ROLE_DELETED
- STAFF_ROLE_ASSIGNED
- PERMISSION_CREATED
- PERMISSION_UPDATED
- PERMISSION_DEACTIVATED

RBAC_GUARD_DENIED được để lại cho follow-up vì PR này tập trung vào mutation audit.

## Mutation đã gắn audit

- createRole
- updateRole
- deleteRole
- createParentRole
- updateParentRole
- deleteParentRole
- createPermission
- updatePermission
- assignStaffRole / assignStaffRoleWithinRestaurant thông qua staffRoleAssignment service

Audit write là best-effort. Nếu ghi log lỗi, logRbacAudit sẽ catch lỗi và warning, không làm hỏng mutation chính.

## Dữ liệu before/after

Log lưu actor, action, module, target, restaurantId nếu có, before, after, metadata và thời điểm tạo. Payload được sanitize để không lưu password, token, secret hoặc authorization data.

Các snapshot role/permission ưu tiên field phục vụ báo cáo:

- name
- slug
- code
- permissions
- parentRole
- department
- isSystem
- isActive

## Backward compatibility

Model AuditLog vẫn giữ các field cũ:

- entity
- entityId
- action
- byUserId
- diff

Query auditLogs cũ vẫn được giữ nguyên. Các field RBAC mới là optional để không phá log cũ.

## Query xem audit RBAC

Query mới:

```graphql
rbacAuditLogs(filter: AuditLogFilter, limit: Int = 50, offset: Int = 0): [AuditLog!]!
```

Access rule:

- Admin xem được toàn bộ.
- Manager bắt buộc truyền filter.restaurantId.
- Manager chỉ xem log trong restaurant scope.
- Manager không xem được global audit thiếu restaurantId.
- Staff/customer bị FORBIDDEN.

## Lưu ý

Audit log phục vụ truy vết và báo cáo, không thay thế các guard như requirePermission, requireRestaurantPermission hoặc requireRestaurantAccess.
