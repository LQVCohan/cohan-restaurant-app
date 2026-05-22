import React, { useContext, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  Users,
  Repeat2,
  TrendingUp,
  CalendarDays,
  Utensils,
  BarChart3,
  ClipboardList,
  UserRoundCog,
} from "lucide-react";
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

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const navigateManagerPage = (page) => {
  if (!["orders", "customers", "menu"].includes(page)) return;

  window.dispatchEvent(
    new CustomEvent("manager:navigate", {
      detail: {
        page,
        source: "customer-analytics",
      },
    }),
  );
};

const CustomerAnalyticsPage = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  const restaurantOptions = Array.isArray(restaurants) ? restaurants : [];
  const effectiveRestaurantId =
    selectedRestaurantId || restaurantOptions?.[0]?.id || "";

  const selectedRestaurant = useMemo(
    () =>
      restaurantOptions.find((item) => item.id === effectiveRestaurantId),
    [restaurantOptions, effectiveRestaurantId],
  );

  const { data, loading, error, refetch } = useQuery(GET_CUSTOMER_ANALYTICS, {
    skip: !effectiveRestaurantId,
    variables: { restaurantId: effectiveRestaurantId },
    fetchPolicy: "network-only",
  });

  const analytics = data?.customerAnalytics;
  const topDishes = analytics?.mostPopularDishes || [];
  const busyDays = analytics?.busiestDays || [];

  const activeCustomerCount = Number(analytics?.activeCustomerCount || 0);
  const returningCustomerCount = Number(analytics?.returningCustomerCount || 0);
  const averageMembershipDays = Number(analytics?.averageMembershipDays || 0);
  const returningRate =
    activeCustomerCount > 0
      ? Math.round((returningCustomerCount / activeCustomerCount) * 100)
      : 0;

  const totalPopularDishOrders = topDishes.reduce(
    (sum, item) => sum + Number(item?.quantity || 0),
    0,
  );
  const totalBusyDayOrders = busyDays.reduce(
    (sum, item) => sum + Number(item?.orderCount || 0),
    0,
  );
  const peakDay = busyDays[0];

  const maxDishQuantity = Math.max(
    ...topDishes.map((dish) => Number(dish?.quantity || 0)),
    1,
  );
  const maxDayOrders = Math.max(
    ...busyDays.map((day) => Number(day?.orderCount || 0)),
    1,
  );

  const isAnalyticsEmpty =
    !loading &&
    !error &&
    activeCustomerCount === 0 &&
    returningCustomerCount === 0 &&
    topDishes.length === 0 &&
    busyDays.length === 0;

  const hasAnyCustomerSignal =
    activeCustomerCount > 0 ||
    returningCustomerCount > 0 ||
    averageMembershipDays > 0;

  const hasOrderSignal =
    totalBusyDayOrders > 0 ||
    totalPopularDishOrders > 0 ||
    topDishes.length > 0 ||
    busyDays.length > 0;

  const membershipHelpText =
    activeCustomerCount > 0
      ? "Thời gian trung bình khách ở trong hệ thống."
      : averageMembershipDays > 0
        ? "Tính từ dữ liệu khách đã có, chưa phát sinh tương tác trong kỳ."
        : "Chưa có dữ liệu gắn bó đủ rõ.";

  return (
    <section className="customer-analytics-page">
      <section className="customer-analytics-hero">
        <div>
          <p className="customer-analytics-hero__eyebrow">Phân tích khách hàng</p>
          <h2>Hiểu hành vi và mức độ quay lại của khách</h2>
          <p>
            Theo dõi khách hoạt động, khách quay lại, món được quan tâm và ngày có
            mật độ đơn cao.
          </p>
        </div>

        <div className="customer-analytics-toolbar">
          <label className="customer-analytics-field">
            <span>Nhà hàng</span>
            <select
              value={effectiveRestaurantId}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
              disabled={restaurantOptions.length === 0}
            >
              {restaurantOptions.length === 0 ? (
                <option value="">Chưa có nhà hàng</option>
              ) : null}
              {restaurantOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="customer-analytics-refresh"
            onClick={() => refetch?.()}
            disabled={loading || !effectiveRestaurantId}
          >
            Làm mới
          </button>
        </div>
      </section>

      {error ? (
        <section className="customer-analytics-error">
          <span>Không thể tải dữ liệu phân tích khách hàng.</span>
          <button
            type="button"
            className="customer-analytics-refresh"
            onClick={() => refetch?.()}
            disabled={loading || !effectiveRestaurantId}
          >
            Thử lại
          </button>
        </section>
      ) : null}

      {!effectiveRestaurantId ? (
        <section className="customer-empty-state customer-empty-state--page">
          <h3>Chưa có nhà hàng để phân tích</h3>
          <p>Vui lòng tạo hoặc chọn nhà hàng trước khi xem phân tích khách hàng.</p>
        </section>
      ) : error ? null : (
        <>
          <div className="customer-analytics-kpis">
            <article className={`customer-kpi customer-kpi--primary ${loading ? "customer-kpi--loading" : ""}`}>
              <span className="customer-kpi__icon"><Users size={18} /></span>
              <span className="customer-kpi__label">Khách hoạt động</span>
              <strong className="customer-kpi__value">
                {loading ? "..." : activeCustomerCount}
              </strong>
              <p className="customer-kpi__help">
                Khách có tương tác/đơn hàng được ghi nhận.
              </p>
            </article>

            <article className={`customer-kpi customer-kpi--success ${loading ? "customer-kpi--loading" : ""}`}>
              <span className="customer-kpi__icon"><Repeat2 size={18} /></span>
              <span className="customer-kpi__label">Khách quay lại</span>
              <strong className="customer-kpi__value">
                {loading ? "..." : returningCustomerCount}
              </strong>
              <p className="customer-kpi__help">Nhóm khách có dấu hiệu quay lại.</p>
            </article>

            <article className={`customer-kpi customer-kpi--accent ${loading ? "customer-kpi--loading" : ""}`}>
              <span className="customer-kpi__icon"><TrendingUp size={18} /></span>
              <span className="customer-kpi__label">Tỷ lệ quay lại</span>
              <strong className="customer-kpi__value">
                {loading ? "..." : `${returningRate}%`}
              </strong>
              <p className="customer-kpi__help">
                Tính từ khách quay lại / khách hoạt động.
              </p>
            </article>

            <article className={`customer-kpi customer-kpi--neutral ${loading ? "customer-kpi--loading" : ""}`}>
              <span className="customer-kpi__icon"><CalendarDays size={18} /></span>
              <span className="customer-kpi__label">Gắn bó trung bình</span>
              <strong className="customer-kpi__value">
                {loading ? "..." : `${averageMembershipDays} ngày`}
              </strong>
              <p className="customer-kpi__help">{membershipHelpText}</p>
            </article>
          </div>

          <section
            className={`customer-analytics-strip ${
              isAnalyticsEmpty ? "customer-analytics-strip--empty" : ""
            }`}
          >
            <div>
              <span>Ngày đông nhất</span>
              <strong>{isAnalyticsEmpty ? "Chưa đủ dữ liệu" : formatDate(peakDay?.date)}</strong>
              <small>{peakDay ? `${peakDay.orderCount || 0} đơn` : "Chưa có dữ liệu"}</small>
            </div>
            <div>
              <span>Tổng đơn ghi nhận</span>
              <strong>{loading ? "..." : isAnalyticsEmpty ? 0 : totalBusyDayOrders}</strong>
              <small>{hasOrderSignal ? "Từ dữ liệu mật độ theo ngày" : "Chưa ghi nhận đơn theo ngày"}</small>
            </div>
            <div>
              <span>Lượt món phổ biến</span>
              <strong>{loading ? "..." : isAnalyticsEmpty ? 0 : totalPopularDishOrders}</strong>
              <small>{hasOrderSignal ? "Từ danh sách món được gọi nhiều" : "Chưa có danh sách món phổ biến"}</small>
            </div>
            <div>
              <span>Nhà hàng</span>
              <strong>{selectedRestaurant?.name || "—"}</strong>
              <small>{hasAnyCustomerSignal ? "Đang phân tích" : "Sẵn sàng khi có dữ liệu khách"}</small>
            </div>
          </section>

          <section
            className={`customer-analytics-panels ${
              isAnalyticsEmpty ? "customer-analytics-panels--empty" : ""
            }`}
          >
            <section className="customer-panel customer-panel--primary">
              <div className="customer-panel__head">
                <div>
                  <h3>Món khách quan tâm</h3>
                  <p>Các món được gọi nhiều trong dữ liệu phân tích khách hàng.</p>
                </div>
              </div>

              {loading ? (
                <div className="customer-panel__loading">Đang tải dữ liệu món...</div>
              ) : topDishes.length > 0 ? (
                <div className="customer-dish-list">
                  {topDishes.map((item, index) => {
                    const quantity = Number(item?.quantity || 0);
                    const progress = Math.max(
                      0,
                      Math.min(100, (quantity / maxDishQuantity) * 100),
                    );

                    return (
                      <div className="customer-dish-row" key={`${item.dishName}-${index}`}>
                        <div className="customer-rank">#{index + 1}</div>
                        <div className="customer-dish-row__body">
                          <div className="customer-dish-row__meta">
                            <strong>{item?.dishName || "Không rõ tên món"}</strong>
                            <span>{quantity} lượt</span>
                          </div>
                          <div className="customer-progress">
                            <span style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="customer-empty-state">
                  <h4>{isAnalyticsEmpty ? "Chưa có món được ghi nhận" : "Chưa có dữ liệu món phổ biến"}</h4>
                  <p>
                    {isAnalyticsEmpty
                      ? "Khi có đơn hoàn thành, hệ thống sẽ hiển thị món khách quan tâm nhất."
                      : "Khi có đơn hoàn thành, các món được khách quan tâm sẽ hiển thị tại đây."}
                  </p>
                </div>
              )}
            </section>

            <section className="customer-panel">
              <div className="customer-panel__head">
                <div>
                  <h3>Mật độ đơn theo ngày</h3>
                  <p>
                    Nhận diện ngày có nhiều tương tác/đơn để chuẩn bị nhân sự và tồn
                    kho.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="customer-panel__loading">Đang tải dữ liệu ngày...</div>
              ) : busyDays.length > 0 ? (
                <div className="customer-day-list">
                  {busyDays.map((item, index) => {
                    const count = Number(item?.orderCount || 0);
                    const progress = Math.max(
                      0,
                      Math.min(100, (count / maxDayOrders) * 100),
                    );

                    return (
                      <div className="customer-day-row" key={`${item.date}-${index}`}>
                        <div className="customer-day-row__top">
                          <strong>{formatDate(item?.date)}</strong>
                          <span>{count} đơn</span>
                        </div>
                        <div className="customer-progress customer-progress--day">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="customer-empty-state">
                  <h4>{isAnalyticsEmpty ? "Chưa có mật độ đơn" : "Chưa có dữ liệu mật độ đơn"}</h4>
                  <p>
                    Dữ liệu sẽ rõ hơn khi nhà hàng có đơn hàng trong nhiều ngày.
                  </p>
                </div>
              )}
            </section>
          </section>

          <section
            className={`customer-guidance ${isAnalyticsEmpty ? "customer-guidance--empty customer-guidance--action-center" : ""}`}
          >
            {isAnalyticsEmpty ? (
              <>
                <div>
                  <p className="customer-guidance__eyebrow">Bước tiếp theo</p>
                  <h3>Chưa đủ dữ liệu để phân tích khách hàng</h3>
                  <p>
                    Hãy ghi nhận đơn hàng và hoàn thiện dữ liệu khách để hệ thống bắt đầu tạo insight hữu ích.
                  </p>
                </div>
                <div className="customer-guidance__steps">
                  <div>
                    <ClipboardList size={16} />
                    <span>Kiểm tra đơn</span>
                  </div>
                  <div>
                    <UserRoundCog size={16} />
                    <span>Quản lý khách</span>
                  </div>
                  <div>
                    <Utensils size={16} />
                    <span>Kiểm tra menu</span>
                  </div>
                </div>
                <div className="customer-guidance__actions">
                  <button
                    type="button"
                    aria-label="Đi tới quản lý đơn hàng"
                    onClick={() => navigateManagerPage("orders")}
                  >
                    Xem đơn hàng
                  </button>
                  <button
                    type="button"
                    aria-label="Đi tới quản lý khách hàng"
                    onClick={() => navigateManagerPage("customers")}
                  >
                    Quản lý khách hàng
                  </button>
                  <button
                    type="button"
                    aria-label="Đi tới quản lý menu"
                    onClick={() => navigateManagerPage("menu")}
                  >
                    Kiểm tra menu
                  </button>
                </div>
              </>
            ) : (
              <div>
                <p className="customer-guidance__eyebrow">Gợi ý vận hành</p>
                <h3><BarChart3 size={16} /> Tập trung vào nhóm khách quay lại và món được quan tâm</h3>
                <p>
                  Dùng dữ liệu này để chuẩn bị tồn kho, nhân sự và chương trình chăm
                  sóc khách hàng phù hợp.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
};

export default CustomerAnalyticsPage;
