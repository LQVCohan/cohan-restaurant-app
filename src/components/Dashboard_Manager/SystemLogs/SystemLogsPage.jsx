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
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
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

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
};

const formatJson = (value) => {
  if (value === null || value === undefined || value === "") return "--";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const compactText = (...values) => values.filter(Boolean).join(" · ");

const objectLabel = (object) => {
  if (!object) return "--";
  return compactText(object.kind, object.code || object.id) || "--";
};

const normalizeAuditLog = (log) => ({
  key: `audit-${log.id}`,
  kind: "audit",
  kindLabel: "Audit",
  at: log.createdAt || log.updatedAt,
  title: log.action || "AUDIT",
  scope: log.module || log.entity || log.targetType || "audit",
  actor: log.actorName || log.actorRole || log.byUserId || log.actorId || "Hệ thống",
  target: log.targetName || compactText(log.entity || log.targetType, log.entityId || log.targetId) || "--",
  status: "audit",
  summary: compactText(log.module, log.entity, log.targetType),
  detail: {
    before: log.before,
    after: log.after,
    diff: log.diff,
    metadata: log.metadata,
  },
});

const normalizeEventLog = (log) => ({
  key: `event-${log.id}`,
  kind: "event",
  kindLabel: "Event",
  at: log.at || log.createdAt,
  title: log.verb || "event",
  scope: log.source || "event",
  actor: log.actorUserId || log.customerProfileId || "Hệ thống",
  target: objectLabel(log.target || log.object),
  status: log.status || "info",
  summary: compactText(objectLabel(log.object), log.orderId && `order:${log.orderId}`, log.tableId && `table:${log.tableId}`),
  detail: {
    meta: log.meta,
    diff: log.diff,
    ip: log.ip,
    userAgent: log.userAgent,
    correlationId: log.correlationId,
    sessionId: log.sessionId,
  },
});

const matchesSearch = (entry, search) => {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return [entry.title, entry.scope, entry.actor, entry.target, entry.summary, entry.status, formatJson(entry.detail)]
    .join(" ")
    .toLowerCase()
    .includes(q);
};

const clampPage = (value, totalPages) => Math.min(Math.max(Number(value) || 1, 1), totalPages);

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
      .filter((entry) => matchesSearch(entry, search))
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

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
        <h2>Chọn chi nhánh để xem nhật ký</h2>
        <p>Manager chỉ xem log trong phạm vi nhà hàng được phân quyền.</p>
      </div>
    );
  }

  return (
    <div className="system-logs-page">
      <header className="system-logs-page__header">
        <div>
          <span className="system-logs-page__eyebrow">Check log</span>
          <h2>Nhật ký hệ thống</h2>
          <p>Theo dõi audit log quản trị và event log vận hành theo từng trang.</p>
        </div>
        <button type="button" className="system-logs-page__refresh" onClick={refetch} disabled={loading}>
          <RefreshCw size={16} /> Làm mới
        </button>
      </header>

      <section className="system-logs-page__stats" aria-label="Tổng quan log">
        <button type="button" className={kind === "all" ? "active" : ""} onClick={() => setKind("all")}>
          <Database size={18} />
          <span>Tất cả</span>
          <strong>{Math.min(totalAudit + totalEvent, MAX_COMBINED_WINDOW).toLocaleString("vi-VN")}</strong>
        </button>
        <button type="button" className={kind === "audit" ? "active" : ""} onClick={() => setKind("audit")}>
          <ClipboardList size={18} />
          <span>Audit log</span>
          <strong>{totalAudit.toLocaleString("vi-VN")}</strong>
        </button>
        <button type="button" className={kind === "event" ? "active" : ""} onClick={() => setKind("event")}>
          <Activity size={18} />
          <span>Event log</span>
          <strong>{totalEvent.toLocaleString("vi-VN")}</strong>
        </button>
      </section>

      <section className="system-logs-page__toolbar" aria-label="Bộ lọc log">
        <label className="system-logs-page__search">
          <span>Tìm trong dữ liệu đang tải</span>
          <div>
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="action, module, bàn, order, người thao tác..."
            />
          </div>
        </label>
        <label>
          <span>Số dòng / trang</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option} dòng</option>
            ))}
          </select>
        </label>
      </section>

      <div className="system-logs-page__meta">
        <span>Hiển thị {rangeStart.toLocaleString("vi-VN")}–{rangeEnd.toLocaleString("vi-VN")} / {totalRows.toLocaleString("vi-VN")} bản ghi</span>
        {kind === "all" && <span>Tất cả đang gộp 100 bản ghi mới nhất từ hai nguồn log.</span>}
      </div>

      {error && <div className="system-logs-page__error">{error.message || "Không thể tải nhật ký hệ thống."}</div>}

      <section className="system-logs-page__table" aria-live="polite">
        <div className="system-logs-page__table-head">
          <span>Thời gian</span>
          <span>Loại</span>
          <span>Hành động</span>
          <span>Người thao tác</span>
          <span>Đối tượng</span>
          <span>Chi tiết</span>
        </div>

        {loading && entries.length === 0 ? (
          <div className="system-logs-page__state">Đang tải nhật ký...</div>
        ) : entries.length === 0 ? (
          <div className="system-logs-page__state">Chưa có log phù hợp.</div>
        ) : entries.map((entry) => (
          <article className="system-logs-page__row" key={entry.key}>
            <time dateTime={entry.at || undefined}>{formatDateTime(entry.at)}</time>
            <span className={`system-logs-page__badge system-logs-page__badge--${entry.kind}`}>{entry.kindLabel}</span>
            <strong title={entry.title}>{entry.title}</strong>
            <span title={entry.actor}>{entry.actor}</span>
            <span title={entry.target}>{entry.target}</span>
            <details>
              <summary>{entry.summary || entry.status || "Xem chi tiết"}</summary>
              <pre>{formatJson(entry.detail)}</pre>
            </details>
          </article>
        ))}
      </section>

      <nav className="system-logs-page__pagination" aria-label="Phân trang nhật ký hệ thống">
        <button type="button" onClick={() => goToPage(1)} disabled={page <= 1 || loading} aria-label="Trang đầu">
          <ChevronFirst size={16} />
        </button>
        <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1 || loading}>
          <ChevronLeft size={16} /> Trước
        </button>
        <strong>Trang {page.toLocaleString("vi-VN")} / {totalPages.toLocaleString("vi-VN")}</strong>
        <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages || loading}>
          Sau <ChevronRight size={16} />
        </button>
        <button type="button" onClick={() => goToPage(totalPages)} disabled={page >= totalPages || loading} aria-label="Trang cuối">
          <ChevronLast size={16} />
        </button>
      </nav>
    </div>
  );
};

export default SystemLogsPage;
