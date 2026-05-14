import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import { isAdminRole, isManagerRole } from "@/utils/frontendRoleAccess";
import { useRbacManagement } from "@/hooks/useRbacManagement";
import "./RbacManagement.scss";

const getGraphQLErrorMessage = (error, fallback) => {
  const code = error?.graphQLErrors?.[0]?.extensions?.code || error?.networkError?.result?.errors?.[0]?.extensions?.code;
  if (code === "FORBIDDEN") return "Bạn không có quyền thực hiện thao tác này. Backend đã chặn theo chính sách phân quyền.";
  return (
    error?.graphQLErrors?.[0]?.message ||
    error?.networkError?.result?.errors?.[0]?.message ||
    error?.message ||
    fallback
  );
};

const roleLabel = (role) => role?.name || role?.slug || "Chưa có vai trò";
const permissionLabel = (permission) => permission?.code || permission?.name || permission?.id;
const protectedRoleSlugs = new Set(["admin", "manager", "hr", "accountant"]);
const departmentOptions = ["service", "kitchen", "cashier", "management", "cleaning", "delivery", "inventory", "bar"];

const emptyRoleForm = {
  name: "",
  slug: "",
  description: "",
  department: "",
  parentRoleId: "",
  permissionIds: [],
};

const normalizeSlug = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
const permissionKey = (permission) => String(permission?.id || permission?._id || permission?.code || "");

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

function PermissionChipList({ title, permissions, tone = "permission" }) {
  return (
    <div className="rbac-permission-summary">
      <h4>{title}</h4>
      {permissions?.length ? (
        <div className="rbac-chip-list">
          {permissions.map((permission) => (
            <span key={permission.id || permission.code} className={`rbac-chip rbac-chip--${tone}`}>
              {permissionLabel(permission)}
            </span>
          ))}
        </div>
      ) : (
        <p className="rbac-empty">Chưa có quyền hạn.</p>
      )}
    </div>
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
            <div className="rbac-permission-columns">
              <PermissionChipList title="Quyền kế thừa từ nhóm vai trò" permissions={selectedRole.parentRole?.permissions || []} tone="inherited" />
              <PermissionChipList title="Quyền gán trực tiếp cho vai trò" permissions={selectedRole.directPermissions || []} tone="direct" />
              <PermissionChipList title="Quyền hiệu lực cuối cùng" permissions={selectedRole.permissions || []} />
            </div>
          </>
        ) : (
          <p className="rbac-empty">Chọn vai trò để xem quyền hiệu lực.</p>
        )}
      </section>
    </div>
  );
}

function RoleManagement({
  roles,
  parentRoles,
  permissionsByGroup,
  selectedRole,
  selectedRoleId,
  onSelectRole,
  createRole,
  updateRole,
  saving,
  isAdmin,
}) {
  const [mode, setMode] = useState("edit");
  const [form, setForm] = useState(emptyRoleForm);
  const [status, setStatus] = useState(null);
  const readOnly = !isAdmin;
  const selectedParentRole = parentRoles.find((parentRole) => parentRole.id === form.parentRoleId) || null;

  useEffect(() => {
    if (mode !== "edit" || !selectedRole) return;
    setForm({
      name: selectedRole.name || "",
      slug: selectedRole.slug || "",
      description: selectedRole.description || "",
      department: selectedRole.department || "",
      parentRoleId: selectedRole.parentRole?.id || "",
      permissionIds: (selectedRole.directPermissions || []).map((permission) => permission.id),
    });
    setStatus(null);
  }, [mode, selectedRole]);

  const effectivePermissions = useMemo(() => {
    const map = new Map();
    for (const permission of selectedParentRole?.permissions || []) map.set(permissionKey(permission), permission);
    const directIds = new Set(form.permissionIds);
    for (const permissions of Object.values(permissionsByGroup || {})) {
      for (const permission of permissions) {
        if (directIds.has(permission.id)) map.set(permissionKey(permission), permission);
      }
    }
    return Array.from(map.values());
  }, [form.permissionIds, permissionsByGroup, selectedParentRole]);

  const directPermissions = useMemo(() => {
    const directIds = new Set(form.permissionIds);
    return Object.values(permissionsByGroup || {}).flat().filter((permission) => directIds.has(permission.id));
  }, [form.permissionIds, permissionsByGroup]);

  const changeField = (field, value) => {
    setForm((current) => ({ ...current, [field]: field === "slug" ? normalizeSlug(value) : value }));
  };

  const togglePermission = (permissionId) => {
    setForm((current) => {
      const selected = new Set(current.permissionIds);
      if (selected.has(permissionId)) selected.delete(permissionId);
      else selected.add(permissionId);
      return { ...current, permissionIds: Array.from(selected) };
    });
  };

  const startCreate = () => {
    setMode("create");
    setForm(emptyRoleForm);
    setStatus(null);
  };

  const startEdit = () => {
    setMode("edit");
    setStatus(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (readOnly || saving) return;
    setStatus(null);

    const input = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      department: form.department || null,
      parentRoleId: form.parentRoleId,
      permissionIds: form.permissionIds,
    };

    try {
      if (mode === "create") {
        const result = await createRole({ variables: { input: { ...input, slug: normalizeSlug(form.slug) } } });
        const createdId = result?.data?.createRole?.id;
        if (createdId) onSelectRole(createdId);
        setStatus({ type: "success", text: "Đã tạo vai trò mới." });
        setMode("edit");
      } else if (selectedRole) {
        await updateRole({ variables: { input: { id: selectedRole.id, ...input } } });
        setStatus({ type: "success", text: "Đã cập nhật vai trò và quyền hạn." });
      }
    } catch (error) {
      setStatus({
        type: "error",
        text: getGraphQLErrorMessage(error, "Không thể lưu vai trò. Vui lòng kiểm tra quyền hạn và thử lại."),
      });
    }
  };

  return (
    <div className="rbac-grid rbac-grid--management">
      <section className="rbac-card">
        <div className="rbac-card__header">
          <h3>Quản lý vai trò</h3>
          <span>{readOnly ? "Chỉ xem" : "Admin"}</span>
        </div>
        {readOnly ? (
          <p className="rbac-status rbac-status--warning">
            Manager chỉ được gán vai trò cho nhân viên trong nhà hàng, không được chỉnh cấu hình vai trò toàn hệ thống.
          </p>
        ) : null}
        <div className="rbac-action-row">
          <button type="button" onClick={startEdit} className={mode === "edit" ? "is-active" : ""}>Sửa vai trò đang chọn</button>
          <button type="button" onClick={startCreate} className={mode === "create" ? "is-active" : ""} disabled={readOnly}>Tạo vai trò mới</button>
        </div>
        <div className="rbac-role-list rbac-role-list--compact">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              className={`rbac-role-row ${selectedRoleId === role.id ? "is-active" : ""}`}
              onClick={() => {
                onSelectRole(role.id);
                setMode("edit");
              }}
            >
              <strong>{roleLabel(role)}</strong>
              <span>{role.slug}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rbac-card">
        <div className="rbac-card__header">
          <h3>{mode === "create" ? "Tạo vai trò mới" : "Sửa vai trò"}</h3>
          <span>{selectedRole?.isSystem && mode === "edit" ? "Vai trò hệ thống" : "Vai trò tuỳ chỉnh"}</span>
        </div>
        <form onSubmit={handleSubmit} className="rbac-role-form" aria-disabled={readOnly}>
          <div className="rbac-form-grid">
            <label>
              Tên vai trò
              <input value={form.name} onChange={(event) => changeField("name", event.target.value)} disabled={readOnly} required />
            </label>
            <label>
              Mã vai trò
              <input value={form.slug} onChange={(event) => changeField("slug", event.target.value)} disabled={readOnly || mode === "edit"} required />
            </label>
            <label>
              Bộ phận
              <select value={form.department} onChange={(event) => changeField("department", event.target.value)} disabled={readOnly}>
                <option value="">Không giới hạn</option>
                {departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
            </label>
            <label>
              Nhóm vai trò
              <select value={form.parentRoleId} onChange={(event) => changeField("parentRoleId", event.target.value)} disabled={readOnly} required>
                <option value="">Chọn nhóm vai trò</option>
                {parentRoles.map((parentRole) => <option key={parentRole.id} value={parentRole.id}>{roleLabel(parentRole)} · {parentRole.slug}</option>)}
              </select>
            </label>
          </div>
          <label>
            Mô tả
            <textarea value={form.description} onChange={(event) => changeField("description", event.target.value)} disabled={readOnly} rows={3} />
          </label>

          <div className="rbac-permission-checklist">
            <h4>Quyền hạn gán trực tiếp</h4>
            {Object.entries(permissionsByGroup || {}).map(([group, permissions]) => (
              <fieldset key={group} disabled={readOnly}>
                <legend>{group}</legend>
                {permissions.map((permission) => (
                  <label key={permission.id} className="rbac-checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.permissionIds.includes(permission.id)}
                      onChange={() => togglePermission(permission.id)}
                    />
                    <span><strong>{permission.code}</strong><small>{permission.name || permission.description}</small></span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>

          <div className="rbac-permission-columns">
            <PermissionChipList title="Quyền kế thừa từ nhóm vai trò" permissions={selectedParentRole?.permissions || []} tone="inherited" />
            <PermissionChipList title="Quyền gán trực tiếp cho vai trò" permissions={directPermissions} tone="direct" />
            <PermissionChipList title="Quyền hiệu lực cuối cùng" permissions={effectivePermissions} />
          </div>

          <button type="submit" disabled={readOnly || saving || !form.name || !form.slug || !form.parentRoleId || (mode === "edit" && !selectedRole)}>
            {saving ? "Đang lưu..." : mode === "create" ? "Tạo vai trò" : "Lưu thay đổi"}
          </button>
        </form>
        {status ? <p className={`rbac-status rbac-status--${status.type}`}>{status.text}</p> : null}
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
  const [activeTab, setActiveTab] = useState("overview");
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
          <small>RBAC được kiểm tra bắt buộc ở backend; giao diện không bypass guard hoặc cấp thêm quyền cho manager.</small>
        </div>
        <button type="button" onClick={() => rbac.refetch()} disabled={rbac.loading}>Làm mới</button>
      </header>

      {rbac.error ? (
        <div className="rbac-status rbac-status--error">
          {getGraphQLErrorMessage(rbac.error, "Không tải được dữ liệu phân quyền. Vui lòng thử lại sau.")}
        </div>
      ) : null}
      {rbac.loading ? <div className="rbac-status">Đang tải dữ liệu phân quyền...</div> : null}

      <nav className="rbac-tabs" aria-label="Quản lý phân quyền">
        <button type="button" className={activeTab === "overview" ? "is-active" : ""} onClick={() => setActiveTab("overview")}>Tổng quan phân quyền</button>
        <button type="button" className={activeTab === "assignment" ? "is-active" : ""} onClick={() => setActiveTab("assignment")}>Gán vai trò nhân viên</button>
        <button type="button" className={activeTab === "roles" ? "is-active" : ""} onClick={() => setActiveTab("roles")}>Quản lý vai trò</button>
      </nav>

      {activeTab === "overview" ? (
        <>
          <RoleExplorer
            roles={rbac.roles}
            selectedRoleId={rbac.selectedRoleId}
            onSelectRole={rbac.setSelectedRoleId}
            selectedRole={rbac.selectedRole}
          />
          <PermissionGroups groups={rbac.permissionsByGroup} />
        </>
      ) : null}

      {activeTab === "assignment" ? (
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
      ) : null}

      {activeTab === "roles" ? (
        <RoleManagement
          roles={rbac.roles}
          parentRoles={rbac.parentRoles}
          permissionsByGroup={rbac.permissionsByGroup}
          selectedRole={rbac.selectedRole}
          selectedRoleId={rbac.selectedRoleId}
          onSelectRole={rbac.setSelectedRoleId}
          createRole={rbac.createRole}
          updateRole={rbac.updateRole}
          saving={rbac.creatingRole || rbac.updatingRole}
          isAdmin={isAdmin}
        />
      ) : null}
    </div>
  );
}
