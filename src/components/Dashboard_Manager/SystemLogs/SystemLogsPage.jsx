import React, { useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { Activity, ClipboardList, RefreshCw, Search, ShieldCheck } from "lucide-react";
import "./SystemLogsPage.scss";

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

const LOG_LIMIT = 100;

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
  at: log.createdAt || log.updatedAt,
  title: log.action || "AUDIT",
  scope: log.module || log.entity || log.targetType || "audit",
  actor: log.actorName || log.actorRole || log.byUserId || log.actorId || "--",
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
  at: log.at || log.createdAt,
  title: log.verb || "event",
  scope: log.source || "event",
  actor: log.actorUserId || log.customerProfileId || "--",
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
  return [entry.title, entry.scope, entry.actor, entry.target, entry.summary, formatJson(entry.detail)]
    .join(" ")
    .toLowerCase()
    .includes(q);
};

const SystemLogsPage = ({ restaurantId, isAdmin = false }) => {
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const canQuery = Boolean(isAdmin || restaurantId);
  const scopedFilter = useMemo(
    () => (restaurantId ? { restaurantId } : {}),
    [restaurantId],
  );

  const auditQuery = useQuery(AUDIT_LOGS_QUERY, {
    variables: { filter: scopedFilter, limit: LOG_LIMIT, offset: 0 },
    skip: !canQuery || kind === "event",
    fetchPolicy: "cache-and-network",
  });

  const eventQuery = useQuery(EVENT_LOGS_QUERY, {
    variables: { filter: scopedFilter, limit: LOG_LIMIT, skip: 0 },
    skip: !canQuery || kind === "audit",
    fetchPolicy: "cache-and-network",
  });

  const entries = useMemo(() => {
    const auditRows = kind === "event" ? [] : (auditQuery.data?.auditLogs?.items || []).map(normalizeAuditLog);
    const eventRows = kind === "audit" ? [] : (eventQuery.data?.eventLogs?.items || []).map(normalizeEventLog);
    return [...auditRows, ...eventRows]
      .filter((entry) => matchesSearch(entry, search))
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }, [auditQuery.data?.auditLogs?.items, eventQuery.data?.eventLogs?.items, kind, search]);

  const loading = auditQuery.loading || eventQuery.loading;
  const error = auditQuery.error || eventQuery.error;
  const totalAudit = auditQuery.data?.auditLogs?.total || 0;
  const totalEvent = eventQuery.data?.eventLogs?.total || 0;

  const refetch = () => {
    if (kind !== "event") auditQuery.refetch?.();
    if (kind !== "audit") eventQuery.refetch?.();
  };

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
          <p>Theo dõi audit log quản trị và event log vận hành gần nhất.</p>
        </div>
        <button type="button" className="system-logs-page__refresh" onClick={refetch} disabled={loading}>
          <RefreshCw size={16} /> Làm mới
        </button>
      </header>

      <section className="system-logs-page__stats" aria-label="Tổng quan log">
        <article>
          <ClipboardList size={18} />
          <span>Audit log</span>
          <strong>{totalAudit.toLocaleString("vi-VN")}</strong>
        </article>
        <article>
          <Activity size={18} />
          <span>Event log</span>
          <strong>{totalEvent.toLocaleString("vi-VN")}</strong>
        </article>
      </section>

      <section className="system-logs-page__toolbar" aria-label="Bộ lọc log">
        <label>
          <span>Loại log</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="audit">Audit log</option>
            <option value="event">Event log</option>
          </select>
        </label>
        <label className="system-logs-page__search">
          <span>Tìm kiếm</span>
          <div>
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="action, module, bàn, order, người thao tác..."
            />
          </div>
        </label>
      </section>

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
            <time>{formatDateTime(entry.at)}</time>
            <span className={`system-logs-page__badge system-logs-page__badge--${entry.kind}`}>{entry.kind}</span>
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
    </div>
  );
};

export default SystemLogsPage;
