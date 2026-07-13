import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  Activity,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  buildDetailGroups,
  buildSearchText,
  formatActor,
  formatAuditTarget,
  formatDateTimeParts,
  formatObjectReference,
  formatStatus,
  humanizeAction,
  humanizeScope,
  matchesFriendlySearch,
} from "./systemLogsPresentation";
import "./SystemLogsPage.scss";
import "./SystemLogsPagePagination.scss";

const AUDIT_LOGS_QUERY = gql`
  query ManagerAuditLogs($filter: AuditLogFilterInput, $limit: Int, $offset: Int) {
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
        actorId
        actorName
        actorRole
        module
        targetType
        targetId
        targetName
        before
        after
        metadata
        createdAt
        updatedAt
      }
    }
  }
`;

const EVENT_LOGS_QUERY = gql`
  query ManagerEventLogs($filter: EventLogsFilter, $limit: Int, $skip: Int) {
    eventLogs(filter: $filter, limit: $limit, skip: $skip) {
      total
      items {
        id
        restaurantId
        floorId
        tableId
        orderId
        actorUserId
        customerProfileId
        verb
        object { kind id code }
        target { kind id code }
        source
        ip
        userAgent
        sessionId
        correlationId
        status
        meta
        diff
        at
        createdAt
      }
    }
  }
`;

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const MAX_COMBINED_WINDOW = 100;

const normalizeAuditLog = (log) => {
  const action = humanizeAction(log.action);
  const scope = humanizeScope(log.module || log.entity || log.targetType || "audit");
  const actor = formatActor(log);
  const target = formatAuditTarget(log);
  const detail = {
    before: log.before,
    after: log.after,
    diff: log.diff,
    metadata: log.metadata,
  };

  return {
    key: `audit-${log.id}`,
    kind: "audit",
    kindLabel: "Thay đổi quản trị",
    at: log.createdAt || log.updatedAt,
    dateTime: formatDateTimeParts(log.createdAt || log.updatedAt),
    title: action,
    scope,
    actor,
    target,
    status: "Đã ghi nhận",
    detailGroups: buildDetailGroups(detail),
    searchText: buildSearchText(
      action,
      scope,
      actor,
      target,
      log.action,
      log.module,
      log.entity,
      log.targetType,
      detail,
    ),
  };
};

const normalizeEventLog = (log) => {
  const action = humanizeAction(log.verb);
  const scope = humanizeScope(log.source || log.object?.kind || log.target?.kind || "event");
  const actor = formatActor(log);
  const target = formatObjectReference(log.target || log.object || {});
  const status = formatStatus(log.status);
  const detail = {
    meta: log.meta,
    diff: log.diff,
    ip: log.ip,
    userAgent: log.userAgent,
    correlationId: log.correlationId,
    sessionId: log.sessionId,
  };

  return {
    key: `event-${log.id}`,
    kind: "event",
    kindLabel: "Hoạt động vận hành",
    at: log.at || log.createdAt,
    dateTime: formatDateTimeParts(log.at || log.createdAt),
    title: action,
    scope,
    actor,
    target,
    status,
    detailGroups: buildDetailGroups(detail),
    searchText: buildSearchText(
      action,
      scope,
      actor,
      target,
      status,
      log.verb,
      log.source,
      log.object,
      log.target,
      log.orderId,
      log.tableId,
      detail,
    ),
  };
};

const sortByNewest = (left, right) => {
  const leftTime = Number.isFinite(Number(left.at)) ? Number(left.at) : new Date(left.at || 0).getTime();
  const rightTime = Number.isFinite(Number(right.at)) ? Number(right.at) : new Date(right.at || 0).getTime();
  return rightTime - leftTime;
};

const clampPage = (value, totalPages) => Math.min(Math.max(Number(value) || 1, 1), totalPages);

const DetailList = ({ items }) => (
  <dl className="system-logs-page__detail-list">
    {items.map((item) => (
      <div key={item.key}>
        <dt>{item.label}</dt>
        <dd><pre>{item.value}</pre></dd>
      </div>
    ))}
  </dl>
);

const ActivityDetails = ({ entry }) => {
  const hasVisibleDetails = entry.detailGroups.visible.length > 0;
  const hasTechnicalDetails = entry.detailGroups.technical.length > 0;

  return (
    <details className="system-logs-page__details">
      <summary>
        <Eye size={15} aria-hidden="true" />
        Xem thông tin
      </summary>
      <div className="system-logs-page__details-panel">
        <div className="system-logs-page__details-overview">
          <span>Trạng thái</span>
          <strong>{entry.status}</strong>
        </div>

        {hasVisibleDetails ? (
          <DetailList items={entry.detailGroups.visible} />
        ) : (
          <p className="system-logs-page__details-empty">Không có thông tin bổ sung.</p>
        )}

        {hasTechnicalDetails && (
          <details className="system-logs-page__technical-details">
            <summary>Thông tin dành cho bộ phận hỗ trợ</summary>
            <DetailList items={entry.detailGroups.technical} />
          </details>
        )}
      </div>
    </details>
  );
};

const SystemLogsPage = ({ restaurantId, isAdmin = false }) => {
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const canQuery = Boolean(isAdmin || restaurantId);
  const scopedFilter = useMemo(
    () => (restaurantId ? { restaurantId } : {}),
    [restaurantId],
  );
  const combinedWindow = Math.min(page * pageSize, MAX_COMBINED_WINDOW);
  const auditLimit = kind === "all" ? combinedWindow : pageSize;
  const eventLimit = kind === "all" ? combinedWindow : pageSize;
  const auditOffset = kind === "audit" ? (page - 1) * pageSize : 0;
  const eventSkip = kind === "event" ? (page - 1) * pageSize : 0;

  useEffect(() => {
    setPage(1);
  }, [kind, pageSize, restaurantId, search]);

  const auditQuery = useQuery(AUDIT_LOGS_QUERY, {
    variables: { filter: scopedFilter, limit: auditLimit, offset: auditOffset },
    skip: !canQuery || kind === "event",
    fetchPolicy: "cache-and-network",
  });

  const eventQuery = useQuery(EVENT_LOGS_QUERY, {
    variables: { filter: scopedFilter, limit: eventLimit, skip: eventSkip },
    skip: !canQuery || kind === "audit",
    fetchPolicy: "cache-and-network",
  });

  const totalAudit = auditQuery.data?.auditLogs?.total || 0;
  const totalEvent = eventQuery.data?.eventLogs?.total || 0;
  const totalRows = kind === "audit"
    ? totalAudit
    : kind === "event"
      ? totalEvent
      : Math.min(totalAudit + totalEvent, MAX_COMBINED_WINDOW);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  useEffect(() => {
    setPage((current) => clampPage(current, totalPages));
  }, [totalPages]);

  const entries = useMemo(() => {
    const auditRows = kind === "event" ? [] : (auditQuery.data?.auditLogs?.items || []).map(normalizeAuditLog);
    const eventRows = kind === "audit" ? [] : (eventQuery.data?.eventLogs?.items || []).map(normalizeEventLog);
    const rows = [...auditRows, ...eventRows]
      .filter((entry) => matchesFriendlySearch(entry, search))
      .sort(sortByNewest);

    if (kind !== "all") return rows;
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [auditQuery.data?.auditLogs?.items, eventQuery.data?.eventLogs?.items, kind, page, pageSize, search]);

  const loading = auditQuery.loading || eventQuery.loading;
  const error = auditQuery.error || eventQuery.error;
  const rangeStart = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalRows);

  const refetch = () => {
    if (kind !== "event") auditQuery.refetch?.();
    if (kind !== "audit") eventQuery.refetch?.();
  };

  const goToPage = (nextPage) => setPage(clampPage(nextPage, totalPages));

  if (!canQuery) {
    return (
      <div className="system-logs-page system-logs-page--empty">
        <ShieldCheck size={38} />
        <h2>Chọn chi nhánh để xem hoạt động</h2>
        <p>Bạn chỉ xem được hoạt động tại những nhà hàng mình được phân quyền.</p>
      </div>
    );
  }

  return (
    <div className="system-logs-page">
      <header className="system-logs-page__header">
        <div>
          <span className="system-logs-page__eyebrow">Lịch sử hoạt động</span>
          <h2>Theo dõi hoạt động hệ thống</h2>
          <p>Xem ai đã thực hiện thao tác nào, vào thời điểm nào và liên quan đến nội dung gì.</p>
        </div>
        <button type="button" className="system-logs-page__refresh" onClick={refetch} disabled={loading}>
          <RefreshCw className={loading ? "is-spinning" : ""} size={17} />
          {loading ? "Đang cập nhật" : "Cập nhật"}
        </button>
      </header>

      <section className="system-logs-page__stats" aria-label="Chọn nhóm hoạt động">
        <button
          type="button"
          className={kind === "all" ? "active" : ""}
          onClick={() => setKind("all")}
          aria-pressed={kind === "all"}
        >
          <span className="system-logs-page__stat-icon"><Database size={19} /></span>
          <span className="system-logs-page__stat-copy">
            <strong>Tất cả hoạt động</strong>
            <small>Danh sách gần nhất từ toàn hệ thống</small>
          </span>
          <b>{Math.min(totalAudit + totalEvent, MAX_COMBINED_WINDOW).toLocaleString("vi-VN")}</b>
        </button>
        <button
          type="button"
          className={kind === "audit" ? "active" : ""}
          onClick={() => setKind("audit")}
          aria-pressed={kind === "audit"}
        >
          <span className="system-logs-page__stat-icon"><ClipboardList size={19} /></span>
          <span className="system-logs-page__stat-copy">
            <strong>Thay đổi quản trị</strong>
            <small>Cài đặt, dữ liệu và phân quyền</small>
          </span>
          <b>{totalAudit.toLocaleString("vi-VN")}</b>
        </button>
        <button
          type="button"
          className={kind === "event" ? "active" : ""}
          onClick={() => setKind("event")}
          aria-pressed={kind === "event"}
        >
          <span className="system-logs-page__stat-icon"><Activity size={19} /></span>
          <span className="system-logs-page__stat-copy">
            <strong>Hoạt động vận hành</strong>
            <small>Thao tác phát sinh trong nhà hàng</small>
          </span>
          <b>{totalEvent.toLocaleString("vi-VN")}</b>
        </button>
      </section>

      <section className="system-logs-page__toolbar" aria-label="Tìm kiếm và tùy chọn hiển thị">
        <label className="system-logs-page__search">
          <span>Tìm kiếm hoạt động</span>
          <div>
            <Search size={17} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo hành động, bàn, đơn hàng hoặc người thực hiện..."
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Xóa từ khóa tìm kiếm">
                <X size={16} />
              </button>
            )}
          </div>
        </label>
        <label className="system-logs-page__page-size">
          <span>Số hoạt động mỗi trang</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option} hoạt động</option>
            ))}
          </select>
        </label>
      </section>

      <div className="system-logs-page__meta">
        <span>
          Đang hiển thị <strong>{rangeStart.toLocaleString("vi-VN")}–{rangeEnd.toLocaleString("vi-VN")}</strong>
          {" "}trong tổng số <strong>{totalRows.toLocaleString("vi-VN")}</strong> hoạt động
        </span>
        {kind === "all" && <span>Để tải nhanh, danh sách này hiển thị tối đa 100 hoạt động gần nhất.</span>}
      </div>

      {error && (
        <div className="system-logs-page__error" role="alert">
          Không thể tải lịch sử hoạt động lúc này. Vui lòng thử cập nhật lại.
        </div>
      )}

      <section className="system-logs-page__table" aria-live="polite">
        <div className="system-logs-page__table-head">
          <span>Thời gian</span>
          <span>Nhóm hoạt động</span>
          <span>Nội dung</span>
          <span>Người thực hiện</span>
          <span>Liên quan đến</span>
          <span>Thông tin thêm</span>
        </div>

        {loading && entries.length === 0 ? (
          <div className="system-logs-page__state">Đang tải lịch sử hoạt động...</div>
        ) : entries.length === 0 ? (
          <div className="system-logs-page__state">
            {search ? "Không tìm thấy hoạt động phù hợp. Hãy thử từ khóa khác." : "Chưa có hoạt động nào được ghi nhận."}
          </div>
        ) : entries.map((entry) => (
          <article className="system-logs-page__row" key={entry.key}>
            <time data-label="Thời gian" dateTime={entry.at || undefined} title={entry.dateTime.full}>
              <strong>{entry.dateTime.date}</strong>
              <small>{entry.dateTime.time}</small>
            </time>
            <span data-label="Nhóm hoạt động" className={`system-logs-page__badge system-logs-page__badge--${entry.kind}`}>
              {entry.kindLabel}
            </span>
            <div data-label="Nội dung" className="system-logs-page__action" title={entry.title}>
              <strong>{entry.title}</strong>
              <small>{entry.scope}</small>
            </div>
            <span data-label="Người thực hiện" className="system-logs-page__actor" title={entry.actor}>{entry.actor}</span>
            <span data-label="Liên quan đến" className="system-logs-page__target" title={entry.target}>{entry.target}</span>
            <div data-label="Thông tin thêm"><ActivityDetails entry={entry} /></div>
          </article>
        ))}
      </section>

      <nav className="system-logs-page__pagination" aria-label="Chuyển trang lịch sử hoạt động">
        <button type="button" onClick={() => goToPage(1)} disabled={page <= 1 || loading} aria-label="Trang đầu">
          <ChevronFirst size={16} />
        </button>
        <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1 || loading}>
          <ChevronLeft size={16} /> Trang trước
        </button>
        <strong>Trang {page.toLocaleString("vi-VN")} / {totalPages.toLocaleString("vi-VN")}</strong>
        <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages || loading}>
          Trang sau <ChevronRight size={16} />
        </button>
        <button type="button" onClick={() => goToPage(totalPages)} disabled={page >= totalPages || loading} aria-label="Trang cuối">
          <ChevronLast size={16} />
        </button>
      </nav>
    </div>
  );
};

export { normalizeAuditLog, normalizeEventLog, sortByNewest };
export default SystemLogsPage;
