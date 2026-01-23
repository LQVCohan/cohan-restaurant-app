import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { Link } from "react-router-dom";
import "./OrderHistory.scss";

const ORDERS_BY_USER = gql`
  query OrdersByUser($userId: ID!, $limit: Int = 20, $cursor: ID) {
    ordersByUser(userId: $userId, limit: $limit, cursor: $cursor) {
      edges {
        cursor
        node {
          id
          orderCode
          orderType
          currentStatus
          createdAt
          restaurantId
          tableCode
          shipping {
            deliveryStatus
            driverName
            driverPhone
          }
          totals {
            grandTotal
          }
        }
      }
    }
  }
`;

const OrderHistory = ({ user }) => {
  const userId = user?.id;
  const { data, loading, error } = useQuery(ORDERS_BY_USER, {
    variables: { userId, limit: 20 },
    skip: !userId,
    fetchPolicy: "cache-and-network",
  });

  const orders = useMemo(
    () => data?.ordersByUser?.edges?.map((edge) => edge.node) ?? [],
    [data]
  );

  if (loading) {
    return (
      <div className="content-card fade-in">
        <div className="card-header">
          <h2 className="card-title">Lịch sử đơn hàng</h2>
        </div>
        <div className="empty-state">
          <div className="icon">⏳</div>
          <p>Đang tải đơn hàng...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content-card fade-in">
        <div className="card-header">
          <h2 className="card-title">Lịch sử đơn hàng</h2>
        </div>
        <div className="empty-state">
          <div className="icon">⚠️</div>
          <p>Không thể tải đơn hàng: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-card fade-in">
      <div className="card-header">
        <h2 className="card-title">Lịch sử đơn hàng</h2>
        <div className="spending-tag">
          Tổng chi tiêu: <span>{user.totalSpending?.toLocaleString()}đ</span>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🥡</div>
          <p>Bạn chưa có đơn hàng nào.</p>
          <button className="btn-save">Đặt món ngay</button>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-main">
                <div>
                  <div className="order-code">
                    Mã đơn: <strong>{order.orderCode || "N/A"}</strong>
                  </div>
                  <div className="order-meta">
                    <span>
                      Ngày tạo:{" "}
                      {new Date(order.createdAt).toLocaleString("vi-VN")}
                    </span>
                    {order.tableCode && (
                      <span>Bàn: {order.tableCode}</span>
                    )}
                  </div>
                </div>
                <div className="order-status">
                  <span className="badge">{order.currentStatus}</span>
                  <span className="amount">
                    {Number(order.totals?.grandTotal || 0).toLocaleString()}đ
                  </span>
                </div>
              </div>

              {order.orderType === "delivery" && (
                <div className="order-tracking">
                  <div>
                    Trạng thái giao hàng:{" "}
                    <strong>{order.shipping?.deliveryStatus || "Đang cập nhật"}</strong>
                  </div>
                  <Link
                    to={`/track-order/${order.id}`}
                    className="tracking-link"
                  >
                    Theo dõi đơn
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
