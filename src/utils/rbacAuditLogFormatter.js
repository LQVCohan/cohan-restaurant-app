import { getRbacRoleLabel } from "./rbacVietnameseLabels";

export const RBAC_AUDIT_ACTION_LABELS = Object.freeze({
  ROLE_CREATED: "Tạo vai trò",
  ROLE_UPDATED: "Cập nhật vai trò",
  ROLE_DELETED: "Xóa vai trò",
  ROLE_PERMISSION_UPDATED: "Cập nhật quyền của vai trò",
  PARENT_ROLE_CREATED: "Tạo nhóm vai trò",
  PARENT_ROLE_UPDATED: "Cập nhật nhóm vai trò",
  PARENT_ROLE_DELETED: "Xóa nhóm vai trò",
  STAFF_ROLE_ASSIGNED: "Cập nhật vai trò nhân viên",
  PERMISSION_CREATED: "Tạo quyền",
  PERMISSION_UPDATED: "Cập nhật quyền",
  PERMISSION_DEACTIVATED: "Ngừng áp dụng quyền",
});

export const RBAC_AUDIT_TARGET_LABELS = Object.freeze({
  Role: "Vai trò",
  ParentRole: "Nhóm vai trò",
  Permission: "Quyền",
  User: "Nhân viên",
});

const valueLabel = (value, fallback = "Không có") => {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") return value;
  return value.name || value.slug || value.code || value.id || value._id || fallback;
};

const roleLabel = (role) => {
  if (!role) return "Chưa có vai trò";
  return getRbacRoleLabel(role);
};

const permissionsChanged = (before = {}, after = {}) => {
  const beforePermissions = before.permissions || before.permissionIds || [];
  const afterPermissions = after.permissions || after.permissionIds || [];
  if (!Array.isArray(beforePermissions) || !Array.isArray(afterPermissions)) return false;
  return JSON.stringify(beforePermissions.map(valueLabel).sort()) !== JSON.stringify(afterPermissions.map(valueLabel).sort());
};

export function getAuditActionLabel(action) {
  return RBAC_AUDIT_ACTION_LABELS[action] || action || "Không rõ hành động";
}

export function getAuditTargetTypeLabel(targetType) {
  return RBAC_AUDIT_TARGET_LABELS[targetType] || targetType || "Không rõ đối tượng";
}

export function formatAuditChange(log = {}) {
  const before = log.before || {};
  const after = log.after || {};
  const metadata = log.metadata || {};
  const changes = [];

  if (before.role || after.role) {
    changes.push(`Vai trò: ${roleLabel(before.role)} → ${roleLabel(after.role)}`);
  } else if (metadata.assignedRoleSlug) {
    changes.push(`Vai trò được gán: ${getRbacRoleLabel(metadata.assignedRoleSlug)}`);
  }

  if (before.name !== undefined || after.name !== undefined) {
    const beforeName = valueLabel(before.name, "Trống");
    const afterName = valueLabel(after.name, "Trống");
    if (beforeName !== afterName) changes.push(`Tên: ${beforeName} → ${afterName}`);
  }

  if (before.slug !== undefined || after.slug !== undefined) {
    const beforeSlug = valueLabel(before.slug, "Trống");
    const afterSlug = valueLabel(after.slug, "Trống");
    if (beforeSlug !== afterSlug) changes.push(`Mã vai trò: ${beforeSlug} → ${afterSlug}`);
  }

  if (before.isActive !== undefined || after.isActive !== undefined) {
    if (before.isActive !== after.isActive) {
      changes.push(`Trạng thái: ${before.isActive ? "Đang hoạt động" : "Ngừng hoạt động"} → ${after.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}`);
    }
  }

  if (metadata.changedPermissions || log.action === "ROLE_PERMISSION_UPDATED" || permissionsChanged(before, after)) {
    changes.push("Danh sách quyền đã được cập nhật");
  }

  if (!changes.length && log.targetName) return `Đối tượng: ${log.targetName}`;
  if (!changes.length) return "Không có thông tin thay đổi.";
  return changes.join("; ");
}

export function formatAuditActor(log = {}) {
  return log.actorName || log.actorId || "Hệ thống";
}
