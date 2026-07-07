import { describe, expect, it } from "vitest";
import {
  formatAuditActor,
  formatAuditChange,
  getAuditActionLabel,
  getAuditTargetTypeLabel,
} from "./rbacAuditLogFormatter";

describe("rbacAuditLogFormatter", () => {
  it("maps audit actions to product Vietnamese", () => {
    expect(getAuditActionLabel("ROLE_CREATED")).toBe("Tạo vai trò");
    expect(getAuditActionLabel("STAFF_ROLE_ASSIGNED")).toBe("Cập nhật vai trò nhân viên");
    expect(getAuditActionLabel("PERMISSION_DEACTIVATED")).toBe("Ngừng áp dụng quyền");
  });

  it("falls back to raw action for unknown actions", () => {
    expect(getAuditActionLabel("UNKNOWN_ACTION")).toBe("UNKNOWN_ACTION");
  });

  it("maps target type labels", () => {
    expect(getAuditTargetTypeLabel("ParentRole")).toBe("Nhóm vai trò");
    expect(getAuditTargetTypeLabel("Permission")).toBe("Quyền");
  });

  it("formats staff role assignment from before and after roles", () => {
    expect(formatAuditChange({
      action: "STAFF_ROLE_ASSIGNED",
      before: { role: { name: "Server", slug: "server" } },
      after: { role: { name: "Cashier", slug: "cashier" } },
      metadata: { assignedRoleSlug: "cashier" },
    })).toBe("Vai trò: Nhân viên phục vụ → Thu ngân");
  });

  it("formats assigned role metadata when role snapshots are unavailable", () => {
    expect(formatAuditChange({
      action: "STAFF_ROLE_ASSIGNED",
      metadata: { assignedRoleSlug: "shipper" },
    })).toBe("Vai trò được gán: Nhân viên giao hàng");
  });

  it("formats name changes", () => {
    expect(formatAuditChange({
      before: { name: "Cũ" },
      after: { name: "Mới" },
    })).toBe("Tên: Cũ → Mới");
  });

  it("formats permission changes", () => {
    expect(formatAuditChange({ action: "ROLE_PERMISSION_UPDATED", before: {}, after: {} })).toBe("Danh sách quyền đã được cập nhật");
  });

  it("formats actor fallback", () => {
    expect(formatAuditActor({ actorName: "Admin" })).toBe("Admin");
    expect(formatAuditActor({ actorId: "user-1" })).toBe("user-1");
  });
});
