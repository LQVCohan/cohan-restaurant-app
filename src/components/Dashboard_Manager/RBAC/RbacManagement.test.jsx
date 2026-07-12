import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RbacManagement from "./RbacManagement";
import { AuthContext } from "../../../context/AuthContext";

const rbacState = vi.hoisted(() => ({ current: null }));
const setSelectedRestaurantId = vi.fn();
const setSelectedRoleId = vi.fn();
const createRole = vi.fn();
const updateRole = vi.fn();
const assignStaffRole = vi.fn();

vi.mock("@/hooks/useManagerRestaurantSelection", () => ({
  default: () => ({
    restaurantOptions: [{ id: "r1", name: "Nhà hàng 1" }],
    selectedRestaurantId: "r1",
    setSelectedRestaurantId,
    restaurantsLoading: false,
  }),
}));

vi.mock("@/hooks/useRbacManagement", () => ({ useRbacManagement: () => rbacState.current }));
vi.mock("./RbacAuditLogPanel", () => ({ default: ({ auditLogs }) => <section><h3>Lịch sử thay đổi</h3>{auditLogs.map((log) => <p key={log.id}>{log.action}</p>)}</section> }));
vi.mock("lucide-react", () => {
  const Icon = (props) => <svg {...props} />;
  return {
    Building2: Icon,
    CheckCircle2: Icon,
    FileClock: Icon,
    KeyRound: Icon,
    ListChecks: Icon,
    Lock: Icon,
    RefreshCw: Icon,
    ShieldCheck: Icon,
    UserCog: Icon,
    Users: Icon,
  };
});

const permissions = [
  { id: "p1", code: "role.read", name: "Xem role", group: "system" },
  { id: "p2", code: "role.write", name: "Sửa role", group: "system" },
  { id: "p3", code: "staff.write", name: "Gán nhân viên", group: "staff" },
];
const parentRoles = [{ id: "pr1", name: "Manager parent", slug: "manager", permissions: [permissions[0]] }];
const customRole = { id: "role1", name: "Captain", slug: "captain", description: "Custom", department: "service", isSystem: false, parentRole: parentRoles[0], directPermissions: [permissions[2]], permissions: [permissions[0], permissions[2]] };
const protectedRole = { id: "role2", name: "Manager", slug: "manager", description: "System", department: "management", isSystem: true, parentRole: parentRoles[0], directPermissions: [], permissions: [permissions[0]] };

const baseUser = { id: "u1", role: { permissions: [{ code: "role.read" }, { code: "role.write" }, { code: "permission.read" }, { code: "staff.write" }, { code: "system.manage" }] } };
const brandAdminUser = { id: "brand-admin-1", role: { permissions: [] } };
const activeBrandAdminContext = { brandMemberships: [{ role: "admin", status: "active" }] };

function setBaseState(overrides = {}) {
  rbacState.current = {
    roles: [customRole, protectedRole],
    permissions,
    permissionsByGroup: { system: permissions.slice(0, 2), staff: [permissions[2]] },
    parentRoles,
    staff: [{ id: "staff1", fullName: "An Nguyen", role: customRole }],
    allRestaurants: [],
    selectedRole: customRole,
    selectedRoleId: customRole.id,
    setSelectedRoleId,
    loading: false,
    error: null,
    refetch: vi.fn(),
    includeStaffList: true,
    assignStaffRole,
    assigning: false,
    createRole,
    creatingRole: false,
    updateRole,
    updatingRole: false,
    auditLogs: [{ id: "a1", action: "ROLE_CREATED" }],
    auditLogsLoading: false,
    auditLogsError: null,
    auditLogFilters: {},
    setAuditLogFilters: vi.fn(),
    refetchAuditLogs: vi.fn(),
    auditLogsSkipped: false,
    ...overrides,
  };
}

const renderPage = (user = baseUser, context = {}) => render(<AuthContext.Provider value={{ user, ...context }}><RbacManagement /></AuthContext.Provider>);

beforeEach(() => {
  vi.clearAllMocks();
  createRole.mockResolvedValue({ data: { createRole: { id: "new-role" } } });
  updateRole.mockResolvedValue({ data: { updateRole: customRole } });
  assignStaffRole.mockResolvedValue({ data: { assignStaffRole: { id: "staff1" } } });
  setBaseState();
});

describe("RbacManagement", () => {
  it("renders role list and permission catalog grouped", () => {
    renderPage();
    expect(screen.getByText("Danh sách vai trò")).toBeInTheDocument();
    expect(screen.getAllByText("Captain").length).toBeGreaterThan(0);
    expect(screen.getByText("Quản trị hệ thống")).toBeInTheDocument();
    expect(screen.getAllByText("Nhân viên").length).toBeGreaterThan(0);
  });

  it("shows inherited, direct and effective permissions for selected role", () => {
    renderPage();
    expect(screen.getAllByText("Quyền kế thừa").length).toBeGreaterThan(0);
    expect(screen.getByText("Quyền gán riêng")).toBeInTheDocument();
    expect(screen.getByText("Quyền sau cùng")).toBeInTheDocument();
    expect(screen.getAllByText("Gán nhân viên").length).toBeGreaterThan(0);
  });

  it("locks protected role form", () => {
    setBaseState({ selectedRole: protectedRole, selectedRoleId: protectedRole.id });
    renderPage();
    fireEvent.click(screen.getByText("Tạo vai trò"));
    expect(screen.getByText(/Vai trò mặc định chỉ được xem/)).toBeInTheDocument();
    expect(screen.getByLabelText("Tên vai trò")).toBeDisabled();
  });

  it("lets an active Brand Admin edit a custom role", () => {
    renderPage(brandAdminUser, activeBrandAdminContext);
    fireEvent.click(screen.getByRole("button", { name: "Tạo vai trò" }));
    expect(screen.getByText("Có thể chỉnh sửa")).toBeInTheDocument();
    expect(screen.getByLabelText("Tên vai trò")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Tạo vai trò mới" })).not.toBeDisabled();
  });

  it("keeps protected roles locked for Brand Admin", () => {
    setBaseState({ selectedRole: protectedRole, selectedRoleId: protectedRole.id });
    renderPage(brandAdminUser, activeBrandAdminContext);
    fireEvent.click(screen.getByText("Tạo vai trò"));
    expect(screen.getByText(/Vai trò mặc định chỉ được xem/)).toBeInTheDocument();
    expect(screen.getByLabelText("Tên vai trò")).toBeDisabled();
  });

  it("creates a custom role", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tạo vai trò" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo vai trò mới" }));
    fireEvent.change(screen.getByLabelText("Tên vai trò"), { target: { value: "Auditor" } });
    fireEvent.change(screen.getByLabelText("Tên rút gọn"), { target: { value: "auditor" } });
    fireEvent.change(screen.getByLabelText("Nhóm kế thừa"), { target: { value: "pr1" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Tạo vai trò" }).at(-1));
    await waitFor(() => expect(createRole).toHaveBeenCalled());
  });

  it("updates a custom role", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tạo vai trò" }));
    fireEvent.change(screen.getByLabelText("Tên vai trò"), { target: { value: "Captain updated" } });
    fireEvent.click(screen.getByText("Lưu thay đổi"));
    await waitFor(() => expect(updateRole).toHaveBeenCalled());
  });

  it("assigns a role to staff", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Gán vai trò"));
    fireEvent.change(screen.getByLabelText("Nhân viên"), { target: { value: "staff1" } });
    fireEvent.change(screen.getByLabelText("Vai trò mới"), { target: { value: "role1" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Gán vai trò" }).at(-1));
    await waitFor(() => expect(assignStaffRole).toHaveBeenCalled());
  });

  it("renders audit tab", () => {
    renderPage();
    fireEvent.click(screen.getByText("Lịch sử thay đổi"));
    expect(screen.getByText("ROLE_CREATED")).toBeInTheDocument();
  });

  it("shows no-permission state", () => {
    renderPage({ id: "u2", role: { permissions: [] } });
    expect(screen.getByText(/không có quyền xem/)).toBeInTheDocument();
  });
});
