import React, { useContext, useEffect, useMemo, useState } from "react";
import useOrderManagement from "@/hooks/useOrderManagement";
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

export default function ReportsManagement() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");

  const {
    loadOrdersAll,
    ordersAll,
    ordersAllLoading,
    ordersAllError,
  } = useOrderManagement({ restaurantId });

  useEffect(() => {
    if (!restaurantId && restaurants.length > 0) {
      setRestaurantId(restaurants[0]?.id || "");
    }
  }, [restaurantId, restaurants]);

  useEffect(() => {
    if (!restaurantId) return;
    loadOrdersAll({
      variables: { restaurantId, limit: 200 },
      fetchPolicy: "network-only",
    });
  }, [restaurantId, loadOrdersAll]);

  const summary = useMemo(() => {
    const rows = Array.isArray(ordersAll) ? ordersAll : [];
    const result = {
      totalOrders: rows.length,
      grossRevenue: 0,
      byStatus: {},
      byOrderType: {},
      topDishes: [],
    };

    const dishMap = new Map();
    for (const order of rows) {
      const status = String(order?.currentStatus || "pending");
      const orderType = String(order?.orderType || "dine_in");
      const isCancelled = ["cancelled", "failed"].includes(status);
      const grandTotal = Number(order?.totals?.grandTotal || 0);

      result.byStatus[status] = (result.byStatus[status] || 0) + 1;
      result.byOrderType[orderType] = (result.byOrderType[orderType] || 0) + 1;

      if (!isCancelled) {
        result.grossRevenue += grandTotal;
      }

      for (const item of order?.items || []) {
        if (["cancelled", "returned"].includes(item?.status)) continue;
        const key = `${item?.dishId || item?.name || "unknown"}`;
        const prev = dishMap.get(key) || {
          name: item?.name || "Món không tên",
          qty: 0,
        };
        prev.qty += Number(item?.quantity || 0);
        dishMap.set(key, prev);
      }
    }

    result.topDishes = [...dishMap.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
    return result;
  }, [ordersAll]);

  return (
    <div className="manager-reports-page">
      <div className="manager-reports-page__header">
        <h2>Báo cáo tổng hợp vận hành</h2>
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
      </div>

      {ordersAllLoading && (
        <div className="manager-reports-page__state">
          Đang tải dữ liệu báo cáo...
        </div>
      )}
      {ordersAllError && (
        <div className="manager-reports-page__state manager-reports-page__state--error">
          Lỗi tải báo cáo: {ordersAllError.message}
        </div>
      )}

      {!ordersAllLoading && !ordersAllError && (
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
              <p>Loại đơn</p>
              <strong>{Object.keys(summary.byOrderType).length}</strong>
            </article>
          </div>

          <div className="manager-reports-page__grid">
            <section>
              <h3>Phân bổ trạng thái</h3>
              <ul>
                {Object.entries(summary.byStatus).map(([status, count]) => (
                  <li key={status}>
                    <span>{STATUS_LABELS[status] || status}</span>
                    <b>{count}</b>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3>Phân bổ loại đơn</h3>
              <ul>
                {Object.entries(summary.byOrderType).map(([type, count]) => (
                  <li key={type}>
                    <span>{ORDER_TYPE_LABELS[type] || type}</span>
                    <b>{count}</b>
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
                      <b>{dish.qty}</b>
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
