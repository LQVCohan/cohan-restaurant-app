import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./ReportsManagement.scss";

const STATUS_LABELS = {
  pending: "Chờ xử lý",
  confirmed: "Đã xác nhận",
  customer_attached: "Khách đã gắn bàn",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng phục vụ",
  served: "Đã phục vụ",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
  failed: "Lỗi xử lý",
  unknown: "Chưa rõ trạng thái",
};

const ORDER_TYPE_LABELS = {
  dine_in: "Tại bàn",
  takeaway: "Mang đi",
  delivery: "Giao hàng",
  unknown: "Chưa rõ loại đơn",
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
const formatNumber = (value) => Number(value || 0).toLocaleString("vi-VN");
const formatMoney = (value) => `${Math.round(Number(value || 0)).toLocaleString("vi-VN")}đ`;
const formatDate = (value) => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("vi-VN");
};

const formatDishQuantity = (quantity, dishName) => {
  const normalizedName = String(dishName || "").toLowerCase();
  const isWeightBasedDish =
    /(^|[\s\-\/])kg([\s\-\/]|$)/i.test(normalizedName) ||
    /kilogram|theo\s*k(?:g|í|ý)/i.test(normalizedName);
  return `${formatNumber(quantity)} ${isWeightBasedDish ? "kg" : "đơn vị đã bán"}`;
};

const buildRange = (days) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start: padDate(start), end: padDate(end) };
};

const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const sectionRows = (title, headers, rows, emptyText = "Không có dữ liệu") => [
  [title],
  headers,
  ...(rows.length ? rows : [[emptyText]]),
  [],
];

export const buildReportsCsv = (summary, { restaurantId, dateRange }) => {
  const topDish = summary.topDishes?.[0];
  const rows = [
    ...sectionRows("Tổng quan", ["Chỉ số", "Giá trị"], [
      ["Nhà hàng", restaurantId],
      ["Từ ngày", dateRange.start],
      ["Đến ngày", dateRange.end],
      ["Tổng đơn vận hành", summary.totalOrders || 0],
      ["Doanh thu ghi nhận", Math.round(summary.grossRevenue || 0)],
      ["Số ngày có doanh thu", (summary.revenueByDay || []).filter((r) => Number(r.grossRevenue || 0) > 0).length],
      ["Món bán nổi bật", topDish?.name || ""],
    ]),
    ...sectionRows("Doanh thu theo ngày", ["Ngày", "Số đơn", "Doanh thu ghi nhận"],
      (summary.revenueByDay || []).map((r) => [r.date, r.orders, Math.round(r.grossRevenue || 0)])),
    ...sectionRows("Trạng thái đơn", ["Mã trạng thái", "Trạng thái", "Số đơn"],
      (summary.byStatus || []).map((r) => [r.key, STATUS_LABELS[r.key] || r.label || r.key, r.count])),
    ...sectionRows("Loại đơn", ["Mã loại đơn", "Loại đơn", "Số đơn"],
      (summary.byOrderType || []).map((r) => [r.key, ORDER_TYPE_LABELS[r.key] || r.label || r.key, r.count])),
    ...sectionRows("Món bán nổi bật", ["Tên món", "Số lượng", "Doanh thu ghi nhận"],
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

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => String(restaurant.id || restaurant._id) === String(restaurantId)),
    [restaurantId, restaurants]
  );

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
  const averageRevenuePerOrder = Number(summary.totalOrders || 0) > 0
    ? Number(summary.grossRevenue || 0) / Number(summary.totalOrders || 1)
    : 0;
  const hasExportData = summary.totalOrders > 0 || summary.revenueByDay.length || summary.byStatus.length || summary.byOrderType.length || summary.topDishes.length;

  const exportCsv = () => {
    const csv = buildReportsCsv(summary, { restaurantId, dateRange });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-van-hanh_${restaurantId}_${dateRange.start}_${dateRange.end}.csv`;
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
      <section className="manager-reports-page__header">
        <div className="manager-reports-page__intro">
          <span className="manager-reports-page__eyebrow">Báo cáo vận hành</span>
          <h2>Báo cáo tổng hợp vận hành</h2>
          <p>
            Theo dõi đơn hàng, doanh thu ghi nhận, trạng thái phục vụ và món bán nổi bật theo từng khoảng thời gian.
          </p>
          <div className="manager-reports-page__period-pill">
            {formatDate(dateRange.start)} → {formatDate(dateRange.end)}
          </div>
        </div>
        <div className="manager-reports-page__filters">
          <select aria-label="Chọn nhà hàng" value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} disabled={restaurants.length === 0}>
            {restaurants.length === 0 ? <option value="">Chưa có nhà hàng</option> : restaurants.map((r) => {
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
          <div className="manager-reports-page__actions">
            <button type="button" onClick={navigateOrders} disabled={!restaurantId}>Xem đơn hàng liên quan</button>
            <button type="button" onClick={exportCsv} disabled={loading || !hasExportData}>Xuất CSV</button>
          </div>
        </div>
      </section>

      <div className="manager-reports-page__context" aria-label="Ngữ cảnh báo cáo">
        <span>{selectedRestaurant?.name || selectedRestaurant?.restaurantName || "Chưa chọn nhà hàng"}</span>
        <span>{loading ? "Đang đồng bộ dữ liệu" : "Dữ liệu theo kỳ đã chọn"}</span>
        <span>{formatNumber(summary.totalOrders)} đơn vận hành</span>
      </div>

      {loading ? <div className="manager-reports-page__state">Đang tải dữ liệu báo cáo...</div> : null}
      {error ? <div className="manager-reports-page__state manager-reports-page__state--error">Không thể tải báo cáo: {error.message}</div> : null}

      <div className="manager-reports-page__cards" aria-busy={loading}>
        <article>
          <p>Tổng đơn vận hành</p>
          <strong>{formatNumber(summary.totalOrders)}</strong>
          <small>Không gồm đơn chưa hợp lệ hoặc đã huỷ.</small>
        </article>
        <article>
          <p>Doanh thu ghi nhận</p>
          <strong>{formatMoney(summary.grossRevenue)}</strong>
          <small>Doanh thu từ đơn hoàn tất đã thanh toán.</small>
        </article>
        <article>
          <p>Số ngày có doanh thu</p>
          <strong>{formatNumber(revenueDays)}</strong>
          <small>Ngày phát sinh doanh thu trong kỳ đã chọn.</small>
        </article>
        <article>
          <p>Giá trị trung bình/đơn</p>
          <strong>{formatMoney(averageRevenuePerOrder)}</strong>
          <small>Dựa trên tổng doanh thu và đơn vận hành.</small>
        </article>
        <article className="manager-reports-page__card--wide">
          <p>Món bán nổi bật</p>
          <strong>{topDish?.name || "Chưa có dữ liệu"}</strong>
          <small>{topDish ? `${formatDishQuantity(topDish.quantity, topDish.name)} • ${formatMoney(topDish.revenue)}` : "Sẽ hiển thị khi có đơn hoàn tất đã thanh toán."}</small>
        </article>
      </div>

      <div className="manager-reports-page__grid">
        <section>
          <div className="manager-reports-page__section-head">
            <h3>Trạng thái đơn</h3>
            <small>{formatNumber(summary.byStatus.length)} nhóm</small>
          </div>
          {summary.byStatus.length ? (
            <ul>{summary.byStatus.map((row) => <li key={row.key}><span>{STATUS_LABELS[row.key] || row.label || row.key}</span><b>{formatNumber(row.count)}</b></li>)}</ul>
          ) : <EmptySection>Chưa có đơn vận hành trong kỳ.</EmptySection>}
        </section>
        <section>
          <div className="manager-reports-page__section-head">
            <h3>Loại đơn</h3>
            <small>{formatNumber(summary.byOrderType.length)} nhóm</small>
          </div>
          {summary.byOrderType.length ? (
            <ul>{summary.byOrderType.map((row) => <li key={row.key}><span>{ORDER_TYPE_LABELS[row.key] || row.label || row.key}</span><b>{formatNumber(row.count)}</b></li>)}</ul>
          ) : <EmptySection>Chưa có dữ liệu loại đơn trong kỳ.</EmptySection>}
        </section>
        <section>
          <div className="manager-reports-page__section-head">
            <h3>Món bán nổi bật</h3>
            <small>{formatNumber(summary.topDishes.length)} món</small>
          </div>
          {summary.topDishes.length ? (
            <ul>{summary.topDishes.map((dish) => <li key={dish.name}><span>{dish.name}<small>{formatMoney(dish.revenue)}</small></span><b>{formatDishQuantity(dish.quantity, dish.name)}</b></li>)}</ul>
          ) : <EmptySection>Chưa có dữ liệu món bán trong kỳ.</EmptySection>}
        </section>
        <section>
          <div className="manager-reports-page__section-head">
            <h3>Doanh thu theo ngày</h3>
            <small>{formatNumber(summary.revenueByDay.length)} ngày</small>
          </div>
          {summary.revenueByDay.length ? (
            <ul>{summary.revenueByDay.map((row) => <li key={row.date}><span>{formatDate(row.date)}<small>{formatNumber(row.orders)} đơn</small></span><b>{formatMoney(row.grossRevenue)}</b></li>)}</ul>
          ) : <EmptySection>Không có doanh thu trong khoảng thời gian đã chọn.</EmptySection>}
        </section>
      </div>
    </div>
  );
}
