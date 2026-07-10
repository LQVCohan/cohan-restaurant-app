import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  Activity,
  AlertCircle,
  Clock,
  RefreshCw,
  User,
} from "lucide-react";
import Modal from "../../../../common/Modal";
import "./AuditLogModal.scss";
import "./AuditLogModalPolish.scss";

const AUDIT_LOGS_QUERY = gql`
  query AuditLogs($filter: AuditLogFilterInput, $limit: Int, $offset: Int) {
    auditLogs(filter: $filter, limit: $limit, offset: $offset) {
      total
      items {
        id
        action
        diff
        actorName
        actorRole
        createdAt
      }
    }
  }
`;

const ACTION_LABELS = {
  create: "Đã tạo món",
  update: "Đã cập nhật món",
  delete: "Đã xóa món",
};

const ACTION_CLASS = {
  create: "create",
  update: "update",
  delete: "delete",
};

const FIELD_LABELS = {
  name: "Tên món",
  description: "Mô tả",
  basePrice: "Giá bán",
  price: "Giá bán",
  status: "Trạng thái bán",
  prepStation: "Khu vực chế biến",
  avgPrepTimeMin: "Thời gian chế biến",
  isAvailable: "Đang phục vụ",
  sortOrder: "Thứ tự hiển thị",
  order: "Thứ tự hiển thị",
};

const CREATE_FIELDS = new Set([
  "name",
  "description",
  "basePrice",
  "price",
  "status",
  "prepStation",
  "avgPrepTimeMin",
]);

const VALUE_LABELS = {
  available: "Đang bán",
  unavailable: "Tạm ngưng bán",
  out_of_stock: "Hết món",
  hidden: "Ẩn khỏi thực đơn",
  kitchen: "Bếp",
  bar: "Quầy bar",
};

const formatDateTime = (value) => {
  if (!value) return "Không rõ thời gian";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const formatValue = (key, value) => {
  if (value === null || value === undefined || value === "") return "Chưa có";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (["basePrice", "price"].includes(key) && Number.isFinite(Number(value))) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(Number(value));
  }
  if (key === "avgPrepTimeMin" && Number.isFinite(Number(value))) {
    return `${Number(value).toLocaleString("vi-VN")} phút`;
  }
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  if (typeof value === "string") return VALUE_LABELS[value] || value;
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Không có";
  return "Đã thay đổi";
};

const getVisibleEntries = (obj = {}, allowedFields) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.entries(obj).filter(
    ([key, value]) =>
      FIELD_LABELS[key] &&
      (!allowedFields || allowedFields.has(key)) &&
      value !== undefined,
  );
};

const renderRows = (entries) => {
  if (!entries.length) return null;
  return (
    <div className="alm-kv-grid">
      {entries.map(([key, value]) => {
        const formattedValue = formatValue(key, value);
        return (
          <div className="alm-kv-row" key={key}>
            <span>{FIELD_LABELS[key]}</span>
            <b title={formattedValue}>{formattedValue}</b>
          </div>
        );
      })}
    </div>
  );
};

const renderCreatedValues = (diff) => {
  const source = diff?.after || diff;
  const entries = getVisibleEntries(source, CREATE_FIELDS);
  return renderRows(entries) || (
    <span className="alm-muted">Món đã được tạo.</span>
  );
};

const renderChangedValues = (before = {}, after = {}) => {
  const entries = getVisibleEntries(after).filter(([key, value]) => {
    const beforeValue = before?.[key];
    return JSON.stringify(beforeValue) !== JSON.stringify(value);
  });

  if (!entries.length) {
    return <span className="alm-muted">Không có thay đổi cần hiển thị.</span>;
  }

  return (
    <div className="alm-kv-grid">
      {entries.map(([key, afterValue]) => {
        const beforeValue = before?.[key];
        const beforeText = formatValue(key, beforeValue);
        const afterText = formatValue(key, afterValue);
        return (
          <div className="alm-kv-row" key={key}>
            <span>{FIELD_LABELS[key]}</span>
            <b title={`${beforeText} → ${afterText}`}>
              {beforeText} → {afterText}
            </b>
          </div>
        );
      })}
    </div>
  );
};

const renderDiff = (diff, action) => {
  if (!diff || typeof diff !== "object") {
    return <span className="alm-muted">Không có thông tin chi tiết.</span>;
  }

  if (diff.type === "bulk_price_update") {
    return (
      <div className="alm-diff-summary">
        <span>Giá bán đã được điều chỉnh</span>
        <small>Giá mới: {formatValue("basePrice", diff.basePriceAfter)}</small>
      </div>
    );
  }

  if (diff.field) {
    if (!FIELD_LABELS[diff.field] || diff.field === "thumbImage") {
      return <span className="alm-muted">Thông tin món đã được cập nhật.</span>;
    }
    return (
      <div className="alm-diff-summary">
        <span>{FIELD_LABELS[diff.field]}</span>
        <small>
          {formatValue(diff.field, diff.before)} → {formatValue(diff.field, diff.after)}
        </small>
      </div>
    );
  }

  if (diff.before || diff.after) {
    return renderChangedValues(diff.before, diff.after);
  }

  if (action === "create") return renderCreatedValues(diff);

  return renderRows(getVisibleEntries(diff)) || (
    <span className="alm-muted">Không có thay đổi cần hiển thị.</span>
  );
};

const AuditLogModal = ({
  isOpen,
  onClose,
  restaurantId,
  entity,
  entityId,
  title = "Lịch sử thay đổi",
  limit = 50,
}) => {
  const filter = useMemo(
    () => ({ restaurantId, entity, entityId }),
    [entity, entityId, restaurantId],
  );

  const shouldSkip = !isOpen || !restaurantId || !entity || !entityId;

  const { data, loading, error, refetch } = useQuery(AUDIT_LOGS_QUERY, {
    variables: { filter, limit, offset: 0 },
    skip: shouldSkip,
    fetchPolicy: "cache-and-network",
  });

  const logs = data?.auditLogs?.items || [];
  const total = data?.auditLogs?.total || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="audit-log-modal"
      closeOnOverlayClick={!loading}
    >
      <Modal.Header onClose={onClose}>{title}</Modal.Header>
      <Modal.Body>
        <div className="alm-header-row">
          <div className="alm-header-copy">
            <strong>Lịch sử hoạt động</strong>
            <span>Theo dõi những lần tạo, chỉnh sửa hoặc xóa món.</span>
          </div>
          <button
            type="button"
            className="alm-refresh-btn"
            onClick={() => refetch?.()}
            disabled={loading || shouldSkip}
          >
            <RefreshCw size={15} className={loading ? "is-spinning" : ""} />
            Cập nhật
          </button>
        </div>

        {error && (
          <div className="alm-alert">
            <AlertCircle size={18} />
            <span>Không thể tải lịch sử món. Vui lòng thử lại.</span>
          </div>
        )}

        {loading && logs.length === 0 ? (
          <div className="alm-state">Đang tải lịch sử món...</div>
        ) : logs.length === 0 ? (
          <div className="alm-empty">
            <Activity size={34} />
            <strong>Chưa có thay đổi nào</strong>
            <span>Các lần tạo, chỉnh sửa hoặc xóa món sẽ xuất hiện tại đây.</span>
          </div>
        ) : (
          <div className="alm-timeline">
            <div className="alm-total">
              {total === 1 ? "1 thay đổi" : `${total} thay đổi`}
            </div>
            {logs.map((log) => {
              const actionClass = ACTION_CLASS[log.action] || "update";
              return (
                <article className="alm-entry" key={log.id}>
                  <div className={`alm-entry-dot ${actionClass}`} />
                  <div className="alm-entry-card">
                    <div className="alm-entry-top">
                      <span className={`alm-action ${actionClass}`}>
                        {ACTION_LABELS[log.action] || "Đã thay đổi món"}
                      </span>
                      <span className="alm-time">
                        <Clock size={14} /> {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <div className="alm-entry-sub">
                      <User size={14} />
                      <span>{log.actorName || "Người quản lý"}</span>
                      {log.actorRole && <small>{log.actorRole}</small>}
                    </div>
                    <div className="alm-entry-diff">
                      {renderDiff(log.diff, log.action)}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default AuditLogModal;
