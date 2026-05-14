import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  Activity,
  AlertCircle,
  Clock,
  Database,
  FileText,
  RefreshCw,
  User,
} from "lucide-react";
import Modal from "../../../../common/Modal";
import "./AuditLogModal.scss";

const AUDIT_LOGS_QUERY = gql`
  query AuditLogs($filter: AuditLogFilterInput, $limit: Int, $offset: Int) {
    auditLogs(filter: $filter, limit: $limit, offset: $offset) {
      total
      items {
        id
        restaurantId
        entity
        entityId
        action
        byUserId
        diff
        createdAt
        updatedAt
      }
    }
  }
`;

const ACTION_LABELS = {
  create: "Tạo mới",
  update: "Cập nhật",
  delete: "Xóa",
};

const ACTION_CLASS = {
  create: "create",
  update: "update",
  delete: "delete",
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "--";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const compactObject = (obj = {}) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.entries(obj).filter(([, value]) => value !== undefined);
};

const renderKeyValueGrid = (title, data) => {
  const entries = compactObject(data);
  if (!entries.length) return null;

  return (
    <div className="alm-kv-block">
      <strong>{title}</strong>
      <div className="alm-kv-grid">
        {entries.map(([key, value]) => (
          <div className="alm-kv-row" key={key}>
            <span>{key}</span>
            <b title={formatValue(value)}>{formatValue(value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
};

const renderDiff = (diff) => {
  if (!diff || typeof diff !== "object") {
    return <span className="alm-muted">Không có chi tiết thay đổi.</span>;
  }

  if (diff.type === "bulk_price_update") {
    return (
      <div className="alm-diff-summary">
        <span>Sửa giá hàng loạt</span>
        <small>
          {diff.mode === "PERCENT" ? "Theo phần trăm" : "Theo số tiền"} · Giá trị:{" "}
          {formatValue(diff.value)} · Giá sau: {formatValue(diff.basePriceAfter)}
        </small>
      </div>
    );
  }

  if (diff.field) {
    return (
      <div className="alm-diff-summary">
        <span>Thay đổi trường: {diff.field}</span>
        <small>
          Trước: {formatValue(diff.before)} → Sau: {formatValue(diff.after)}
        </small>
      </div>
    );
  }

  if (diff.before || diff.after) {
    return (
      <div className="alm-diff-columns">
        {renderKeyValueGrid("Trước", diff.before)}
        {renderKeyValueGrid("Sau", diff.after)}
      </div>
    );
  }

  return renderKeyValueGrid("Chi tiết", diff) || (
    <span className="alm-muted">Không có chi tiết thay đổi.</span>
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
    () => ({
      restaurantId,
      entity,
      entityId,
    }),
    [entity, entityId, restaurantId]
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
      <Modal.Header>{title}</Modal.Header>
      <Modal.Body>
        <div className="alm-header-row">
          <div className="alm-meta-pill">
            <Database size={15} />
            <span>{entity || "--"}</span>
          </div>
          <div className="alm-meta-pill">
            <FileText size={15} />
            <span>{entityId || "--"}</span>
          </div>
          <button
            type="button"
            className="alm-refresh-btn"
            onClick={() => refetch?.()}
            disabled={loading || shouldSkip}
          >
            <RefreshCw size={15} /> Làm mới
          </button>
        </div>

        {error && (
          <div className="alm-alert">
            <AlertCircle size={18} />
            <span>{error.message || "Không thể tải lịch sử thay đổi."}</span>
          </div>
        )}

        {loading && logs.length === 0 ? (
          <div className="alm-state">Đang tải lịch sử thay đổi...</div>
        ) : logs.length === 0 ? (
          <div className="alm-empty">
            <Activity size={34} />
            <strong>Chưa có lịch sử thay đổi</strong>
            <span>Các thao tác tạo, sửa, xóa hoặc sửa giá sẽ xuất hiện tại đây.</span>
          </div>
        ) : (
          <div className="alm-timeline">
            <div className="alm-total">Hiển thị {logs.length}/{total} bản ghi gần nhất</div>
            {logs.map((log) => {
              const actionClass = ACTION_CLASS[log.action] || "update";
              return (
                <article className="alm-entry" key={log.id}>
                  <div className={`alm-entry-dot ${actionClass}`}></div>
                  <div className="alm-entry-card">
                    <div className="alm-entry-top">
                      <span className={`alm-action ${actionClass}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      <span className="alm-time">
                        <Clock size={14} /> {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <div className="alm-entry-sub">
                      <User size={14} />
                      <span>Người thao tác: {log.byUserId || "--"}</span>
                    </div>
                    <div className="alm-entry-diff">{renderDiff(log.diff)}</div>
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
