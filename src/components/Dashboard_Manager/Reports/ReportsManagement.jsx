import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./ReportsManagement.scss";

const STATUS_LABELS = {
  pending: "Chờ xử lý",
  confirmed: "Đã xác nhận",
  customer_attached: "Khách đã gắn bàn",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  served: "Đã phục vụ",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
  failed: "Thất bại",
};

const ORDER_TYPE_LABELS = {
  dine_in: "Tại bàn",
  takeaway: "Mang đi",
  delivery: "Giao hàng",
};

const QUICK_RANGES = [
  { key: "today", label: "Hôm nay", days: 1 },
  { key: "7d", label: "7 ngày", days: 7 },
  { key: "30d", label: "30 ngày", days: 30 },
  { key: "custom", label: "Tùy chọn" },
];

const Q_REPORTS_OVERVIEW = gql`
  query ReportsOverview($restaurantId: ID!, $startAt: DateTime, $endAt: DateTime, $limit: Int) {
    reportsOverview(restaurantId: $restaurantId, startAt: $startAt, endAt: $endAt, limit: $limit) {
      totalOrders
      grossRevenue
      byStatus { key label count }
      byOrderType { key label count }
      topDishes { name quantity revenue }
      revenueByDay { date grossRevenue orders }
    }
  }
`;

const padDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const toStartDateTime = (d) => (d ? `${d}T00:00:00.000Z` : null);
const toEndDateTime = (d) => (d ? `${d}T23:59:59.999Z` : null);
const formatMoney = (value) => `${Math.round(Number(value || 0)).toLocaleString("vi-VN")}đ`;

const buildRange = (days) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start: padDate(start), end: padDate(end) };
};

const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const sectionRows = (title, headers, rows) => [
  [title],
  headers,
  ...(rows.length ? rows : [["EMPTY"]]),
  [],
];

export const buildReportsCsv = (summary, { restaurantId, dateRange }) => {
  const topDish = summary.topDishes?.[0];
  const rows = [
    ...sectionRows("SUMMARY", ["metric", "value"], [
      ["restaurantId", restaurantId],
      ["startAt", dateRange.start],
      ["endAt", dateRange.end],
      ["totalOrders", summary.totalOrders || 0],
      ["grossRevenue", Math.round(summary.grossRevenue || 0)],
      ["revenueDays", (summary.revenueByDay || []).filter((r) => Number(r.grossRevenue || 0) > 0).length],
      ["topDish", topDish?.name || ""],
    ]),
    ...sectionRows("REVENUE_BY_DAY", ["date", "orders", "grossRevenue"],
      (summary.revenueByDay || []).map((r) => [r.date, r.orders, Math.round(r.grossRevenue || 0)])),
    ...sectionRows("BY_STATUS", ["status", "label", "count"],
      (summary.byStatus || []).map((r) => [r.key, STATUS_LABELS[r.key] || r.label || r.key, r.count])),
    ...sectionRows("BY_ORDER_TYPE", ["orderType", "label", "count"],
      (summary.byOrderType || []).map((r) => [r.key, ORDER_TYPE_LABELS[r.key] || r.label || r.key, r.count])),
    ...sectionRows("TOP_DISHES", ["name", "quantity", "revenue"],
      (summary.topDishes || []).map((d) => [d.name, d.quantity, Math.round(d.revenue || 0)])),
  ];
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
};

const EmptySection = ({ children }) => <div className="manager-reports-page__empty">{children}</div>;

export default function ReportsManagement() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");
  const [quickRange, setQuickRange] = useState("30d");
  const [dateRange, setDateRange] = useState(() => buildRange(30));

  useEffect(() => {
    if (!restaurantId && restaurants.length > 0) {
      setRestaurantId(restaurants[0]?.id || restaurants[0]?._id || "");
    }
  }, [restaurantId, restaurants]);

  const applyQuickRange = (key) => {
    setQuickRange(key);
    const preset = QUICK_RANGES.find((range) => range.key === key);
    if (preset?.days) setDateRange(buildRange(preset.days));
  };

  const setCustomDate = (field, value) => {
    setQuickRange("custom");
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const variables = useMemo(() => ({
    restaurantId,
    startAt: toStartDateTime(dateRange.start),
    endAt: toEndDateTime(dateRange.end),
    limit: 2000,
  }), [restaurantId, dateRange]);

  const { data, loading, error } = useQuery(Q_REPORTS_OVERVIEW, {
    variables,
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });

  const summary = useMemo(() => data?.reportsOverview || {
    totalOrders: 0,
    grossRevenue: 0,
    byStatus: [],
    byOrderType: [],
    topDishes: [],
    revenueByDay: [],
  }, [data]);

  const revenueDays = useMemo(
    () => (summary.revenueByDay || []).filter((row) => Number(row.grossRevenue || 0) > 0).length,
    [summary.revenueByDay]
  );
  const topDish = summary.topDishes?.[0];
  const hasExportData = summary.totalOrders > 0 || summary.revenueByDay.length || summary.byStatus.length || summary.byOrderType.length || summary.topDishes.length;

  const exportCsv = () => {
    const csv = buildReportsCsv(summary, { restaurantId, dateRange });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reports_${restaurantId}_${dateRange.start}_${dateRange.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const navigateOrders = () => {
    window.dispatchEvent(new CustomEvent("manager:navigate", {
      detail: {
        page: "orders",
        source: "reports-management",
        query: { restaurantId, startAt: variables.startAt, endAt: variables.endAt },
      },
    }));
  };

  return (
    <div className="manager-reports-page">
      <div className="manager-reports-page__header">
        <div>
          <span className="manager-reports-page__eyebrow">UC19A • Operational reports</span>
          <h2>Báo cáo tổng hợp vận hành</h2>
          <p>Chỉ xem số liệu, phân tích và điều hướng sang module xử lý — không thao tác nghiệp vụ trong báo cáo.</p>
        </div>
        <div className="manager-reports-page__filters">
          <select aria-label="Chọn nhà hàng" value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} disabled={restaurants.length === 0}>
            {restaurants.length === 0 ? <option value="">Không có nhà hàng</option> : restaurants.map((r) => {
              const id = r.id || r._id;
              return <option key={id} value={id}>{r.name || r.restaurantName || id}</option>;
            })}
          </select>
          <div className="quick-range" role="group" aria-label="Chọn nhanh khoảng thời gian">
            {QUICK_RANGES.map((range) => (
              <button key={range.key} type="button" className={quickRange === range.key ? "is-active" : ""} onClick={() => applyQuickRange(range.key)}>
                {range.label}
              </button>
            ))}
          </div>
          <input aria-label="Ngày bắt đầu" type="date" value={dateRange.start} onChange={(e) => setCustomDate("start", e.target.value)} />
          <input aria-label="Ngày kết thúc" type="date" value={dateRange.end} onChange={(e) => setCustomDate("end", e.target.value)} />
          <button type="button" onClick={navigateOrders} disabled={!restaurantId}>Xem đơn hàng liên quan</button>
          <button type="button" onClick={exportCsv} disabled={loading || !hasExportData}>Xuất CSV</button>
        </div>
      </div>

      {loading ? <div className="manager-reports-page__state">Đang tải dữ liệu báo cáo...</div> : null}
      {error ? <div className="manager-reports-page__state manager-reports-page__state--error">Lỗi tải báo cáo: {error.message}</div> : null}

      <div className="manager-reports-page__cards" aria-busy={loading}>
        <article><p>Tổng đơn vận hành</p><strong>{summary.totalOrders}</strong><small>Không gồm draft/huỷ/thất bại</small></article>
        <article><p>Doanh thu gộp</p><strong>{formatMoney(summary.grossRevenue)}</strong><small>Completed + paid/partially refunded</small></article>
        <article><p>Số ngày có doanh thu</p><strong>{revenueDays}</strong><small>Trong kỳ đã chọn</small></article>
        <article><p>Món bán chạy nhất</p><strong>{topDish?.name || "Chưa có"}</strong><small>{topDish ? `${topDish.quantity} suất • ${formatMoney(topDish.revenue)}` : "Chưa phát sinh món hợp lệ"}</small></article>
      </div>

      <div className="manager-reports-page__grid">
        <section><h3>Phân bổ trạng thái</h3>{summary.byStatus.length ? <ul>{summary.byStatus.map((row) => <li key={row.key}><span>{STATUS_LABELS[row.key] || row.label || row.key}</span><b>{row.count}</b></li>)}</ul> : <EmptySection>Chưa có đơn vận hành trong kỳ.</EmptySection>}</section>
        <section><h3>Phân bổ loại đơn</h3>{summary.byOrderType.length ? <ul>{summary.byOrderType.map((row) => <li key={row.key}><span>{ORDER_TYPE_LABELS[row.key] || row.label || row.key}</span><b>{row.count}</b></li>)}</ul> : <EmptySection>Chưa có loại đơn để phân tích.</EmptySection>}</section>
        <section><h3>Top món bán chạy</h3>{summary.topDishes.length ? <ul>{summary.topDishes.map((dish) => <li key={dish.name}><span>{dish.name}<small>{formatMoney(dish.revenue)}</small></span><b>{dish.quantity}</b></li>)}</ul> : <EmptySection>Chưa có dữ liệu món hợp lệ.</EmptySection>}</section>
        <section><h3>Doanh thu theo ngày</h3>{summary.revenueByDay.length ? <ul>{summary.revenueByDay.map((row) => <li key={row.date}><span>{row.date}<small>{row.orders} đơn</small></span><b>{formatMoney(row.grossRevenue)}</b></li>)}</ul> : <EmptySection>Không có dữ liệu theo kỳ đã chọn.</EmptySection>}</section>
      </div>
    </div>
  );
}
