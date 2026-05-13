import React, { useContext, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import { isAdminRole, isManagerRole } from "@/utils/frontendRoleAccess";
import { useRbacManagement } from "@/hooks/useRbacManagement";
import "./RbacManagement.scss";

const getGraphQLErrorMessage = (error, fallback) => error?.graphQLErrors?.[0]?.message || error?.networkError?.result?.errors?.[0]?.message || error?.message || fallback;

const roleLabel = (role) => role?.name || role?.slug || "Chưa có vai trò";
const permissionLabel = (permission) => permission?.code || permission?.name || permission?.id;

function PermissionGroups({ groups }) {
  const entries = Object.entries(groups || {});
  if (!entries.length) return <p className="rbac-empty">Chưa có permission để hiển thị.</p>;

  return (
    <div className="rbac-permission-groups">
      {entries.map(([group, permissions]) => (
        <section key={group} className="rbac-card rbac-permission-group">
          <h3>{group}</h3>
          <div className="rbac-chip-list">
            {permissions.map((permission) => (
              <span key={permission.id} className="rbac-chip" title={permission.description || permission.name}>
                <strong>{permission.code}</strong>
                <small>{permission.action} · {permission.resource}</small>
              </span>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RoleExplorer({ roles, selectedRoleId, onSelectRole, selectedRole }) {
  return (
    <div className="rbac-grid rbac-grid--roles">
      <section className="rbac-card">
        <div className="rbac-card__header">
          <h3>Role</h3>
          <span>{roles.length} role</span>
        </div>
        <div className="rbac-role-list">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              className={`rbac-role-row ${selectedRoleId === role.id ? "is-active" : ""}`}
              onClick={() => onSelectRole(role.id)}
            >
              <strong>{roleLabel(role)}</strong>
              <span>{role.slug}</span>
              <small>{role.department || "all"} · {role.isSystem ? "system" : "custom"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="rbac-card">
        <div className="rbac-card__header">
          <h3>Effective permissions</h3>
          <span>{selectedRole?.permissions?.length || 0} quyền</span>
        </div>
        {selectedRole ? (
          <>
            <div className="rbac-selected-role">
              <h4>{roleLabel(selectedRole)}</h4>
              <p>{selectedRole.description || "Role chưa có mô tả."}</p>
              <small>Parent: {selectedRole.parentRole?.name || selectedRole.parentRole?.slug || "Không có"}</small>
            </div>
            <div className="rbac-chip-list">
              {(selectedRole.permissions || []).map((permission) => (
                <span key={permission.id || permission.code} className="rbac-chip rbac-chip--permission">
                  {permissionLabel(permission)}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="rbac-empty">Chọn role để xem quyền hiệu lực.</p>
        )}
      </section>
    </div>
  );
}

function StaffRoleAssignment({ restaurants, roles, staff, selectedRestaurantId, setSelectedRestaurantId, assignStaffRole, assigning }) {
  const [staffUserId, setStaffUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState(null);

  const assignableRoles = useMemo(
    () => roles.filter((role) => !["admin", "manager", "hr", "accountant"].includes(String(role.slug || "").toLowerCase())),
    [roles],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    try {
      await assignStaffRole({ variables: { input: { staffUserId, roleId, restaurantId: selectedRestaurantId } } });
      setStatus({ type: "success", text: "Đã gán role cho nhân viên." });
    } catch (error) {
      setStatus({ type: "error", text: getGraphQLErrorMessage(error, "Không thể gán role. Backend đã chặn quyền không hợp lệ.") });
    }
  };

  return (
    <section className="rbac-card rbac-assignment">
      <div className="rbac-card__header">
        <h3>Manager gán role nhân viên</h3>
        <span>Backend enforce RBAC</span>
      </div>
      <form onSubmit={handleSubmit} className="rbac-form">
        <label>
          Nhà hàng
          <select value={selectedRestaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)} required>
            <option value="">Chọn nhà hàng</option>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
            ))}
          </select>
        </label>
        <label>
          Nhân viên
          <select value={staffUserId} onChange={(event) => setStaffUserId(event.target.value)} required>
            <option value="">Chọn nhân viên</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName} {member.role?.slug ? `(${member.role.slug})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Role mới
          <select value={roleId} onChange={(event) => setRoleId(event.target.value)} required>
            <option value="">Chọn role</option>
            {assignableRoles.map((role) => (
              <option key={role.id} value={role.id}>{roleLabel(role)} · {role.slug}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={assigning || !selectedRestaurantId || !staffUserId || !roleId}>
          {assigning ? "Đang gán..." : "Gán role"}
        </button>
      </form>
      {status ? <p className={`rbac-status rbac-status--${status.type}`}>{status.text}</p> : null}
      <p className="rbac-note">Frontend chỉ lọc sơ bộ để dễ dùng; các rule protected role và permission nhạy cảm vẫn do backend quyết định.</p>
    </section>
  );
}

export default function RbacManagement() {
  const { user, restaurants = [] } = useContext(AuthContext);
  const roleName = user?.roleName || user?.role?.slug;
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(restaurants?.[0]?.id || "");
  const rbac = useRbacManagement(selectedRestaurantId);

  const canManage = isAdminRole(roleName) || isManagerRole(roleName);
  if (!canManage) return <div className="rbac-page"><p className="rbac-empty">Bạn không có quyền xem màn hình RBAC.</p></div>;

  return (
    <div className="rbac-page">
      <header className="rbac-hero">
        <div>
          <p className="rbac-eyebrow">RBAC management</p>
          <h2>Quản lý role, permission và gán role nhân viên</h2>
          <p>Trang nền phục vụ báo cáo đồ án: admin/manager xem permission theo group, role effective permissions và thao tác gán role staff qua GraphQL.</p>
        </div>
        <button type="button" onClick={() => rbac.refetch()} disabled={rbac.loading}>Làm mới</button>
      </header>

      {rbac.error ? <div className="rbac-status rbac-status--error">{getGraphQLErrorMessage(rbac.error, "Không tải được dữ liệu RBAC.")}</div> : null}
      {rbac.loading ? <div className="rbac-status">Đang tải dữ liệu RBAC...</div> : null}

      <RoleExplorer roles={rbac.roles} selectedRoleId={rbac.selectedRoleId} onSelectRole={rbac.setSelectedRoleId} selectedRole={rbac.selectedRole} />
      <StaffRoleAssignment
        restaurants={restaurants}
        roles={rbac.roles}
        staff={rbac.staff}
        selectedRestaurantId={selectedRestaurantId}
        setSelectedRestaurantId={setSelectedRestaurantId}
        assignStaffRole={rbac.assignStaffRole}
        assigning={rbac.assigning}
      />
      <PermissionGroups groups={rbac.permissionsByGroup} />
    </div>
  );
}
