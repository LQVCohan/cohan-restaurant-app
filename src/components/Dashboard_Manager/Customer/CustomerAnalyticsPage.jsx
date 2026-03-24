import React, { useContext } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "../../../context/AuthContext";
import "./CustomerAnalyticsPage.scss";

const GET_CUSTOMER_ANALYTICS = gql`
  query GetCustomerAnalytics($restaurantId: ID!) {
    customerAnalytics(restaurantId: $restaurantId) {
      restaurantId
      activeCustomerCount
      returningCustomerCount
      averageMembershipDays
      mostPopularDishes {
        dishName
        quantity
      }
      busiestDays {
        date
        orderCount
      }
    }
  }
`;

const CustomerAnalyticsPage = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const restaurantId = restaurants?.[0]?.id;

  const { data, loading } = useQuery(GET_CUSTOMER_ANALYTICS, {
    skip: !restaurantId,
    variables: { restaurantId },
    fetchPolicy: "network-only",
  });

  const analytics = data?.customerAnalytics;
  const topDishes = analytics?.mostPopularDishes || [];
  const busyDays = analytics?.busiestDays || [];

  const peakDay = busyDays[0];

  return (
    <div className="customer-analytics-page">
      <h2>Phân tích người dùng</h2>
      {loading ? <p>Đang tải dữ liệu...</p> : null}
      <div className="cap-grid">
        <div className="cap-card">
          <div className="label">Khách hoạt động</div>
          <div className="value">{analytics?.activeCustomerCount || 0}</div>
        </div>
        <div className="cap-card">
          <div className="label">Khách quay lại</div>
          <div className="value">{analytics?.returningCustomerCount || 0}</div>
        </div>
        <div className="cap-card">
          <div className="label">Thời gian gắn bó TB</div>
          <div className="value">{analytics?.averageMembershipDays || 0} ngày</div>
        </div>
        <div className="cap-card">
          <div className="label">Ngày đông nhất</div>
          <div className="value">{peakDay?.date || "—"}</div>
        </div>
      </div>

      <div className="cap-panels">
        <section className="cap-panel">
          <h3>Món ăn thông dụng</h3>
          {topDishes.map((x) => (
            <div className="cap-row" key={x.dishName}>
              <span>{x.dishName}</span>
              <b>{x.quantity}</b>
            </div>
          ))}
        </section>
        <section className="cap-panel">
          <h3>Mật độ theo ngày</h3>
          {busyDays.map((x) => (
            <div className="cap-row" key={x.date}>
              <span>{x.date}</span>
              <b>{x.orderCount} đơn</b>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

export default CustomerAnalyticsPage;
