import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import { isAdminRole, isManagerRole } from "@/utils/frontendRoleAccess";
import { useRbacManagement } from "@/hooks/useRbacManagement";
import "./RbacManagement.scss";

const getGraphQLErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

const roleLabel = (role) => role?.name || role?.slug || "Chưa có vai trò";
const permissionLabel = (permission) => permission?.code || permission?.name || permission?.id;
const protectedRoleSlugs = new Set(["admin", "manager", "hr", "accountant"]);

function PermissionGroups({ groups }) {
  const entries = Object.entries(groups || {});

  return (
    <section className="rbac-card rbac-permission-catalog">
      <div className="rbac-card__header">
        <h3>Danh mục quyền hạn</h3>
        <span>{entries.reduce((total, [, permissions]) => total + permissions.length, 0)} quyền hạn</span>
      </div>
      {!entries.length ? <p className="rbac-empty">Chưa có quyền hạn để hiển thị.</p> : null}
      <div className="rbac-permission-groups">
        {entries.map(([group, permissions]) => (
          <section key={group} className="rbac-permission-group">
            <h4>{group}</h4>
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
    </section>
  );
}

function RoleExplorer({ roles, selectedRoleId, onSelectRole, selectedRole }) {
  return (
    <div className="rbac-grid rbac-grid--roles">
      <section className="rbac-card">
        <div className="rbac-card__header">
          <h3>Danh sách vai trò</h3>
          <span>{roles.length} vai trò</span>
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
              <span>Vai trò: {role.slug}</span>
              <small>{role.department || "all"} · {role.isSystem ? "hệ thống" : "tuỳ chỉnh"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="rbac-card">
        <div className="rbac-card__header">
          <h3>Quyền hiệu lực của vai trò</h3>
          <span>{selectedRole?.permissions?.length || 0} quyền hạn</span>
        </div>
        {selectedRole ? (
          <>
            <div className="rbac-selected-role">
              <h4>{roleLabel(selectedRole)}</h4>
              <p>{selectedRole.description || "Vai trò chưa có mô tả."}</p>
              <small>Nhóm vai trò: {selectedRole.parentRole?.name || selectedRole.parentRole?.slug || "Không có"}</small>
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
          <p className="rbac-empty">Chọn vai trò để xem quyền hiệu lực.</p>
        )}
      </section>
    </div>
  );
}

function StaffRoleAssignment({
  restaurants,
  roles,
  staff,
  selectedRestaurantId,
  setSelectedRestaurantId,
  assignStaffRole,
  assigning,
  staffListEnabled,
}) {
  const [staffUserId, setStaffUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState(null);

  const assignableRoles = useMemo(
    () => roles.filter((role) => !protectedRoleSlugs.has(String(role.slug || "").toLowerCase())),
    [roles],
  );

  useEffect(() => {
    setStaffUserId("");
    setRoleId("");
    setStatus(null);
  }, [selectedRestaurantId]);

  const hasRestaurants = restaurants.length > 0;
  const hasRestaurantSelected = Boolean(selectedRestaurantId);
  const hasStaff = staff.length > 0;
  const hasAssignableRoles = assignableRoles.length > 0;
  const formDisabled = assigning || !hasRestaurantSelected || !hasStaff || !hasAssignableRoles;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (formDisabled || !staffUserId || !roleId) return;

    setStatus(null);
    try {
      await assignStaffRole({ variables: { input: { staffUserId, roleId, restaurantId: selectedRestaurantId } } });
      setStatus({ type: "success", text: "Đã gán vai trò cho nhân viên." });
    } catch (error) {
      setStatus({
        type: "error",
        text: getGraphQLErrorMessage(error, "Không thể gán vai trò. Backend đã chặn quyền không hợp lệ."),
      });
    }
  };

  return (
    <section className="rbac-card rbac-assignment">
      <div className="rbac-card__header">
        <h3>Gán vai trò cho nhân viên</h3>
        <span>Backend kiểm tra quyền bắt buộc</span>
      </div>

      {!hasRestaurants ? (
        <p className="rbac-status rbac-status--warning">
          Chưa có nhà hàng để gán vai trò. Vui lòng kiểm tra tài khoản quản lý hoặc tạo nhà hàng trước.
        </p>
      ) : null}
      {hasRestaurants && !hasRestaurantSelected ? (
        <p className="rbac-status rbac-status--info">Chọn nhà hàng trước khi gán vai trò cho nhân viên.</p>
      ) : null}
      {hasRestaurantSelected && staffListEnabled && !hasStaff ? (
        <p className="rbac-status rbac-status--info">Nhà hàng này chưa có nhân viên để gán vai trò.</p>
      ) : null}
      {!hasAssignableRoles ? (
        <p className="rbac-status rbac-status--info">Chưa có vai trò nhân viên phù hợp để gán.</p>
      ) : null}

      <form onSubmit={handleSubmit} className="rbac-form" aria-disabled={formDisabled}>
        <label>
          Nhà hàng
          <select
            value={selectedRestaurantId}
            onChange={(event) => setSelectedRestaurantId(event.target.value)}
            required
            disabled={!hasRestaurants}
          >
            <option value="">Chọn nhà hàng</option>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
            ))}
          </select>
        </label>
        <label>
          Nhân viên
          <select
            value={staffUserId}
            onChange={(event) => setStaffUserId(event.target.value)}
            required
            disabled={!hasRestaurantSelected || !hasStaff}
          >
            <option value="">Chọn nhân viên</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName} {member.role?.slug ? `(${member.role.slug})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vai trò mới
          <select
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            required
            disabled={!hasRestaurantSelected || !hasAssignableRoles}
          >
            <option value="">Chọn vai trò</option>
            {assignableRoles.map((role) => (
              <option key={role.id} value={role.id}>{roleLabel(role)} · {role.slug}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={formDisabled || !staffUserId || !roleId}>
          {assigning ? "Đang gán vai trò..." : "Gán vai trò"}
        </button>
      </form>
      {status ? <p className={`rbac-status rbac-status--${status.type}`}>{status.text}</p> : null}
      <p className="rbac-note">
        Frontend chỉ lọc sơ bộ để dễ dùng; backend vẫn thực thi toàn bộ kiểm tra RBAC và phạm vi nhà hàng.
      </p>
    </section>
  );
}

export default function RbacManagement() {
  const { user, restaurants = [] } = useContext(AuthContext);
  const roleName = user?.roleName || user?.role?.slug;
  const isAdmin = isAdminRole(roleName);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(restaurants?.[0]?.id || "");
  const rbac = useRbacManagement(selectedRestaurantId, { includeAllRestaurants: isAdmin });

  const restaurantOptions = useMemo(() => {
    const source = isAdmin && rbac.allRestaurants.length ? rbac.allRestaurants : restaurants;
    const map = new Map();
    for (const restaurant of source || []) {
      const id = String(restaurant?.id || restaurant?._id || "");
      if (id) map.set(id, { id, name: restaurant?.name || "Nhà hàng chưa đặt tên" });
    }
    return Array.from(map.values());
  }, [isAdmin, rbac.allRestaurants, restaurants]);

  useEffect(() => {
    if (selectedRestaurantId || !restaurantOptions.length) return;
    setSelectedRestaurantId(restaurantOptions[0].id);
  }, [restaurantOptions, selectedRestaurantId]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    const stillAvailable = restaurantOptions.some((restaurant) => restaurant.id === selectedRestaurantId);
    if (!stillAvailable) setSelectedRestaurantId(restaurantOptions[0]?.id || "");
  }, [restaurantOptions, selectedRestaurantId]);

  const canManage = isAdmin || isManagerRole(roleName);
  if (!canManage) {
    return <div className="rbac-page"><p className="rbac-empty">Bạn không có quyền xem màn hình phân quyền nhân viên.</p></div>;
  }

  return (
    <div className="rbac-page">
      <header className="rbac-hero">
        <div>
          <p className="rbac-eyebrow">Phân quyền nhân viên</p>
          <h2>Quản lý phân quyền nhân viên</h2>
          <p>Xem danh sách vai trò, quyền hạn và gán vai trò cho nhân viên theo từng nhà hàng.</p>
          <small>RBAC được kiểm tra bắt buộc ở backend; giao diện chỉ hỗ trợ thao tác và hiển thị.</small>
        </div>
        <button type="button" onClick={() => rbac.refetch()} disabled={rbac.loading}>Làm mới</button>
      </header>

      {rbac.error ? (
        <div className="rbac-status rbac-status--error">
          {getGraphQLErrorMessage(rbac.error, "Không tải được dữ liệu phân quyền. Vui lòng thử lại sau.")}
        </div>
      ) : null}
      {rbac.loading ? <div className="rbac-status">Đang tải dữ liệu phân quyền...</div> : null}

      <RoleExplorer
        roles={rbac.roles}
        selectedRoleId={rbac.selectedRoleId}
        onSelectRole={rbac.setSelectedRoleId}
        selectedRole={rbac.selectedRole}
      />
      <StaffRoleAssignment
        restaurants={restaurantOptions}
        roles={rbac.roles}
        staff={rbac.staff}
        selectedRestaurantId={selectedRestaurantId}
        setSelectedRestaurantId={setSelectedRestaurantId}
        assignStaffRole={rbac.assignStaffRole}
        assigning={rbac.assigning}
        staffListEnabled={rbac.includeStaffList}
      />
      <PermissionGroups groups={rbac.permissionsByGroup} />
    </div>
  );
}
