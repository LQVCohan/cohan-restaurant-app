import React from "react";
import {
  formatAuditActor,
  formatAuditChange,
  getAuditActionLabel,
  getAuditTargetTypeLabel,
  RBAC_AUDIT_ACTION_LABELS,
  RBAC_AUDIT_TARGET_LABELS,
} from "@/utils/rbacAuditLogFormatter";
import { getRbacRoleLabel } from "@/utils/rbacVietnameseLabels";

const formatTime = (value) => {
  if (!value) return "Không rõ";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
};

const restaurantLabel = (restaurantId, restaurants = []) => {
  if (!restaurantId) return "Toàn hệ thống";
  const found = restaurants.find((restaurant) => String(restaurant.id) === String(restaurantId));
  return found?.name || restaurantId;
};

export default function RbacAuditLogPanel({
  auditLogs = [],
  loading,
  error,
  filters,
  setFilters,
  refetch,
  restaurants = [],
  selectedRestaurantId,
  setSelectedRestaurantId,
  canViewGlobalAuditLogs,
  auditLogsSkipped,
}) {
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
  const needsRestaurant = !canViewGlobalAuditLogs && !selectedRestaurantId;

  return (
    <section className="rbac-card rbac-audit-log">
      <div className="rbac-card__header">
        <div>
          <h3>Lịch sử phân quyền</h3>
          <p>Xem ai đã tạo, chỉnh sửa hoặc gán vai trò, cùng nội dung thay đổi.</p>
        </div>
        <button type="button" onClick={() => refetch?.()} disabled={loading || auditLogsSkipped}>Làm mới</button>
      </div>

      <div className="rbac-audit-filters">
        <label>
          Hành động
          <select value={filters.action || ""} onChange={(event) => updateFilter("action", event.target.value)}>
            <option value="">Tất cả hành động</option>
            {Object.entries(RBAC_AUDIT_ACTION_LABELS).map(([action, label]) => <option key={action} value={action}>{label}</option>)}
          </select>
        </label>
        <label>
          Đối tượng
          <select value={filters.targetType || ""} onChange={(event) => updateFilter("targetType", event.target.value)}>
            <option value="">Tất cả đối tượng</option>
            {Object.entries(RBAC_AUDIT_TARGET_LABELS).map(([targetType, label]) => <option key={targetType} value={targetType}>{label}</option>)}
          </select>
        </label>
        {restaurants.length ? (
          <label>
            Nhà hàng
            <select
              value={canViewGlobalAuditLogs ? (filters.restaurantId || "") : selectedRestaurantId}
              onChange={(event) => {
                if (canViewGlobalAuditLogs) updateFilter("restaurantId", event.target.value);
                else setSelectedRestaurantId?.(event.target.value);
              }}
            >
              {canViewGlobalAuditLogs ? <option value="">Toàn hệ thống</option> : <option value="">Chọn nhà hàng</option>}
              {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      {needsRestaurant ? <p className="rbac-status rbac-status--info">Chọn nhà hàng để xem lịch sử phân quyền.</p> : null}
      {loading ? <p className="rbac-status">Đang tải lịch sử…</p> : null}
      {error ? <p className="rbac-status rbac-status--error">Không thể tải lịch sử phân quyền. Hãy thử làm mới.</p> : null}
      {!loading && !error && !needsRestaurant && !auditLogs.length ? <p className="rbac-empty">Chưa ghi nhận thay đổi phân quyền.</p> : null}

      {!loading && !error && auditLogs.length ? (
        <div className="rbac-audit-table-wrap">
          <table className="rbac-audit-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Vai trò</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
                <th>Nhà hàng</th>
                <th>Nội dung thay đổi</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{formatTime(log.createdAt)}</td>
                  <td>{formatAuditActor(log)}</td>
                  <td>{getRbacRoleLabel(log.actorRole)}</td>
                  <td><span className="rbac-action-badge">{getAuditActionLabel(log.action)}</span></td>
                  <td><strong>{log.targetName || log.targetId || "Không rõ"}</strong><small>{getAuditTargetTypeLabel(log.targetType)}</small></td>
                  <td>{restaurantLabel(log.restaurantId, restaurants)}</td>
                  <td>{formatAuditChange(log)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
