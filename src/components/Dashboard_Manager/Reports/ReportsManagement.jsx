import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./ReportsManagement.scss";

const STATUS_LABELS = {
  pending: "Chờ xử lý",
  confirmed: "Đã xác nhận",
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

const Q_REPORTS_OVERVIEW = gql`
  query ReportsOverview($restaurantId: ID!, $startAt: DateTime, $endAt: DateTime, $limit: Int) {
    reportsOverview(restaurantId: $restaurantId, startAt: $startAt, endAt: $endAt, limit: $limit) {
      totalOrders
      grossRevenue
      byStatus {
        key
        label
        count
      }
      byOrderType {
        key
        label
        count
      }
      topDishes {
        name
        quantity
        revenue
      }
      revenueByDay {
        date
        grossRevenue
        orders
      }
    }
  }
`;

const toInputDateTime = (d) => (d ? `${d}T00:00:00.000Z` : null);

export default function ReportsManagement() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  });

  useEffect(() => {
    if (!restaurantId && restaurants.length > 0) {
      setRestaurantId(restaurants[0]?.id || "");
    }
  }, [restaurantId, restaurants]);

  const { data, loading, error } = useQuery(Q_REPORTS_OVERVIEW, {
    variables: {
      restaurantId,
      startAt: toInputDateTime(dateRange.start),
      endAt: toInputDateTime(dateRange.end),
      limit: 2000,
    },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });

  const summary = useMemo(
    () =>
      data?.reportsOverview || {
        totalOrders: 0,
        grossRevenue: 0,
        byStatus: [],
        byOrderType: [],
        topDishes: [],
        revenueByDay: [],
      },
    [data]
  );

  const exportCsv = () => {
    const headers = ["date", "orders", "grossRevenue"];
    const rows = summary.revenueByDay || [];
    const csv = [
      headers.join(","),
      ...rows.map((r) => [r.date, r.orders, Math.round(r.grossRevenue || 0)].join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reports_${restaurantId}_${dateRange.start}_${dateRange.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="manager-reports-page">
      <div className="manager-reports-page__header">
        <h2>Báo cáo tổng hợp vận hành</h2>
        <div className="manager-reports-page__filters">
          <select
            value={restaurantId}
            onChange={(e) => setRestaurantId(e.target.value)}
            disabled={restaurants.length === 0}
          >
            {restaurants.length === 0 ? (
              <option value="">Không có nhà hàng</option>
            ) : (
              restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || r.id}
                </option>
              ))
            )}
          </select>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
          />
          <button onClick={exportCsv} disabled={loading || summary.revenueByDay.length === 0}>
            Xuất CSV
          </button>
        </div>
      </div>

      {loading && <div className="manager-reports-page__state">Đang tải dữ liệu báo cáo...</div>}
      {error && (
        <div className="manager-reports-page__state manager-reports-page__state--error">
          Lỗi tải báo cáo: {error.message}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="manager-reports-page__cards">
            <article>
              <p>Tổng đơn</p>
              <strong>{summary.totalOrders}</strong>
            </article>
            <article>
              <p>Doanh thu gộp (không gồm huỷ)</p>
              <strong>{Math.round(summary.grossRevenue).toLocaleString()}đ</strong>
            </article>
            <article>
              <p>Số ngày có doanh thu</p>
              <strong>{summary.revenueByDay.length}</strong>
            </article>
          </div>

          <div className="manager-reports-page__grid">
            <section>
              <h3>Phân bổ trạng thái</h3>
              <ul>
                {summary.byStatus.map((row) => (
                  <li key={row.key}>
                    <span>{STATUS_LABELS[row.key] || row.label || row.key}</span>
                    <b>{row.count}</b>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3>Phân bổ loại đơn</h3>
              <ul>
                {summary.byOrderType.map((row) => (
                  <li key={row.key}>
                    <span>{ORDER_TYPE_LABELS[row.key] || row.label || row.key}</span>
                    <b>{row.count}</b>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3>Top món bán chạy</h3>
              {summary.topDishes.length === 0 ? (
                <p>Chưa có dữ liệu món.</p>
              ) : (
                <ul>
                  {summary.topDishes.map((dish) => (
                    <li key={dish.name}>
                      <span>{dish.name}</span>
                      <b>{dish.quantity}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3>Doanh thu theo ngày</h3>
              {summary.revenueByDay.length === 0 ? (
                <p>Không có dữ liệu theo kỳ đã chọn.</p>
              ) : (
                <ul>
                  {summary.revenueByDay.slice(-10).map((row) => (
                    <li key={row.date}>
                      <span>{row.date}</span>
                      <b>{Math.round(row.grossRevenue || 0).toLocaleString()}đ</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
