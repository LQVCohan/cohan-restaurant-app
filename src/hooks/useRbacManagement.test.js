import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRbacManagement } from "./useRbacManagement";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const assignStaffRoleMutation = vi.fn();
const createRoleMutation = vi.fn();
const updateRoleMutation = vi.fn();
const refetch = vi.fn();
const refetchAuditLogs = vi.fn();

vi.mock("@apollo/client", () => ({
  gql: (strings) => strings,
  useQuery: (...args) => useQueryMock(...args),
  useMutation: (...args) => useMutationMock(...args),
}));

const managementData = {
  role: [{ id: "role1", name: "Captain", slug: "captain", permissions: [], directPermissions: [] }],
  permissions: [
    { id: "p1", code: "role.read", group: "system", name: "Xem role" },
    { id: "p2", code: "staff.write", group: "staff", name: "Gán nhân viên" },
  ],
  parentRoles: [{ id: "pr1", name: "Manager", permissions: [] }],
  staffList: [{ id: "s1", fullName: "An" }],
  restaurants: { edges: [{ node: { id: "r2", name: "Chi nhánh 2" } }] },
};

beforeEach(() => {
  vi.clearAllMocks();
  useQueryMock.mockImplementation((query) => {
    const text = String(query);
    if (text.includes("rbacAuditLogs")) return { data: { rbacAuditLogs: [{ id: "a1", action: "ROLE_CREATED" }] }, loading: false, error: null, refetch: refetchAuditLogs };
    return { data: managementData, loading: false, error: null, refetch };
  });
  assignStaffRoleMutation.mockResolvedValue({ data: { assignStaffRole: { id: "s1" } } });
  createRoleMutation.mockResolvedValue({ data: { createRole: { id: "role2" } } });
  updateRoleMutation.mockResolvedValue({ data: { updateRole: { id: "role1" } } });
  useMutationMock.mockImplementation((mutation, options = {}) => {
    const text = String(mutation);
    const wrap = (fn) => async (args) => {
      const result = await fn(args);
      options.onCompleted?.(result.data);
      return result;
    };
    if (text.includes("assignStaffRole")) return [wrap(assignStaffRoleMutation), { loading: false, error: null }];
    if (text.includes("createRole")) return [wrap(createRoleMutation), { loading: false, error: null }];
    if (text.includes("updateRole")) return [wrap(updateRoleMutation), { loading: false, error: null }];
    return [vi.fn(), { loading: false, error: null }];
  });
});

describe("useRbacManagement", () => {
  it("groups permissions and exposes selected role", () => {
    const { result } = renderHook(() => useRbacManagement("r1", { includeAllRestaurants: true, canViewGlobalAuditLogs: true }));
    expect(result.current.selectedRole.id).toBe("role1");
    expect(result.current.permissionsByGroup.system).toHaveLength(1);
    expect(result.current.permissionsByGroup.staff).toHaveLength(1);
    expect(result.current.auditLogs[0].action).toBe("ROLE_CREATED");
  });

  it("refetches role/staff/audit data after mutations", async () => {
    const { result } = renderHook(() => useRbacManagement("r1", { canViewGlobalAuditLogs: false }));
    await result.current.createRole({ variables: { input: { name: "Auditor" } } });
    await result.current.updateRole({ variables: { input: { id: "role1" } } });
    await result.current.assignStaffRole({ variables: { input: { staffUserId: "s1", roleId: "role1", restaurantId: "r1" } } });
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(3));
    expect(refetchAuditLogs).toHaveBeenCalledTimes(3);
  });

  it("skips audit logs when requested", () => {
    renderHook(() => useRbacManagement("r1", { skipAuditLogs: true }));
    const auditCall = useQueryMock.mock.calls.find(([query]) => String(query).includes("rbacAuditLogs"));
    expect(auditCall[1].skip).toBe(true);
  });
});
