import React, { useContext, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  Users,
  Repeat2,
  Wallet,
  ReceiptText,
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
      totalOrderCount
      totalCustomerSpend
      averageOrderValue
      averageRepeatIntervalDays
      dormantCustomerCount
      highValueCustomerCount
      customerSegments {
        segmentKey
        segmentLabel
        customerCount
        percentage
      }
      churnRiskCustomers {
        userId
        fullName
        phone
        lastOrderAt
        daysSinceLastOrder
        totalOrders
        totalSpend
      }
      topValueCustomers {
        userId
        fullName
        phone
        totalOrders
        totalSpend
        averageOrderValue
        lastOrderAt
      }
      cohortRetention {
        cohortMonth
        cohortSize
        retainedCount
        retentionRate
      }
      recommendations {
        key
        title
        description
        priority
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

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatNumber = (value) =>
  new Intl.NumberFormat("vi-VN").format(Number(value || 0));

const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;

const formatDays = (value) => {
  const days = Math.round(Number(value || 0));
  return days > 0 ? `${days} ngày` : "—";
};

const getChurnRiskMeta = (daysSinceLastOrder) => {
  const days = Number(daysSinceLastOrder || 0);
  if (days >= 60) return { label: "Cao", className: "high" };
  if (days >= 45) return { label: "Trung bình", className: "medium" };
  return { label: "Thấp", className: "low" };
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

  const { data, loading, error, refetch } = useQuery(GET_CUSTOMER_ANALYTICS, {
    skip: !effectiveRestaurantId,
    variables: { restaurantId: effectiveRestaurantId },
    fetchPolicy: "network-only",
  });

  const analytics = data?.customerAnalytics;
  const topDishes = analytics?.mostPopularDishes || [];
  const busyDays = analytics?.busiestDays || [];

  const customerSegments = Array.isArray(analytics?.customerSegments)
    ? analytics.customerSegments
    : [];
  const churnRiskCustomers = Array.isArray(analytics?.churnRiskCustomers)
    ? analytics.churnRiskCustomers
    : [];
  const topValueCustomers = Array.isArray(analytics?.topValueCustomers)
    ? analytics.topValueCustomers
    : [];
  const cohortRetention = Array.isArray(analytics?.cohortRetention)
    ? analytics.cohortRetention
    : [];
  const recommendations = Array.isArray(analytics?.recommendations)
    ? analytics.recommendations
    : [];

  const activeCustomerCount = Number(analytics?.activeCustomerCount || 0);
  const returningCustomerCount = Number(analytics?.returningCustomerCount || 0);
  const totalOrderCount = Number(analytics?.totalOrderCount || 0);
  const totalCustomerSpend = Number(analytics?.totalCustomerSpend || 0);
  const averageOrderValue = Number(analytics?.averageOrderValue || 0);
  const averageRepeatIntervalDays = Number(
    analytics?.averageRepeatIntervalDays || 0,
  );
  const dormantCustomerCount = Number(analytics?.dormantCustomerCount || 0);
  const highValueCustomerCount = Number(analytics?.highValueCustomerCount || 0);
  const returningRate =
    activeCustomerCount > 0
      ? Math.round((returningCustomerCount / activeCustomerCount) * 100)
      : 0;

  const visibleCustomerSegments = customerSegments.filter(
    (item) => Number(item?.customerCount || 0) > 0,
  );

  const hasActionableInsight =
    totalOrderCount > 0 ||
    totalCustomerSpend > 0 ||
    customerSegments.some((item) => Number(item?.customerCount || 0) > 0) ||
    churnRiskCustomers.length > 0 ||
    topValueCustomers.length > 0 ||
    cohortRetention.length > 0;

  const maxDishQuantity = Math.max(
    ...topDishes.map((dish) => Number(dish?.quantity || 0)),
    1,
  );
  const maxDayOrders = Math.max(
    ...busyDays.map((day) => Number(day?.orderCount || 0)),
    1,
  );
  const maxTopValueSpend = Math.max(
    ...topValueCustomers.map((item) => Number(item?.totalSpend || 0)),
    1,
  );

  return (
    <section className="customer-analytics-page">
      <section className="customer-analytics-hero">
        <div>
          <p className="customer-analytics-hero__eyebrow">Phân tích khách hàng</p>
          <h2>Hiểu hành vi và mức độ quay lại của khách</h2>
          <p>
            Theo dõi chi tiêu, phân khúc khách, rủi ro rời bỏ và giữ chân theo cohort để
            vận hành hiệu quả hơn.
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
              <span className="customer-kpi__icon"><Users size={18} aria-hidden="true" /></span>
              <span className="customer-kpi__label">Khách hoạt động</span>
              <strong className="customer-kpi__value">{loading ? "..." : formatNumber(activeCustomerCount)}</strong>
              <p className="customer-kpi__help">Khách có tương tác/đơn hàng được ghi nhận.</p>
            </article>

            <article className={`customer-kpi customer-kpi--success ${loading ? "customer-kpi--loading" : ""}`}>
              <span className="customer-kpi__icon"><Repeat2 size={18} aria-hidden="true" /></span>
              <span className="customer-kpi__label">Khách quay lại</span>
              <strong className="customer-kpi__value">{loading ? "..." : formatNumber(returningCustomerCount)}</strong>
              <p className="customer-kpi__help">Nhóm khách có dấu hiệu quay lại.</p>
            </article>

            <article className={`customer-kpi customer-kpi--accent ${loading ? "customer-kpi--loading" : ""}`}>
              <span className="customer-kpi__icon"><Wallet size={18} aria-hidden="true" /></span>
              <span className="customer-kpi__label">Tổng chi tiêu</span>
              <strong className="customer-kpi__value customer-kpi__value--compact">{loading ? "..." : formatCurrency(totalCustomerSpend)}</strong>
              <p className="customer-kpi__help">Tổng giá trị đơn hợp lệ trong dữ liệu phân tích.</p>
            </article>

            <article className={`customer-kpi customer-kpi--neutral ${loading ? "customer-kpi--loading" : ""}`}>
              <span className="customer-kpi__icon"><ReceiptText size={18} aria-hidden="true" /></span>
              <span className="customer-kpi__label">Giá trị đơn TB</span>
              <strong className="customer-kpi__value customer-kpi__value--compact">{loading ? "..." : formatCurrency(averageOrderValue)}</strong>
              <p className="customer-kpi__help">Trung bình chi tiêu mỗi đơn.</p>
            </article>
          </div>

          <section className="customer-analytics-strip">
            <div>
              <span>Tỷ lệ quay lại</span>
              <strong>{loading ? "..." : `${returningRate}%`}</strong>
              <small>Dựa trên khách quay lại / khách hoạt động</small>
            </div>
            <div>
              <span>Tổng đơn</span>
              <strong>{loading ? "..." : formatNumber(totalOrderCount)}</strong>
              <small>Tổng đơn hợp lệ trong dữ liệu phân tích</small>
            </div>
            <div>
              <span>Chu kỳ quay lại TB</span>
              <strong>{loading ? "..." : formatDays(averageRepeatIntervalDays)}</strong>
              <small>Thời gian trung bình giữa các lần quay lại</small>
            </div>
            <div>
              <span>Khách cần chú ý</span>
              <strong>{loading ? "..." : formatNumber(dormantCustomerCount)}</strong>
              <small>{loading ? "..." : `${formatNumber(highValueCustomerCount)} khách giá trị cao`}</small>
            </div>
          </section>

          <section className="customer-analytics-panels">
            <section className="customer-panel customer-panel--primary">
              <div className="customer-panel__head">
                <div>
                  <h3>Món khách quan tâm</h3>
                  <p>Các món được gọi nhiều trong dữ liệu phân tích khách hàng.</p>
                </div>
              </div>
              {loading ? <div className="customer-panel__loading">Đang tải dữ liệu món...</div> : topDishes.length > 0 ? (
                <div className="customer-dish-list">
                  {topDishes.map((item, index) => {
                    const quantity = Number(item?.quantity || 0);
                    const progress = Math.max(0, Math.min(100, (quantity / maxDishQuantity) * 100));
                    return (
                      <div className="customer-dish-row" key={`${item.dishName}-${index}`}>
                        <div className="customer-rank">#{index + 1}</div>
                        <div className="customer-dish-row__body">
                          <div className="customer-dish-row__meta">
                            <strong>{item?.dishName || "Không rõ tên món"}</strong>
                            <span>{formatNumber(quantity)} lượt</span>
                          </div>
                          <div className="customer-progress"><span style={{ width: `${progress}%` }} /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="customer-empty-state"><h4>Chưa có dữ liệu món phổ biến</h4><p>Khi có đơn hoàn thành, các món được khách quan tâm sẽ hiển thị tại đây.</p></div>}
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
              {loading ? <div className="customer-panel__loading">Đang tải dữ liệu ngày...</div> : busyDays.length > 0 ? (
                <div className="customer-day-list">
                  {busyDays.map((item, index) => {
                    const count = Number(item?.orderCount || 0);
                    const progress = Math.max(0, Math.min(100, (count / maxDayOrders) * 100));
                    return (
                      <div className="customer-day-row" key={`${item.date}-${index}`}>
                        <div className="customer-day-row__top">
                          <strong>{formatDate(item?.date)}</strong>
                          <span>{formatNumber(count)} đơn</span>
                        </div>
                        <div className="customer-progress customer-progress--day">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="customer-empty-state"><h4>Chưa có dữ liệu mật độ đơn</h4><p>Dữ liệu sẽ rõ hơn khi nhà hàng có đơn hàng trong nhiều ngày.</p></div>}
            </section>
          </section>

          <section className="customer-insight-grid">
            <section className="customer-panel">
              <div className="customer-panel__head">
                <div>
                  <h3>Phân khúc khách hàng</h3>
                  <p>Các nhóm khách hàng theo dữ liệu phân tích hiện tại.</p>
                </div>
              </div>
              {loading ? <div className="customer-panel__loading">Đang tải phân khúc khách hàng...</div> : visibleCustomerSegments.length > 0 ? (
                <div className="customer-segment-list">
                  {visibleCustomerSegments.map((segment, index) => {
                    const percentage = Number(segment?.percentage || 0);
                    const progress = Math.max(0, Math.min(100, percentage));
                    return (
                      <div
                        className="customer-segment-row"
                        key={`${segment?.segmentKey || "segment"}-${index}`}
                      >
                        <div className="customer-segment-row__meta">
                          <strong>{segment?.segmentLabel || "Phân khúc chưa đặt tên"}</strong>
                          <span>
                            {formatNumber(segment?.customerCount)} khách •{" "}
                            {formatPercent(percentage)}
                          </span>
                        </div>
                        <div className="customer-progress">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="customer-empty-state"><h4>Chưa có dữ liệu phân khúc khách hàng.</h4></div>}
            </section>

            <section className="customer-panel">
              <div className="customer-panel__head"><div><h3>Khách có nguy cơ rời bỏ</h3><p>Theo dõi nhóm khách lâu chưa quay lại để chăm sóc kịp thời.</p></div></div>
              {loading ? <div className="customer-panel__loading">Đang tải khách có nguy cơ rời bỏ...</div> : churnRiskCustomers.length > 0 ? (
                <div className="customer-risk-list">
                  {churnRiskCustomers.map((customer, index) => {
                    const risk = getChurnRiskMeta(customer?.daysSinceLastOrder);
                    return (
                      <div className="customer-risk-row" key={`${customer?.userId || "risk"}-${index}`}>
                        <div className="customer-risk-row__top">
                          <strong>{customer?.fullName || "Khách chưa có tên"}</strong>
                          <span className={`customer-risk-badge customer-risk-badge--${risk.className}`}>
                            {risk.label}
                          </span>
                        </div>
                        <p>{customer?.phone || "Chưa có số điện thoại"}</p>
                        <div className="customer-risk-row__meta">
                          <span>{formatNumber(customer?.daysSinceLastOrder)} ngày chưa quay lại</span>
                          <span>{formatNumber(customer?.totalOrders)} đơn</span>
                          <span>{formatCurrency(customer?.totalSpend)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="customer-empty-state"><h4>Chưa có khách có nguy cơ rời bỏ.</h4></div>}
            </section>

            <section className="customer-panel">
              <div className="customer-panel__head"><div><h3>Khách giá trị cao</h3><p>Nhóm khách chi tiêu lớn cần duy trì trải nghiệm tốt.</p></div></div>
              {loading ? <div className="customer-panel__loading">Đang tải khách giá trị cao...</div> : topValueCustomers.length > 0 ? (
                <div className="customer-value-list">
                  {topValueCustomers.map((customer, index) => {
                    const spend = Number(customer?.totalSpend || 0);
                    const progress = Math.max(0, Math.min(100, (spend / maxTopValueSpend) * 100));
                    return (
                      <div className="customer-value-row" key={`${customer?.userId || "value"}-${index}`}>
                        <div className="customer-value-row__top">
                          <span className="customer-value-rank">#{index + 1}</span>
                          <strong>{customer?.fullName || "Khách chưa có tên"}</strong>
                        </div>
                        <div className="customer-value-row__meta">
                          <span>{formatCurrency(spend)}</span>
                          <span>{formatNumber(customer?.totalOrders)} đơn</span>
                          <span>AOV: {formatCurrency(customer?.averageOrderValue)}</span>
                          <span>Đơn gần nhất: {formatDate(customer?.lastOrderAt)}</span>
                        </div>
                        <div className="customer-progress">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="customer-empty-state"><h4>Chưa có khách giá trị cao.</h4></div>}
            </section>

            <section className="customer-panel">
              <div className="customer-panel__head"><div><h3>Cohort quay lại</h3><p>Theo dõi hiệu quả giữ chân theo từng cohort tháng.</p></div></div>
              {loading ? <div className="customer-panel__loading">Đang tải dữ liệu cohort...</div> : cohortRetention.length > 0 ? (
                <div className="customer-cohort-list">
                  {cohortRetention.map((cohort, index) => {
                    const rate = Number(cohort?.retentionRate || 0);
                    const progress = Math.max(0, Math.min(100, rate));
                    return (
                      <div className="customer-cohort-row" key={`${cohort?.cohortMonth || "cohort"}-${index}`}>
                        <div className="customer-cohort-row__meta">
                          <strong>{cohort?.cohortMonth || "—"}</strong>
                          <span>
                            {formatNumber(cohort?.retainedCount)} / {formatNumber(cohort?.cohortSize)} khách (
                            {formatPercent(rate)})
                          </span>
                        </div>
                        <div className="customer-progress customer-progress--day">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <div className="customer-empty-state"><h4>Chưa có đủ dữ liệu cohort.</h4></div>}
            </section>

            <section className="customer-panel customer-panel--full">
              <div className="customer-panel__head"><div><h3>Gợi ý hành động</h3><p>Các đề xuất từ hệ thống dựa trên dữ liệu hiện có.</p></div></div>
              {loading ? <div className="customer-panel__loading">Đang tải gợi ý hành động...</div> : recommendations.length > 0 ? (
                <div className="customer-recommendation-list">
                  {recommendations.map((item, index) => {
                    const priority = String(item?.priority || "LOW").toLowerCase();
                    const priorityClass = ["high", "medium", "low"].includes(priority)
                      ? priority
                      : "low";
                    return (
                      <article
                        className={`customer-recommendation-card customer-recommendation-card--${priorityClass}`}
                        key={`${item?.key || "recommendation"}-${index}`}
                      >
                        <h4>{item?.title || "Gợi ý"}</h4>
                        <p>{item?.description || "—"}</p>
                        <span>{String(item?.priority || "LOW")}</span>
                      </article>
                    );
                  })}
                </div>
              ) : <div className="customer-empty-state"><h4>Chưa có gợi ý hành động.</h4></div>}
            </section>
          </section>

          <section
            className={`customer-guidance ${!hasActionableInsight ? "customer-guidance--empty customer-guidance--action-center" : ""}`}
          >
            {!hasActionableInsight ? (
              <>
                <div>
                  <p className="customer-guidance__eyebrow">Bước tiếp theo</p>
                  <h3>Chưa đủ dữ liệu để phân tích khách hàng</h3>
                  <p>Hãy ghi nhận đơn hàng và hoàn thiện dữ liệu khách để hệ thống bắt đầu tạo insight hữu ích.</p>
                </div>
                <div className="customer-guidance__steps">
                  <div>
                    <ClipboardList size={16} aria-hidden="true" />
                    <span>Kiểm tra đơn</span>
                  </div>
                  <div>
                    <UserRoundCog size={16} aria-hidden="true" />
                    <span>Quản lý khách</span>
                  </div>
                  <div>
                    <Utensils size={16} aria-hidden="true" />
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
                <h3>
                  <BarChart3 size={16} aria-hidden="true" />
                  <span>Dùng insight để chăm sóc khách hàng hiệu quả hơn</span>
                </h3>
                <p>Tập trung vào nhóm có nguy cơ rời bỏ, khách giá trị cao và cohort giữ chân để tối ưu doanh thu.</p>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
};

export default CustomerAnalyticsPage;
