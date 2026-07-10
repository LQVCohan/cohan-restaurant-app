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
  create: "Tạo món",
  update: "Cập nhật món",
  delete: "Xóa món",
};

const ACTION_CLASS = {
  create: "create",
  update: "update",
  delete: "delete",
};

const FIELD_LABELS = {
  name: "Tên món",
  description: "Mô tả",
  categoryId: "Danh mục món",
  basePrice: "Giá bán",
  price: "Giá bán",
  status: "Trạng thái bán",
  prepStation: "Khu chế biến",
  avgPrepTimeMin: "Thời gian chế biến",
  thumbImage: "Ảnh món",
  foodType: "Nhóm món",
  meatTypes: "Loại thịt",
  dietTags: "Chế độ ăn",
  allergenTags: "Thành phần dị ứng",
  tasteProfile: "Khẩu vị",
  notes: "Ghi chú",
  point: "Điểm thưởng",
  rate: "Đánh giá",
  orderCounter: "Số phần đã bán",
  isAvailable: "Đang phục vụ",
  sortOrder: "Thứ tự hiển thị",
  order: "Thứ tự hiển thị",
};

const CREATE_FIELDS = new Set([
  "name",
  "description",
  "categoryId",
  "basePrice",
  "price",
  "status",
  "prepStation",
  "avgPrepTimeMin",
  "foodType",
]);

const VALUE_LABELS = {
  available: "Đang bán",
  unavailable: "Tạm ngưng bán",
  out_of_stock: "Hết món",
  hidden: "Ẩn khỏi thực đơn",
  kitchen: "Bếp chính",
  bar: "Quầy bar",
  UNKNOWN: "Chưa xác định",
  VEGETARIAN: "Món chay",
  VEGAN: "Món thuần chay",
  NON_VEGETARIAN: "Có thịt hoặc hải sản",
  MIXED: "Có lựa chọn chay và món có thịt",
  BEEF: "Bò",
  PORK: "Heo",
  CHICKEN: "Gà",
  DUCK: "Vịt",
  SEAFOOD: "Hải sản",
  FISH: "Cá",
  LAMB: "Cừu",
  OTHER: "Khác",
  vegan: "Ăn chay hoặc thuần chay",
  keto: "Keto hoặc ít tinh bột",
  halal: "Halal",
  seafood: "Hải sản",
  peanut: "Đậu phộng",
  milk: "Sữa",
  egg: "Trứng",
  gluten: "Gluten hoặc bột mì",
};

const ACTOR_ROLE_LABELS = {
  admin: "Quản trị viên",
  manager: "Người quản lý",
  restaurant_manager: "Quản lý nhà hàng",
  brand_manager: "Quản lý thương hiệu",
  owner: "Chủ nhà hàng",
  staff: "Nhân viên",
  employee: "Nhân viên",
};

const comparable = (value) => JSON.stringify(value ?? null);

const hasMeaningfulDiff = (diff, action) => {
  if (action !== "update") return true;
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) return false;

  if (Object.prototype.hasOwnProperty.call(diff, "field")) {
    return comparable(diff.before) !== comparable(diff.after);
  }

  if (
    Object.prototype.hasOwnProperty.call(diff, "before") ||
    Object.prototype.hasOwnProperty.call(diff, "after")
  ) {
    const before = diff.before;
    const after = diff.after;
    if (
      !before ||
      !after ||
      typeof before !== "object" ||
      typeof after !== "object" ||
      Array.isArray(before) ||
      Array.isArray(after)
    ) {
      return comparable(before) !== comparable(after);
    }

    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].some(
      (key) => comparable(before[key]) !== comparable(after[key]),
    );
  }

  return Object.keys(diff).some((key) => key !== "type");
};

const formatDateTime = (value) => {
  if (!value) return "Không rõ thời gian";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatActorRole = (value) => {
  const key = String(value || "").trim().toLowerCase();
  return ACTOR_ROLE_LABELS[key] || value || "";
};

const formatTasteProfile = (value = {}) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Đã thay đổi";
  }

  return [
    value.containsOnion === undefined
      ? null
      : value.containsOnion
        ? "Có hành"
        : "Không hành",
    value.containsCilantro === undefined
      ? null
      : value.containsCilantro
        ? "Có ngò"
        : "Không ngò",
    value.sugar === undefined ? null : `Độ ngọt ${value.sugar}%`,
    value.spice === undefined ? null : `Độ cay ${value.spice}`,
  ]
    .filter(Boolean)
    .join("; ") || "Đã thay đổi";
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
  if (key === "tasteProfile") return formatTasteProfile(value);
  if (key === "categoryId") return value ? "Đã chọn danh mục" : "Chưa phân loại";
  if (key === "thumbImage") return value ? "Đã có ảnh" : "Chưa có ảnh";
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  if (typeof value === "string") return VALUE_LABELS[value] || value;
  if (Array.isArray(value)) {
    return value.length
      ? value.map((item) => VALUE_LABELS[item] || item).join(", ")
      : "Không có";
  }
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

const formatChangeText = (key, beforeValue, afterValue) => {
  if (key === "categoryId") return "Đã thay đổi danh mục";
  if (key === "thumbImage") return "Đã cập nhật ảnh món";
  return `${formatValue(key, beforeValue)} → ${formatValue(key, afterValue)}`;
};

const renderChangedValues = (before = {}, after = {}) => {
  const entries = getVisibleEntries(after).filter(
    ([key, value]) => comparable(before?.[key]) !== comparable(value),
  );

  if (!entries.length) {
    return (
      <span className="alm-muted">
        Thông tin kỹ thuật của món đã được cập nhật.
      </span>
    );
  }

  return (
    <div className="alm-kv-grid">
      {entries.map(([key, afterValue]) => {
        const changeText = formatChangeText(key, before?.[key], afterValue);
        return (
          <div className="alm-kv-row" key={key}>
            <span>{FIELD_LABELS[key]}</span>
            <b title={changeText}>{changeText}</b>
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
    const before = formatValue("basePrice", diff.basePriceBefore);
    const after = formatValue("basePrice", diff.basePriceAfter);
    return (
      <div className="alm-diff-summary">
        <span>Điều chỉnh giá bán</span>
        <small>{before} → {after}</small>
      </div>
    );
  }

  if (diff.field) {
    if (diff.field === "thumbImage") {
      return (
        <div className="alm-diff-summary">
          <span>Ảnh món</span>
          <small>Đã cập nhật ảnh món</small>
        </div>
      );
    }
    if (!FIELD_LABELS[diff.field]) {
      return (
        <span className="alm-muted">Thông tin món đã được cập nhật.</span>
      );
    }
    return (
      <div className="alm-diff-summary">
        <span>{FIELD_LABELS[diff.field]}</span>
        <small>{formatChangeText(diff.field, diff.before, diff.after)}</small>
      </div>
    );
  }

  if (diff.before || diff.after) {
    return renderChangedValues(diff.before, diff.after);
  }

  if (action === "create") return renderCreatedValues(diff);

  return renderRows(getVisibleEntries(diff)) || (
    <span className="alm-muted">Thông tin món đã được cập nhật.</span>
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
  const visibleLogs = useMemo(
    () => logs.filter((log) => hasMeaningfulDiff(log?.diff, log?.action)),
    [logs],
  );

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
            <strong>Lịch sử chỉnh sửa</strong>
            <span>Chỉ hiển thị những thay đổi thực tế của món.</span>
          </div>
          <button
            type="button"
            className="alm-refresh-btn"
            onClick={() => refetch?.()}
            disabled={loading || shouldSkip}
          >
            <RefreshCw size={15} className={loading ? "is-spinning" : ""} />
            Tải lại
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
        ) : visibleLogs.length === 0 ? (
          <div className="alm-empty">
            <Activity size={34} />
            <strong>Chưa có thay đổi thực tế</strong>
            <span>Các lần chỉnh sửa có thay đổi dữ liệu sẽ xuất hiện tại đây.</span>
          </div>
        ) : (
          <div className="alm-timeline">
            <div className="alm-total">
              {visibleLogs.length === 1
                ? "1 thay đổi"
                : `${visibleLogs.length} thay đổi`}
            </div>
            {visibleLogs.map((log) => {
              const actionClass = ACTION_CLASS[log.action] || "update";
              const actorRole = formatActorRole(log.actorRole);
              return (
                <article className="alm-entry" key={log.id}>
                  <div className={`alm-entry-dot ${actionClass}`} />
                  <div className="alm-entry-card">
                    <div className="alm-entry-top">
                      <span className={`alm-action ${actionClass}`}>
                        {ACTION_LABELS[log.action] || "Thay đổi món"}
                      </span>
                      <span className="alm-time">
                        <Clock size={14} /> {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <div className="alm-entry-sub">
                      <User size={14} />
                      <span>{log.actorName || "Tài khoản quản lý"}</span>
                      {actorRole && <small>{actorRole}</small>}
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
