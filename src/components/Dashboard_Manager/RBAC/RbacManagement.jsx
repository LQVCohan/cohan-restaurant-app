import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  FileClock,
  KeyRound,
  ListChecks,
  Lock,
  RefreshCw,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import { useRbacManagement } from "@/hooks/useRbacManagement";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import RbacAuditLogPanel from "./RbacAuditLogPanel";
import { hasAnyPermission, hasPermission, NO_PERMISSION_MESSAGE } from "@/utils/frontendPermissionAccess";
import "./RbacManagement.scss";

const roleLabel = (role) => role?.name || role?.slug || "Chưa có vai trò";
const permissionLabel = (permission) => permission?.code || permission?.name || permission?.id;
const protectedRoleSlugs = new Set(["admin", "manager", "hr", "accountant"]);
const departmentOptions = ["service", "kitchen", "cashier", "management", "cleaning", "delivery", "inventory", "bar"];
const auditPermissions = ["role.read", "permission.read", "staff.write"];

const emptyRoleForm = { name: "", slug: "", description: "", department: "", parentRoleId: "", permissionIds: [] };
const normalizeSlug = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "-");

const getGraphQLErrorMessage = (error, fallback) => {
  const code = error?.graphQLErrors?.[0]?.extensions?.code || error?.networkError?.result?.errors?.[0]?.extensions?.code;
  if (code === "FORBIDDEN") return "Bạn không có quyền thực hiện thao tác này.";
  return error?.graphQLErrors?.[0]?.message || error?.networkError?.result?.errors?.[0]?.message || error?.message || fallback;
};

function PermissionChipList({ title, permissions = [], tone = "permission" }) {
  return (
    <div className="rbac-permission-summary">
      <h4>{title}</h4>
      {permissions.length ? (
        <div className="rbac-chip-list">
          {permissions.map((permission) => <span key={permission.id || permission.code} className={`rbac-chip rbac-chip--${tone}`}>{permissionLabel(permission)}</span>)}
        </div>
      ) : <p className="rbac-empty">Chưa có quyền hạn.</p>}
    </div>
  );
}

function PermissionGroups({ groups }) {
  const entries = Object.entries(groups || {});
  const totalPermissions = entries.reduce((total, [, permissions]) => total + permissions.length, 0);

  return (
    <section className="rbac-card rbac-permission-catalog">
      <div className="rbac-card__header">
        <div>
          <span className="rbac-section-kicker">Danh mục hệ thống</span>
          <h3>Danh mục quyền hạn</h3>
          <p>Quyền được nhóm theo nghiệp vụ để dễ kiểm tra phạm vi truy cập.</p>
        </div>
        <span className="rbac-count-pill">{totalPermissions} quyền hạn</span>
      </div>
      {!entries.length ? <p className="rbac-empty">Chưa có quyền hạn để hiển thị.</p> : null}
      <div className="rbac-permission-groups">
        {entries.map(([group, permissions]) => (
          <section key={group} className="rbac-permission-group">
            <div className="rbac-permission-group__title">
              <h4>{group}</h4>
              <span>{permissions.length}</span>
            </div>
            <div className="rbac-chip-list">
              {permissions.map((permission) => (
                <span key={permission.id} className="rbac-chip" title={permission.description || permission.name}>
                  <strong>{permission.code}</strong><small>{permission.action} · {permission.resource}</small>
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function RoleBadge({ role }) {
  const isSystem = Boolean(role?.isSystem);
  return <span className={`rbac-role-badge ${isSystem ? "is-system" : "is-custom"}`}>{isSystem ? "Hệ thống" : "Tuỳ chỉnh"}</span>;
}

function RoleExplorer({ roles, selectedRoleId, onSelectRole, selectedRole }) {
  return (
    <div className="rbac-grid rbac-grid--roles">
      <section className="rbac-card">
        <div className="rbac-card__header">
          <div>
            <span className="rbac-section-kicker">Role library</span>
            <h3>Danh sách vai trò</h3>
            <p>Chọn một vai trò để xem quyền kế thừa và quyền hiệu lực.</p>
          </div>
          <span className="rbac-count-pill">{roles.length} vai trò</span>
        </div>
        <div className="rbac-role-list">
          {roles.map((role) => (
            <button key={role.id} type="button" className={`rbac-role-row ${selectedRoleId === role.id ? "is-active" : ""}`} onClick={() => onSelectRole(role.id)}>
              <span className="rbac-role-row__top"><strong>{roleLabel(role)}</strong><RoleBadge role={role} /></span>
              <span className="rbac-role-row__meta">{role.slug}</span>
              <small>{role.department || "Không giới hạn bộ phận"}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="rbac-card rbac-card--permission-detail">
        <div className="rbac-card__header">
          <div>
            <span className="rbac-section-kicker">Effective access</span>
            <h3>Quyền hiệu lực của vai trò</h3>
            <p>Tổng hợp quyền kế thừa và quyền gán trực tiếp.</p>
          </div>
          <span className="rbac-count-pill">{selectedRole?.permissions?.length || 0} quyền hạn</span>
        </div>
        {selectedRole ? (
          <>
            <div className="rbac-selected-role">
              <div>
                <h4>{roleLabel(selectedRole)}</h4>
                <p>{selectedRole.description || "Vai trò chưa có mô tả."}</p>
              </div>
              <span>Nhóm vai trò: {selectedRole.parentRole?.name || selectedRole.parentRole?.slug || "Không có"}</span>
            </div>
            <div className="rbac-permission-columns">
              <PermissionChipList title="Quyền kế thừa từ nhóm vai trò" permissions={selectedRole.parentRole?.permissions || []} tone="inherited" />
              <PermissionChipList title="Quyền gán trực tiếp cho vai trò" permissions={selectedRole.directPermissions || []} tone="direct" />
              <PermissionChipList title="Quyền hiệu lực cuối cùng" permissions={selectedRole.permissions || []} />
            </div>
          </>
        ) : <p className="rbac-empty">Chọn vai trò để xem quyền hiệu lực.</p>}
      </section>
    </div>
  );
}

function RoleManagement({ roles, parentRoles, permissionsByGroup, selectedRole, selectedRoleId, onSelectRole, createRole, updateRole, saving, canWriteRoles }) {
  const [mode, setMode] = useState("edit");
  const [form, setForm] = useState(emptyRoleForm);
  const [status, setStatus] = useState(null);
  const readOnly = !canWriteRoles;
  const selectedRoleSlug = String(selectedRole?.slug || "").toLowerCase();
  const isProtectedSelectedRole = mode === "edit" && selectedRole && (selectedRole.isSystem || protectedRoleSlugs.has(selectedRoleSlug));
  const formLocked = readOnly || Boolean(isProtectedSelectedRole);

  useEffect(() => {
    if (mode !== "edit" || !selectedRole) return;
    setForm((current) => {
      const next = {
        name: selectedRole.name || "",
        slug: selectedRole.slug || "",
        description: selectedRole.description || "",
        department: selectedRole.department || "",
        parentRoleId: selectedRole.parentRole?.id || "",
        permissionIds: (selectedRole.directPermissions || []).map((permission) => permission.id),
      };
      return JSON.stringify(current) === JSON.stringify(next) ? current : next;
    });
    setStatus((current) => (current === null ? current : null));
  }, [mode, selectedRole?.id, selectedRole?.name, selectedRole?.slug, selectedRole?.description, selectedRole?.department, selectedRole?.parentRole?.id, selectedRole?.directPermissions]);

  const directPermissions = useMemo(() => {
    const directIds = new Set(form.permissionIds);
    return Object.values(permissionsByGroup || {}).flat().filter((permission) => directIds.has(permission.id));
  }, [form.permissionIds, permissionsByGroup]);

  const selectedParentRole = parentRoles.find((parentRole) => parentRole.id === form.parentRoleId) || null;
  const effectivePermissions = useMemo(() => {
    const map = new Map();
    for (const permission of selectedParentRole?.permissions || []) map.set(permission.id || permission.code, permission);
    for (const permission of directPermissions) map.set(permission.id || permission.code, permission);
    return Array.from(map.values());
  }, [directPermissions, selectedParentRole]);

  const changeField = (field, value) => setForm((current) => ({ ...current, [field]: field === "slug" ? normalizeSlug(value) : value }));
  const togglePermission = (permissionId) => setForm((current) => {
    const selected = new Set(current.permissionIds);
    if (selected.has(permissionId)) selected.delete(permissionId);
    else selected.add(permissionId);
    return { ...current, permissionIds: Array.from(selected) };
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (formLocked || saving) return;
    setStatus(null);
    const input = { name: form.name.trim(), description: form.description.trim() || null, department: form.department || null, parentRoleId: form.parentRoleId, permissionIds: form.permissionIds };
    try {
      if (mode === "create") {
        const result = await createRole({ variables: { input: { ...input, slug: normalizeSlug(form.slug) } } });
        const createdId = result?.data?.createRole?.id;
        if (createdId) onSelectRole(createdId);
        setMode("edit");
        setStatus({ type: "success", text: "Đã tạo vai trò mới." });
      } else if (selectedRole) {
        await updateRole({ variables: { input: { id: selectedRole.id, ...input } } });
        setStatus({ type: "success", text: "Đã cập nhật vai trò và quyền hạn." });
      }
    } catch (error) {
      setStatus({ type: "error", text: getGraphQLErrorMessage(error, "Không thể lưu vai trò.") });
    }
  };

  return (
    <div className="rbac-grid rbac-grid--management">
      <section className="rbac-card">
        <div className="rbac-card__header">
          <div>
            <span className="rbac-section-kicker">Role builder</span>
            <h3>Quản lý vai trò</h3>
            <p>Tạo hoặc chỉnh sửa bộ quyền theo từng bộ phận vận hành.</p>
          </div>
          <span className="rbac-count-pill">{readOnly ? "Chỉ xem" : "Có quyền ghi"}</span>
        </div>
        {readOnly ? <p className="rbac-status rbac-status--warning">{NO_PERMISSION_MESSAGE}</p> : null}
        {isProtectedSelectedRole ? <p className="rbac-status rbac-status--warning">Vai trò hệ thống chỉ được xem, không được chỉnh sửa.</p> : null}
        <div className="rbac-action-row">
          <button type="button" onClick={() => { setMode("edit"); setStatus(null); }} className={mode === "edit" ? "is-active" : ""}>Sửa vai trò đang chọn</button>
          <button type="button" onClick={() => { if (!canWriteRoles) return; setMode("create"); setForm(emptyRoleForm); setStatus(null); }} className={mode === "create" ? "is-active" : ""} disabled={readOnly}>Tạo vai trò mới</button>
        </div>
        <div className="rbac-role-list rbac-role-list--compact">
          {roles.map((role) => <button key={role.id} type="button" className={`rbac-role-row ${selectedRoleId === role.id ? "is-active" : ""}`} onClick={() => { onSelectRole(role.id); setMode("edit"); }}><span className="rbac-role-row__top"><strong>{roleLabel(role)}</strong><RoleBadge role={role} /></span><span className="rbac-role-row__meta">{role.slug}</span></button>)}
        </div>
      </section>
      <section className="rbac-card rbac-card--form">
        <div className="rbac-card__header">
          <div>
            <span className="rbac-section-kicker">Role details</span>
            <h3>{mode === "create" ? "Tạo vai trò mới" : "Sửa vai trò"}</h3>
            <p>Thiết lập thông tin cơ bản, nhóm kế thừa và quyền gán trực tiếp.</p>
          </div>
          <span className="rbac-count-pill">{selectedRole?.isSystem && mode === "edit" ? "Vai trò hệ thống" : "Vai trò tuỳ chỉnh"}</span>
        </div>
        <form onSubmit={handleSubmit} className="rbac-role-form" aria-disabled={formLocked}>
          <div className="rbac-form-grid">
            <label>Tên vai trò<input value={form.name} onChange={(event) => changeField("name", event.target.value)} disabled={formLocked} required /></label>
            <label>Mã vai trò<input value={form.slug} onChange={(event) => changeField("slug", event.target.value)} disabled={formLocked || mode === "edit"} required /></label>
            <label>Bộ phận<select value={form.department} onChange={(event) => changeField("department", event.target.value)} disabled={formLocked}><option value="">Không giới hạn</option>{departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
            <label>Nhóm vai trò<select value={form.parentRoleId} onChange={(event) => changeField("parentRoleId", event.target.value)} disabled={formLocked} required><option value="">Chọn nhóm vai trò</option>{parentRoles.map((parentRole) => <option key={parentRole.id} value={parentRole.id}>{roleLabel(parentRole)} · {parentRole.slug}</option>)}</select></label>
          </div>
          <label>Mô tả<textarea value={form.description} onChange={(event) => changeField("description", event.target.value)} disabled={formLocked} rows={3} /></label>
          <div className="rbac-permission-checklist"><h4>Quyền hạn gán trực tiếp</h4>{Object.entries(permissionsByGroup || {}).map(([group, permissions]) => <fieldset key={group} disabled={formLocked}><legend>{group}</legend>{permissions.map((permission) => <label key={permission.id} className="rbac-checkbox-row"><input type="checkbox" checked={form.permissionIds.includes(permission.id)} onChange={() => togglePermission(permission.id)} /><span><strong>{permission.code}</strong><small>{permission.name || permission.description}</small></span></label>)}</fieldset>)}</div>
          <div className="rbac-permission-columns"><PermissionChipList title="Quyền kế thừa từ nhóm vai trò" permissions={selectedParentRole?.permissions || []} tone="inherited" /><PermissionChipList title="Quyền gán trực tiếp cho vai trò" permissions={directPermissions} tone="direct" /><PermissionChipList title="Quyền hiệu lực cuối cùng" permissions={effectivePermissions} /></div>
          <button type="submit" disabled={formLocked || saving || !form.name || !form.slug || !form.parentRoleId || (mode === "edit" && !selectedRole)}>{saving ? "Đang lưu..." : mode === "create" ? "Tạo vai trò" : "Lưu thay đổi"}</button>
        </form>
        {status ? <p className={`rbac-status rbac-status--${status.type}`} role="status" aria-live="polite">{status.text}</p> : null}
      </section>
    </div>
  );
}

function StaffRoleAssignment({ restaurants, roles, staff, selectedRestaurantId, setSelectedRestaurantId, assignStaffRole, assigning, staffListEnabled, canAssignRole }) {
  const [staffUserId, setStaffUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState(null);
  const assignableRoles = useMemo(() => roles.filter((role) => !protectedRoleSlugs.has(String(role.slug || "").toLowerCase())), [roles]);
  const selectedRestaurant = useMemo(() => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) || null, [restaurants, selectedRestaurantId]);
  const selectedStaff = useMemo(() => staff.find((member) => member.id === staffUserId) || null, [staff, staffUserId]);
  const selectedRole = useMemo(() => assignableRoles.find((role) => role.id === roleId) || null, [assignableRoles, roleId]);

  useEffect(() => {
    setStaffUserId((current) => (current ? "" : current));
    setRoleId((current) => (current ? "" : current));
    setStatus((current) => (current === null ? current : null));
  }, [selectedRestaurantId]);

  const formDisabled = assigning || !canAssignRole || !selectedRestaurantId || !staff.length || !assignableRoles.length;
  const disabledReason = !canAssignRole
    ? NO_PERMISSION_MESSAGE
    : !restaurants.length
      ? "Chưa có nhà hàng để gán vai trò."
      : !selectedRestaurantId
        ? "Chọn nhà hàng trước khi gán vai trò cho nhân viên."
        : selectedRestaurantId && staffListEnabled && !staff.length
          ? "Nhà hàng này chưa có nhân viên để gán vai trò."
          : !assignableRoles.length
            ? "Chưa có vai trò phù hợp để gán."
            : "Chọn đủ nhân viên và vai trò để lưu thay đổi.";

  const assignmentSteps = [
    { label: "Nhà hàng", done: Boolean(selectedRestaurant), value: selectedRestaurant?.name || "Chưa chọn" },
    { label: "Nhân viên", done: Boolean(selectedStaff), value: selectedStaff?.fullName || "Chưa chọn" },
    { label: "Vai trò mới", done: Boolean(selectedRole), value: roleLabel(selectedRole) },
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (formDisabled || !staffUserId || !roleId) return;
    setStatus(null);
    try {
      await assignStaffRole({ variables: { input: { staffUserId, roleId, restaurantId: selectedRestaurantId } } });
      setStatus({ type: "success", text: "Đã gán vai trò cho nhân viên." });
    } catch (error) {
      setStatus({ type: "error", text: getGraphQLErrorMessage(error, "Không thể gán vai trò.") });
    }
  };

  return (
    <section className="rbac-card rbac-assignment">
      <div className="rbac-card__header">
        <div>
          <span className="rbac-section-kicker">Staff access</span>
          <h3>Gán vai trò cho nhân viên</h3>
          <p>Chọn nhà hàng, nhân viên và vai trò phù hợp để cập nhật quyền truy cập.</p>
        </div>
        <span className="rbac-count-pill">{assignableRoles.length} vai trò có thể gán</span>
      </div>

      {!canAssignRole ? <p className="rbac-status rbac-status--warning">{NO_PERMISSION_MESSAGE}</p> : null}
      {!restaurants.length ? <p className="rbac-status rbac-status--warning">Chưa có nhà hàng để gán vai trò.</p> : null}
      {restaurants.length && !selectedRestaurantId ? <p className="rbac-status rbac-status--info">Chọn nhà hàng trước khi gán vai trò cho nhân viên.</p> : null}
      {selectedRestaurantId && staffListEnabled && !staff.length ? <p className="rbac-status rbac-status--info">Nhà hàng này chưa có nhân viên để gán vai trò.</p> : null}

      <div className="rbac-assignment__layout">
        <form onSubmit={handleSubmit} className="rbac-form rbac-form--assignment" aria-disabled={formDisabled}>
          <label>Nhà hàng<select value={selectedRestaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)} required disabled={!restaurants.length}><option value="">Chọn nhà hàng</option>{restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label>
          <label>Nhân viên<select value={staffUserId} onChange={(event) => setStaffUserId(event.target.value)} required disabled={!canAssignRole || !selectedRestaurantId || !staff.length}><option value="">Chọn nhân viên</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.fullName} {member.role?.slug ? `(${member.role.slug})` : ""}</option>)}</select></label>
          <label>Vai trò mới<select value={roleId} onChange={(event) => setRoleId(event.target.value)} required disabled={!canAssignRole || !selectedRestaurantId || !assignableRoles.length}><option value="">Chọn vai trò</option>{assignableRoles.map((role) => <option key={role.id} value={role.id}>{roleLabel(role)} · {role.slug}</option>)}</select></label>
          <button type="submit" disabled={formDisabled || !staffUserId || !roleId}>{assigning ? "Đang gán vai trò..." : "Gán vai trò"}</button>
          <small className="rbac-form__hint">{formDisabled || !staffUserId || !roleId ? disabledReason : "Hệ thống sẽ xác thực quyền trước khi lưu thay đổi."}</small>
        </form>

        <aside className="rbac-assignment-preview" aria-label="Tóm tắt thay đổi phân quyền">
          <div className="rbac-assignment-preview__icon"><UserCog size={22} /></div>
          <h4>{selectedStaff && selectedRole ? "Sẵn sàng cập nhật" : "Tóm tắt thay đổi"}</h4>
          <p>{selectedStaff && selectedRole ? "Kiểm tra lại thông tin trước khi gán vai trò." : "Hoàn tất 3 bước để xem bản xem trước quyền truy cập."}</p>
          <div className="rbac-assignment-steps">
            {assignmentSteps.map((step) => (
              <div key={step.label} className={`rbac-assignment-step ${step.done ? "is-done" : ""}`}>
                <span>{step.done ? <CheckCircle2 size={15} /> : <span className="rbac-assignment-step__dot" />}</span>
                <div><strong>{step.label}</strong><small>{step.value}</small></div>
              </div>
            ))}
          </div>
          {selectedStaff && selectedRole ? (
            <div className="rbac-assignment-preview__summary">
              <span>Vai trò hiện tại</span><strong>{selectedStaff.role?.name || selectedStaff.role?.slug || "Chưa có vai trò"}</strong>
              <span>Vai trò mới</span><strong>{roleLabel(selectedRole)}</strong>
            </div>
          ) : null}
        </aside>
      </div>

      {status ? <p className={`rbac-status rbac-status--${status.type}`} role="status" aria-live="polite">{status.text}</p> : null}
      <p className="rbac-note">Quyền truy cập được xác thực lại ở hệ thống trước khi áp dụng.</p>
    </section>
  );
}

export default function RbacManagement() {
  const { user } = useContext(AuthContext);
  const canViewRbac = hasAnyPermission(user, auditPermissions);
  const canViewAuditLogs = hasAnyPermission(user, auditPermissions);
  const canWriteRoles = hasAnyPermission(user, ["role.write", "permission.write"]);
  const canAssignRole = hasPermission(user, "staff.write");
  const canSeeAllRestaurants = hasPermission(user, "*") || hasPermission(user, "system.manage");
  const canViewGlobalAuditLogs = canSeeAllRestaurants;
  const [activeTab, setActiveTab] = useState("overview");
  const {
    restaurantOptions: baseRestaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
  } = useManagerRestaurantSelection();
  const rbac = useRbacManagement(selectedRestaurantId, { includeAllRestaurants: canSeeAllRestaurants, canViewGlobalAuditLogs, skipAuditLogs: !canViewAuditLogs });

  const restaurantOptions = useMemo(() => {
    const map = new Map();

    for (const restaurant of baseRestaurantOptions || []) {
      const id = String(restaurant?.id || restaurant?._id || "");
      if (id) map.set(id, { ...restaurant, id, name: restaurant?.name || "Nhà hàng chưa đặt tên" });
    }

    if (canSeeAllRestaurants && Array.isArray(rbac.allRestaurants)) {
      for (const restaurant of rbac.allRestaurants) {
        const id = String(restaurant?.id || restaurant?._id || "");
        if (id && !map.has(id)) {
          map.set(id, { ...restaurant, id, name: restaurant?.name || "Nhà hàng chưa đặt tên" });
        }
      }
    }

    return Array.from(map.values());
  }, [baseRestaurantOptions, canSeeAllRestaurants, rbac.allRestaurants]);

  useEffect(() => {
    setSelectedRestaurantId((currentId) => {
      if (!restaurantOptions.length) return "";
      if (
        currentId &&
        restaurantOptions.some((restaurant) => restaurant.id === currentId)
      ) {
        return currentId;
      }
      return restaurantOptions[0].id;
    });
  }, [restaurantOptions, setSelectedRestaurantId]);

  useEffect(() => {
    if (activeTab === "audit" && !canViewAuditLogs) {
      setActiveTab("overview");
    }
  }, [activeTab, canViewAuditLogs]);

  if (!canViewRbac) return <div className="rbac-page"><p className="rbac-empty">Bạn không có quyền xem màn hình phân quyền nhân viên.</p></div>;

  return (
    <div className="rbac-page">
      <ManagementPageHeader
        density="compact"
        eyebrow="Bảo mật vận hành"
        title="Phân quyền nhân viên"
        subtitle="Quản lý vai trò, quyền hạn và phạm vi truy cập của nhân viên theo từng nhà hàng."
        icon={<ShieldCheck size={24} strokeWidth={2.2} />}
        selectedRestaurant={selectedRestaurantId}
        onRestaurantChange={setSelectedRestaurantId}
        restaurantList={restaurantOptions}
        restaurantDisabled={restaurantsLoading || !restaurantOptions.length}
        restaurantPlaceholder={restaurantsLoading ? "Đang tải nhà hàng..." : "Chọn nhà hàng"}
        stats={[
          { label: "Vai trò", value: rbac.roles.length, icon: <KeyRound size={18} />, tone: "warning" },
          { label: "Nhân viên", value: rbac.staff.length, icon: <Users size={18} />, tone: "success" },
        ]}
        secondaryActions={[{ label: "Làm mới", icon: <RefreshCw size={16} />, onClick: () => rbac.refetch(), disabled: rbac.loading, loading: rbac.loading }]}
        footerLeft={<small>Quyền truy cập được xác thực lại ở hệ thống trước khi áp dụng.</small>}
        showTimeWidget={false}
      />
      {rbac.error ? <div className="rbac-status rbac-status--error">{getGraphQLErrorMessage(rbac.error, "Không tải được dữ liệu phân quyền.")}</div> : null}
      {rbac.loading ? <div className="rbac-status">Đang tải dữ liệu phân quyền...</div> : null}
      <nav className="rbac-tabs" aria-label="Quản lý phân quyền">
        <button type="button" className={activeTab === "overview" ? "is-active" : ""} onClick={() => setActiveTab("overview")}><ListChecks size={16} />Tổng quan phân quyền</button>
        <button type="button" className={activeTab === "assignment" ? "is-active" : ""} onClick={() => setActiveTab("assignment")}><UserCog size={16} />Gán vai trò nhân viên</button>
        <button type="button" className={activeTab === "roles" ? "is-active" : ""} onClick={() => setActiveTab("roles")}><Lock size={16} />Quản lý vai trò</button>
        {canViewAuditLogs ? <button type="button" className={activeTab === "audit" ? "is-active" : ""} onClick={() => setActiveTab("audit")}><FileClock size={16} />Nhật ký phân quyền</button> : null}
      </nav>
      {activeTab === "overview" ? <><RoleExplorer roles={rbac.roles} selectedRoleId={rbac.selectedRoleId} onSelectRole={rbac.setSelectedRoleId} selectedRole={rbac.selectedRole} /><PermissionGroups groups={rbac.permissionsByGroup} /></> : null}
      {activeTab === "assignment" ? <StaffRoleAssignment restaurants={restaurantOptions} roles={rbac.roles} staff={rbac.staff} selectedRestaurantId={selectedRestaurantId} setSelectedRestaurantId={setSelectedRestaurantId} assignStaffRole={rbac.assignStaffRole} assigning={rbac.assigning} staffListEnabled={rbac.includeStaffList} canAssignRole={canAssignRole} /> : null}
      {activeTab === "roles" ? <RoleManagement roles={rbac.roles} parentRoles={rbac.parentRoles} permissionsByGroup={rbac.permissionsByGroup} selectedRole={rbac.selectedRole} selectedRoleId={rbac.selectedRoleId} onSelectRole={rbac.setSelectedRoleId} createRole={rbac.createRole} updateRole={rbac.updateRole} saving={rbac.creatingRole || rbac.updatingRole} canWriteRoles={canWriteRoles} /> : null}
      {activeTab === "audit" && canViewAuditLogs ? <RbacAuditLogPanel auditLogs={rbac.auditLogs} loading={rbac.auditLogsLoading} error={rbac.auditLogsError} filters={rbac.auditLogFilters} setFilters={rbac.setAuditLogFilters} refetch={rbac.refetchAuditLogs} restaurants={restaurantOptions} selectedRestaurantId={selectedRestaurantId} setSelectedRestaurantId={setSelectedRestaurantId} canViewGlobalAuditLogs={canViewGlobalAuditLogs} auditLogsSkipped={rbac.auditLogsSkipped} /> : null}
    </div>
  );
}
