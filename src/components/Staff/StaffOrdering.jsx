import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { gql, useLazyQuery } from "@apollo/client";
import { AuthContext } from "../../context/AuthContext";
import useOrderManagement from "../../hooks/useOrderManagement";

import "./StaffOrdering.scss";

const STATUS_OPTIONS = [
  "ORDER_PLACED",
  "ORDER_CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
  "ORDER_COMPLETED",
  "ORDER_CANCELLED",
];

const ITEM_STATUS_OPTIONS = [
  "PENDING",
  "PREPARING",
  "READY",
  "SERVED",
  "CANCELLED",
];

const PRIORITY_LABELS = {
  HIGH: "Cao",
  MEDIUM: "Trung bình",
  LOW: "Thấp",
};

const FALLBACK_RESTAURANTS_QUERY = gql`
  query StaffOrderingRestaurantsFallback($managerId: ID!, $limit: Int = 20) {
    restaurantsByManager(managerId: $managerId, limit: $limit) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

export default function StaffOrdering() {
  const { user, restaurants } = useContext(AuthContext) || {};

  const [loadFallbackRestaurants, { data: fallbackData, loading: fallbackLoading }] =
    useLazyQuery(FALLBACK_RESTAURANTS_QUERY, {
      fetchPolicy: "network-only",
    });

  useEffect(() => {
    const hasRestaurants = Array.isArray(restaurants) && restaurants.length > 0;
    if (hasRestaurants || !user?.id) return;
    loadFallbackRestaurants({ variables: { managerId: user.id, limit: 20 } });
  }, [loadFallbackRestaurants, restaurants, user?.id]);

  const effectiveRestaurants = useMemo(() => {
    if (Array.isArray(restaurants) && restaurants.length > 0) {
      return restaurants;
    }

    const fallbackEdges = fallbackData?.restaurantsByManager?.edges || [];
    return fallbackEdges.map((edge) => edge?.node).filter(Boolean);
  }, [fallbackData, restaurants]);

  const restaurantId = useMemo(() => {
    const firstRestaurant = effectiveRestaurants?.[0];
    if (typeof firstRestaurant === "string") return firstRestaurant;
    return firstRestaurant?.id || null;
  }, [effectiveRestaurants]);

  const {
    loadOrdersAll,
    ordersAll,
    ordersAllLoading,
    ordersAllError,
    fetchOrderById,
    changeOrderStatus,
    changeOrderItemStatus,
  } = useOrderManagement({ restaurantId });

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    loadOrdersAll({ variables: { restaurantId, limit: 100 } });
  }, [restaurantId, loadOrdersAll]);

  const refreshSelectedOrder = useCallback(
    async (orderId) => {
      if (!orderId) return;
      const res = await fetchOrderById(orderId);
      if (res?.success) setSelectedOrder(res.data || null);
    },
    [fetchOrderById]
  );

  const handleSelectOrder = useCallback(
    async (order) => {
      setSelectedOrderId(order.id);
      await refreshSelectedOrder(order.id);
    },
    [refreshSelectedOrder]
  );

  const handleUpdateOrderStatus = useCallback(
    async (status) => {
      if (!restaurantId || !selectedOrderId || !status) return;
      setUpdating(true);
      try {
        const res = await changeOrderStatus({
          restaurantId,
          orderId: selectedOrderId,
          status,
        });
        if (!res?.success) {
          alert(res?.message || "Cập nhật trạng thái order thất bại");
        }
        await loadOrdersAll({ variables: { restaurantId, limit: 100 } });
        await refreshSelectedOrder(selectedOrderId);
      } finally {
        setUpdating(false);
      }
    },
    [changeOrderStatus, loadOrdersAll, refreshSelectedOrder, restaurantId, selectedOrderId]
  );

  const handleUpdateItemStatus = useCallback(
    async (item, status) => {
      if (!restaurantId || !selectedOrderId || !item?.dishId || !status) return;
      setUpdating(true);
      try {
        const res = await changeOrderItemStatus({
          restaurantId,
          orderId: selectedOrderId,
          dishId: item.dishId,
          status,
        });
        if (!res?.success) {
          alert(res?.message || "Cập nhật trạng thái món thất bại");
        }
        await refreshSelectedOrder(selectedOrderId);
      } finally {
        setUpdating(false);
      }
    },
    [changeOrderItemStatus, refreshSelectedOrder, restaurantId, selectedOrderId]
  );

  const sortedOrders = useMemo(
    () =>
      [...(ordersAll || [])].sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0) -
          new Date(a.updatedAt || a.createdAt || 0)
      ),
    [ordersAll]
  );

  const isResolvingRestaurant =
    !restaurantId && fallbackLoading && (!restaurants || restaurants.length === 0);

  if (isResolvingRestaurant) {
    return (
      <div className="staff-pos-layout" style={{ padding: 20 }}>
        Đang tải nhà hàng được liên kết...
      </div>
    );
  }

  if (!restaurantId) {
    return (
      <div className="staff-pos-layout" style={{ padding: 20 }}>
        Bạn chưa được liên kết với nhà hàng nào.
      </div>
    );
  }

  return (
    <div className="staff-pos-layout" style={{ padding: 20 }}>
      <h2>Staff Ordering - Danh sách đơn hàng</h2>
      <p style={{ color: "#666" }}>
        Dữ liệu thật được lấy/cập nhật qua các hàm có sẵn trong useOrderManagement.
      </p>

      <div style={{ display: "flex", gap: 20 }}>
        <div
          style={{
            width: "45%",
            border: "1px solid #ddd",
            borderRadius: 8,
            maxHeight: "75vh",
            overflowY: "auto",
            background: "#fff",
          }}
        >
          <div style={{ padding: 10, borderBottom: "1px solid #eee", fontWeight: 600 }}>
            Orders ({sortedOrders.length})
          </div>

          {ordersAllLoading && <div style={{ padding: 10 }}>Đang tải orders...</div>}
          {ordersAllError && (
            <div style={{ padding: 10, color: "red" }}>Lỗi: {ordersAllError.message}</div>
          )}

          {sortedOrders.map((order) => (
            <button
              key={order.id}
              onClick={() => handleSelectOrder(order)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: 12,
                background: selectedOrderId === order.id ? "#eff6ff" : "#fff",
                border: "none",
                borderBottom: "1px solid #f3f4f6",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600 }}>{order.orderCode}</div>
              <div style={{ fontSize: 13, color: "#555" }}>
                Bàn: {order.tableCode || "-"} • {order.currentStatus}
              </div>
              <div style={{ fontSize: 12, color: "#777" }}>
                Priority: {PRIORITY_LABELS[(order.priority || "").toUpperCase()] || order.priority || "MEDIUM"}
              </div>
            </button>
          ))}
        </div>

        <div
          style={{
            width: "55%",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            background: "#fff",
          }}
        >
          {!selectedOrder ? (
            <div>Chọn một order để xem chi tiết.</div>
          ) : (
            <>
              <h3 style={{ marginTop: 0 }}>{selectedOrder.orderCode}</h3>
              <p>
                Trạng thái: <strong>{selectedOrder.currentStatus}</strong>
              </p>
              <p>
                Priority: <strong>{PRIORITY_LABELS[(selectedOrder.priority || "").toUpperCase()] || selectedOrder.priority || "MEDIUM"}</strong>
              </p>
              <p>
                Tổng tiền: <strong>{Number(selectedOrder.totals?.grandTotal || 0).toLocaleString()}đ</strong>
              </p>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="order-status-select" style={{ fontWeight: 600 }}>
                  Cập nhật trạng thái order:
                </label>
                <select
                  id="order-status-select"
                  disabled={updating}
                  defaultValue=""
                  onChange={(e) => handleUpdateOrderStatus(e.target.value)}
                  style={{ marginLeft: 8 }}
                >
                  <option value="" disabled>
                    Chọn trạng thái
                  </option>
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <h4>Món trong đơn</h4>
              <div style={{ display: "grid", gap: 10 }}>
                {selectedOrder.items?.map((item, idx) => (
                  <div
                    key={`${item.dishId || item.name}_${idx}`}
                    style={{ border: "1px solid #f0f0f0", borderRadius: 6, padding: 10 }}
                  >
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 13, color: "#555" }}>
                      SL: {item.quantity} • Giá: {Number(item.unitPrice || item.price || 0).toLocaleString()}đ
                    </div>
                    <div style={{ fontSize: 13, color: "#555" }}>Ghi chú: {item.note || "-"}</div>
                    <div style={{ fontSize: 13, color: "#555" }}>
                      Trạng thái món: {item.status || "PENDING"}
                    </div>

                    <select
                      disabled={updating || !item.dishId}
                      defaultValue=""
                      onChange={(e) => handleUpdateItemStatus(item, e.target.value)}
                    >
                      <option value="" disabled>
                        Đổi trạng thái món
                      </option>
                      {ITEM_STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
