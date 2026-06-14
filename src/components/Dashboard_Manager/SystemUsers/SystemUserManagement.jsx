import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCog,
  Users,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import useUserManagement from "@/hooks/useUserManagement";
import { isAdminRole } from "@/utils/frontendRoleAccess";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import "./SystemUserManagement.scss";

const STAFF_ROLE_SLUGS = new Set([
  "staff",
  "server",
  "supervisor",
  "host",
  "cashier",
  "chef",
  "cook",
  "kitchen_helper",
  "cleaner",
  "shipper",
  "storekeeper",
  "bartender",
]);

const FALLBACK_SYSTEM_ROLE_SLUGS = new Set(["admin", "manager", "hr", "accountant"]);
const STATUS_OPTIONS = ["active", "pending", "inactive", "blocked"];

const normalize = (value) => String(value || "").trim().toLowerCase();
const roleLabel = (role) => role?.name || role?.slug || "Chưa có vai trò";
const userDisplayName = (user) => user?.fullName || user?.username || user?.email || "Người dùng hệ thống";

const statusLabels = {
  active: "Đang hoạt động",
  pending: "Chờ xác minh",
  inactive: "Tạm ngưng",
  blocked: "Đã khóa",
};

const statusTones = {
  active: "success",
  pending: "warning",
  inactive: "muted",
  blocked: "danger",
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
};

const getRoleSlug = (role) => normalize(role?.slug || role?.name);
const hasStaffParentRole = (role) => normalize(role?.parentRole?.slug || role?.parentRole?.name) === "staff";

const isSystemManagedRole = (role) => {
  const slug = getRoleSlug(role);
  if (!slug || slug === "customer" || STAFF_ROLE_SLUGS.has(slug)) return false;
  if (hasStaffParentRole(role)) return false;
  return true;
};

const getGraphQLErrorMessage = (error, fallback) => {
  const graphMessage = error?.graphQLErrors?.[0]?.message;
  const networkMessage = error?.networkError?.result?.errors?.[0]?.message;
  return graphMessage || networkMessage || error?.message || fallback;
};

const exportUsersToCsv = (users) => {
  const headers = ["ID", "Họ tên", "Email", "SĐT", "Vai trò", "Trạng thái", "Email verified", "Phone verified", "Last login", "Created at"];
  const rows = users.map((user) => [
    user.id,
    userDisplayName(user),
    user.email || "",
    user.phone || "",
    roleLabel(user.role),
    statusLabels[normalize(user.status)] || user.status || "",
    user.emailVerified ? "Yes" : "No",
    user.phoneVerified ? "Yes" : "No",
    user.lastLoginAt || "",
    user.createdAt || "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `system-users-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

function SystemUserEditPanel({ user, roles, form, setForm, onSave, onClose, saving }) {
  if (!user) {
    return (
      <aside className="system-users-panel system-users-panel--empty">
        <div className="system-users-panel__empty-icon"><UserCog size={28} /></div>
        <h3>Chọn một tài khoản</h3>
        <p>Chọn admin, manager hoặc tài khoản cấp hệ thống để xem chi tiết, đổi vai trò hoặc khóa/mở khóa.</p>
      </aside>
    );
  }

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <aside className="system-users-panel" aria-label="Chi tiết tài khoản hệ thống">
      <div className="system-users-panel__header">
        <div>
          <span>Chi tiết tài khoản</span>
          <h3>{userDisplayName(user)}</h3>
          <p>{user.email || user.phone || "Chưa có thông tin liên hệ"}</p>
        </div>
        <button type="button" onClick={onClose}>Đóng</button>
      </div>

      <form className="system-users-form" onSubmit={onSave}>
        <label>
          Họ tên
          <input value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} required />
        </label>
        <label>
          Username
          <input value={form.username} onChange={(event) => setField("username", event.target.value)} placeholder="Tùy chọn" />
        </label>
        <label>
          Email
          <input value={form.email} onChange={(event) => setField("email", event.target.value)} placeholder="email@domain.com" />
        </label>
        <label>
          Số điện thoại
          <input value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="09xxxxxxxx" />
        </label>
        <div className="system-users-form__grid">
          <label>
            Vai trò hệ thống
            <select value={form.roleId} onChange={(event) => setField("roleId", event.target.value)} required>
              <option value="">Chọn vai trò</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{roleLabel(role)}</option>)}
            </select>
          </label>
          <label>
            Trạng thái
            <select value={form.status} onChange={(event) => setField("status", event.target.value)} required>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </label>
        </div>
        <div className="system-users-verification-box">
          <span className={user.emailVerified ? "is-ok" : "is-warn"}>{user.emailVerified ? "Email đã xác minh" : "Email chưa xác minh"}</span>
          <span className={user.phoneVerified ? "is-ok" : "is-warn"}>{user.phoneVerified ? "SĐT đã xác minh" : "SĐT chưa xác minh"}</span>
          <small>Last login: {formatDateTime(user.lastLoginAt)}</small>
        </div>
        <button type="submit" disabled={saving || !form.fullName.trim() || !form.roleId}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</button>
      </form>
    </aside>
  );
}

export default function SystemUserManagement() {
  const { user: currentUser } = useContext(AuthContext) || {};
  const isAdmin = isAdminRole(currentUser);
  const userManagement = useUserManagement();
  const {
    users,
    roleList,
    loading,
    error,
    getAllUsers,
    adminUpdateUser,
    setUserStatus,
    softDeleteUser,
  } = userManagement;

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectedUserId, setSelectedUserId] = useState("");
  const [form, setForm] = useState({ fullName: "", username: "", email: "", phone: "", roleId: "", status: "active" });
  const [notice, setNotice] = useState(null);

  const systemRoles = useMemo(() => {
    const roles = (roleList || []).filter(isSystemManagedRole);
    if (roles.length) return roles;
    return (roleList || []).filter((role) => FALLBACK_SYSTEM_ROLE_SLUGS.has(getRoleSlug(role)));
  }, [roleList]);

  const roleById = useMemo(() => new Map((roleList || []).map((role) => [String(role.id), role])), [roleList]);
  const roleBySlug = useMemo(() => new Map((roleList || []).map((role) => [getRoleSlug(role), role])), [roleList]);
  const systemRoleSlugs = useMemo(() => new Set(systemRoles.map(getRoleSlug).filter(Boolean)), [systemRoles]);

  const resolveFullRole = (targetUser) => {
    const byId = targetUser?.role?.id ? roleById.get(String(targetUser.role.id)) : null;
    const slug = normalize(targetUser?.role?.slug || targetUser?.roleName);
    return byId || roleBySlug.get(slug) || targetUser?.role || null;
  };

  const systemUsers = useMemo(() => {
    return (users || []).filter((targetUser) => {
      const role = resolveFullRole(targetUser);
      const slug = getRoleSlug(role) || normalize(targetUser?.roleName);
      if (!slug || slug === "customer" || STAFF_ROLE_SLUGS.has(slug)) return false;
      if (systemRoleSlugs.size) return systemRoleSlugs.has(slug);
      return FALLBACK_SYSTEM_ROLE_SLUGS.has(slug) || !hasStaffParentRole(role);
    });
  }, [users, roleById, roleBySlug, systemRoleSlugs]);

  const filteredUsers = useMemo(() => {
    return systemUsers.filter((targetUser) => {
      const role = resolveFullRole(targetUser);
      const roleSlug = getRoleSlug(role) || normalize(targetUser?.roleName);
      const status = normalize(targetUser.status || "active");
      if (roleFilter !== "all" && roleSlug !== roleFilter) return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      return true;
    });
  }, [systemUsers, roleFilter, statusFilter, roleById, roleBySlug]);

  const selectedUser = useMemo(() => filteredUsers.find((targetUser) => targetUser.id === selectedUserId) || systemUsers.find((targetUser) => targetUser.id === selectedUserId) || null, [filteredUsers, selectedUserId, systemUsers]);
  const selectedUsers = useMemo(() => systemUsers.filter((targetUser) => selectedIds.has(targetUser.id)), [selectedIds, systemUsers]);

  const stats = useMemo(() => {
    const activeCount = systemUsers.filter((targetUser) => normalize(targetUser.status) === "active").length;
    const blockedCount = systemUsers.filter((targetUser) => normalize(targetUser.status) === "blocked").length;
    const pendingCount = systemUsers.filter((targetUser) => normalize(targetUser.status) === "pending").length;
    return [
      { label: "Tài khoản hệ thống", value: systemUsers.length, icon: "🛡️" },
      { label: "Đang hoạt động", value: activeCount, icon: "✅" },
      { label: "Khóa/chờ xử lý", value: blockedCount + pendingCount, icon: "🔒" },
      { label: "Vai trò được quản lý", value: systemRoles.length, icon: "🧩" },
    ];
  }, [systemUsers, systemRoles]);

  useEffect(() => {
    if (!isAdmin) return;
    const roleId = roleFilter !== "all" ? systemRoles.find((role) => getRoleSlug(role) === roleFilter)?.id : undefined;
    getAllUsers({ search: appliedSearch || undefined, roleId });
  }, [appliedSearch, getAllUsers, isAdmin, roleFilter, systemRoles]);

  useEffect(() => {
    if (!selectedUser) return;
    const role = resolveFullRole(selectedUser);
    setForm({
      fullName: selectedUser.fullName || "",
      username: selectedUser.username || "",
      email: selectedUser.email || "",
      phone: selectedUser.phone || "",
      roleId: role?.id || selectedUser.role?.id || "",
      status: normalize(selectedUser.status || "active"),
    });
  }, [selectedUser?.id, selectedUser?.updatedAt, roleById, roleBySlug]);

  useEffect(() => {
    setSelectedIds((current) => {
      const visible = new Set(filteredUsers.map((targetUser) => targetUser.id));
      const next = new Set([...current].filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [filteredUsers]);

  if (!isAdmin) {
    return (
      <main className="system-users-page">
        <section className="system-users-denied">
          <AlertTriangle size={28} />
          <h2>Chỉ Admin được truy cập</h2>
          <p>Màn hình này dùng để quản lý tài khoản hệ thống, không hiển thị cho Manager/Staff.</p>
        </section>
      </main>
    );
  }

  const applySearch = (event) => {
    event?.preventDefault?.();
    setAppliedSearch(searchInput.trim());
  };

  const refresh = () => getAllUsers({ search: appliedSearch || undefined, roleId: roleFilter !== "all" ? systemRoles.find((role) => getRoleSlug(role) === roleFilter)?.id : undefined });

  const toggleSelected = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const visibleIds = filteredUsers.map((targetUser) => targetUser.id);
      const allVisibleSelected = visibleIds.every((id) => current.has(id));
      const next = new Set(current);
      visibleIds.forEach((id) => {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const runSingleStatus = async (targetUser, status) => {
    const confirmText = status === "blocked" ? `Khóa tài khoản ${userDisplayName(targetUser)}?` : `Chuyển ${userDisplayName(targetUser)} sang trạng thái ${statusLabels[status]}?`;
    if (!window.confirm(confirmText)) return;
    setNotice(null);
    try {
      await setUserStatus(targetUser.id, status);
      setNotice({ type: "success", text: "Đã cập nhật trạng thái tài khoản." });
    } catch (actionError) {
      setNotice({ type: "error", text: getGraphQLErrorMessage(actionError, "Không thể cập nhật trạng thái.") });
    }
  };

  const runBatchStatus = async (status) => {
    if (!selectedUsers.length) return;
    if (!window.confirm(`Cập nhật ${selectedUsers.length} tài khoản sang trạng thái ${statusLabels[status]}?`)) return;
    setNotice(null);
    try {
      for (const targetUser of selectedUsers) await setUserStatus(targetUser.id, status);
      setSelectedIds(new Set());
      setNotice({ type: "success", text: `Đã cập nhật ${selectedUsers.length} tài khoản.` });
    } catch (actionError) {
      setNotice({ type: "error", text: getGraphQLErrorMessage(actionError, "Không thể cập nhật hàng loạt.") });
    }
  };

  const runSoftDelete = async (targetUser) => {
    if (!window.confirm(`Xóa mềm tài khoản ${userDisplayName(targetUser)}? Tài khoản sẽ chuyển sang trạng thái tạm ngưng.`)) return;
    setNotice(null);
    try {
      await softDeleteUser(targetUser.id);
      setNotice({ type: "success", text: "Đã xóa mềm tài khoản." });
    } catch (actionError) {
      setNotice({ type: "error", text: getGraphQLErrorMessage(actionError, "Không thể xóa mềm tài khoản.") });
    }
  };

  const runBatchSoftDelete = async () => {
    if (!selectedUsers.length) return;
    if (!window.confirm(`Xóa mềm ${selectedUsers.length} tài khoản đã chọn?`)) return;
    setNotice(null);
    try {
      for (const targetUser of selectedUsers) await softDeleteUser(targetUser.id);
      setSelectedIds(new Set());
      setNotice({ type: "success", text: `Đã xóa mềm ${selectedUsers.length} tài khoản.` });
    } catch (actionError) {
      setNotice({ type: "error", text: getGraphQLErrorMessage(actionError, "Không thể xóa mềm hàng loạt.") });
    }
  };

  const saveSelectedUser = async (event) => {
    event.preventDefault();
    if (!selectedUser) return;
    setNotice(null);
    try {
      await adminUpdateUser(selectedUser.id, {
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        status: form.status,
        roleId: form.roleId,
      });
      setNotice({ type: "success", text: "Đã lưu thông tin tài khoản hệ thống." });
    } catch (actionError) {
      setNotice({ type: "error", text: getGraphQLErrorMessage(actionError, "Không thể lưu tài khoản.") });
    }
  };

  return (
    <main className="system-users-page">
      <ManagementPageHeader
        density="compact"
        showTimeWidget={false}
        eyebrow="ADMIN ACCESS CONTROL"
        title="Quản lý người dùng hệ thống"
        subtitle="Quản lý Admin, Manager và các vai trò không thuộc nhóm Staff. Trang này chỉ hiển thị cho tài khoản Admin."
        icon="🛡️"
        stats={stats}
        primaryAction={{ label: loading ? "Đang tải..." : "Làm mới", icon: "🔄", onClick: refresh, disabled: loading }}
      />

      <section className="system-users-toolbar" aria-label="Bộ lọc người dùng hệ thống">
        <form className="system-users-search" onSubmit={applySearch}>
          <Search size={17} />
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm theo tên, email, số điện thoại, username..." />
          <button type="submit">Tìm</button>
        </form>
        <label>
          Vai trò
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">Tất cả role hệ thống</option>
            {systemRoles.map((role) => <option key={role.id} value={getRoleSlug(role)}>{roleLabel(role)}</option>)}
          </select>
        </label>
        <label>
          Trạng thái
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
        </label>
      </section>

      {notice ? <section className={`system-users-notice is-${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>{notice.text}</section> : null}
      {error ? <section className="system-users-notice is-error" role="alert">{getGraphQLErrorMessage(error, "Không tải được danh sách người dùng hệ thống.")}</section> : null}

      <section className="system-users-batchbar" aria-label="Thao tác hàng loạt">
        <div>
          <strong>{selectedUsers.length}</strong>
          <span>tài khoản đã chọn</span>
        </div>
        <button type="button" onClick={() => exportUsersToCsv(selectedUsers.length ? selectedUsers : filteredUsers)} disabled={!filteredUsers.length}><Download size={15} />Xuất CSV</button>
        <button type="button" onClick={() => runBatchStatus("active")} disabled={!selectedUsers.length || loading}><Unlock size={15} />Mở khóa</button>
        <button type="button" onClick={() => runBatchStatus("blocked")} disabled={!selectedUsers.length || loading}><Lock size={15} />Khóa</button>
        <button type="button" className="is-danger" onClick={runBatchSoftDelete} disabled={!selectedUsers.length || loading}><Trash2 size={15} />Xóa mềm</button>
      </section>

      <section className="system-users-layout">
        <div className="system-users-table-card">
          <div className="system-users-table-card__header">
            <div>
              <span>Danh sách tài khoản</span>
              <h3>{loading ? "Đang tải dữ liệu..." : `${filteredUsers.length.toLocaleString("vi-VN")} tài khoản hệ thống`}</h3>
            </div>
            <button type="button" onClick={refresh} disabled={loading}><RefreshCw size={15} />Làm mới</button>
          </div>

          <div className="system-users-table-wrap">
            <table className="system-users-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={filteredUsers.length > 0 && filteredUsers.every((targetUser) => selectedIds.has(targetUser.id))} onChange={toggleAllVisible} aria-label="Chọn tất cả tài khoản đang hiển thị" /></th>
                  <th>Người dùng</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Xác minh</th>
                  <th>Đăng nhập gần nhất</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((targetUser) => {
                  const role = resolveFullRole(targetUser);
                  const status = normalize(targetUser.status || "active");
                  return (
                    <tr key={targetUser.id} className={selectedUserId === targetUser.id ? "is-selected" : ""}>
                      <td><input type="checkbox" checked={selectedIds.has(targetUser.id)} onChange={() => toggleSelected(targetUser.id)} aria-label={`Chọn ${userDisplayName(targetUser)}`} /></td>
                      <td>
                        <button type="button" className="system-users-identity" onClick={() => setSelectedUserId(targetUser.id)}>
                          <span>{userDisplayName(targetUser).charAt(0).toUpperCase()}</span>
                          <strong>{userDisplayName(targetUser)}</strong>
                          <small>{targetUser.email || targetUser.phone || targetUser.username || "Chưa có liên hệ"}</small>
                        </button>
                      </td>
                      <td><span className="system-users-role"><ShieldCheck size={14} />{roleLabel(role)}</span></td>
                      <td><span className={`system-users-status is-${statusTones[status] || "muted"}`}>{statusLabels[status] || targetUser.status || "Không rõ"}</span></td>
                      <td>
                        <div className="system-users-verify">
                          <span className={targetUser.emailVerified ? "is-ok" : "is-missing"}>Email</span>
                          <span className={targetUser.phoneVerified ? "is-ok" : "is-missing"}>SĐT</span>
                        </div>
                      </td>
                      <td>{formatDateTime(targetUser.lastLoginAt)}</td>
                      <td>
                        <div className="system-users-row-actions">
                          <button type="button" onClick={() => setSelectedUserId(targetUser.id)}>Sửa</button>
                          {status === "blocked" ? (
                            <button type="button" onClick={() => runSingleStatus(targetUser, "active")}><Unlock size={14} />Mở</button>
                          ) : (
                            <button type="button" onClick={() => runSingleStatus(targetUser, "blocked")}><Lock size={14} />Khóa</button>
                          )}
                          <button type="button" className="is-danger" onClick={() => runSoftDelete(targetUser)}><Trash2 size={14} />Xóa</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredUsers.length ? (
                  <tr><td colSpan={7}><div className="system-users-empty"><Users size={26} /><strong>Chưa có tài khoản hệ thống phù hợp</strong><span>Thử đổi bộ lọc hoặc làm mới danh sách.</span></div></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <SystemUserEditPanel
          user={selectedUser}
          roles={systemRoles}
          form={form}
          setForm={setForm}
          onSave={saveSelectedUser}
          onClose={() => setSelectedUserId("")}
          saving={loading}
        />
      </section>

      <section className="system-users-assurance" aria-label="Kiểm soát an toàn">
        <article><CheckCircle2 size={18} /><strong>Chỉ Admin thấy route</strong><span>Sidebar và route đều bị chặn nếu không phải Admin.</span></article>
        <article><ShieldCheck size={18} /><strong>Không đụng Staff role</strong><span>Role có parentRole là staff và role vận hành bị loại khỏi danh sách.</span></article>
        <article><AlertTriangle size={18} /><strong>Confirm thao tác nguy hiểm</strong><span>Khóa, xóa mềm và batch actions đều yêu cầu xác nhận.</span></article>
      </section>
    </main>
  );
}
