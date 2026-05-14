# RBAC Audit Log

## Goal

RBAC audit log records sensitive role and permission changes for security review and graduation-project reporting. It is a traceability layer and does not replace authorization guards.

## Logged events

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
- RBAC_GUARD_DENIED is reserved for a later guard-level follow-up.

## Mutations with audit side effects

- createRole
- updateRole
- deleteRole
- createParentRole
- updateParentRole
- deleteParentRole
- createPermission
- updatePermission
- assignStaffRole and assignStaffRoleWithinRestaurant through assignStaffRoleWithinRestaurant service

Audit writes are best-effort. A log write failure is caught inside logRbacAudit and only emits a warning, so the main mutation remains governed by the existing business and authorization logic.

## Captured data

Each RBAC audit entry stores actor, action, module, target, optional restaurantId, before/after snapshots, metadata, ipAddress, userAgent, and createdAt.

Snapshots are sanitized. Passwords, tokens, secrets, and authorization values are not persisted. Role and permission snapshots are reduced to fields useful for audit reporting, such as name, slug, code, permissions, parentRole, department, isSystem, and isActive.

The legacy AuditLog fields are kept for backward compatibility:

- entity
- entityId
- action
- byUserId
- diff

The new RBAC fields are optional and do not make existing audit writes invalid.

## Query access

Use rbacAuditLogs(filter, limit, offset) for RBAC audit review.

Access rules:

- Admin can view all RBAC audit logs.
- Manager must provide filter.restaurantId.
- Manager can only view logs for a restaurant in scope.
- Manager cannot view global role or permission audit entries that do not have restaurantId.
- Staff and customer users are forbidden.

The existing auditLogs query remains available for legacy audit-log consumers.

## Notes

Audit log supports investigation and reporting, but it is not an authorization mechanism. Authorization still belongs in guards and services such as requirePermission, requireRestaurantPermission, and requireRestaurantAccess.
