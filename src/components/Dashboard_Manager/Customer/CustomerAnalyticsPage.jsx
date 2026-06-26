import React, { useContext, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ClipboardList,
  Clock3,
  Phone,
  ReceiptText,
  RefreshCw,
  Repeat2,
  Search,
  Store,
  UserRoundCog,
  Users,
  Utensils,
  Wallet,
} from "lucide-react";
import { AuthContext } from "../../../context/AuthContext";
import "./CustomerAnalyticsPage.scss";
import "./CustomerAnalyticsScrollPanels.scss";

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

const formatDishQuantity = (quantity, dishName) => {
  const normalizedName = String(dishName || "").toLowerCase();
  const isWeightBasedDish =
    /(^|[\s\-\/])kg([\s\-\/]|$)/i.test(normalizedName) ||
    /kilogram|theo\s*k(?:g|í|ý)/i.test(normalizedName);

  return `${formatNumber(quantity)} ${isWeightBasedDish ? "kg" : "đơn vị đã bán"}`;
};

const CUSTOMER_SEGMENT_LABELS = {
  NEW: "Khách mới",
  REPEAT: "Khách quay lại",
  DORMANT: "Khách lâu chưa quay lại",
  HIGH_VALUE: "Khách giá trị cao",
};

const getCustomerSegmentLabel = (segment) =>
  CUSTOMER_SEGMENT_LABELS[String(segment?.segmentKey || "").toUpperCase()] ||
  segment?.segmentLabel ||
  "Phân khúc chưa đặt tên";

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

const PRIORITY_LABELS = {
  HIGH: "Ưu tiên cao",
  MEDIUM: "Ưu tiên vừa",
  LOW: "Theo dõi",
};

const navigateManagerPage = (page, query = {}) => {
  if (!["orders", "customers", "menu"].includes(page)) return;

  window.dispatchEvent(
    new CustomEvent("manager:navigate", {
      detail: {
        page,
        query,
        source: "customer-analytics",
      },
    }),
  );
};

const getInitials = (name = "") => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "KH";

  return parts
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const ProgressBar = ({ value = 0, variant = "default" }) => (
  <div className={`customer-progress customer-progress--${variant}`}>
    <span style={{ width: `${Math.max(0, Math.min(100, Number(value || 0)))}%` }} />
  </div>
);

const CustomerAvatar = ({ name }) => (
  <span className="customer-avatar" aria-hidden="true">
    {getInitials(name)}
  </span>
);

const EmptyState = ({ title, description, actionLabel, onAction }) => (
  <div className="customer-empty-state">
    <h4>{title}</h4>
    {description ? <p>{description}</p> : null}
    {actionLabel && onAction ? (
      <button type="button" onClick={onAction}>
        {actionLabel}
      </button>
    ) : null}
  </div>
);

const CustomerAnalyticsPage = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  const restaurantOptions = Array.isArray(restaurants) ? restaurants : [];
  const effectiveRestaurantId =
    selectedRestaurantId || restaurantOptions?.[0]?.id || "";
  const selectedRestaurant = restaurantOptions.find(
    (item) => String(item?.id || "") === String(effectiveRestaurantId),
  );

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

  const commandItems = useMemo(
    () => [
      {
        label: "Khách cần chăm sóc",
        value: dormantCustomerCount,
        help: "Lâu chưa quay lại hoặc cần kiểm tra lịch sử mua",
        cta: "Mở danh sách khách",
        icon: AlertTriangle,
        tone: dormantCustomerCount > 0 ? "warning" : "calm",
        onClick: () => navigateManagerPage("customers", { segment: "dormant" }),
      },
      {
        label: "Khách giá trị cao",
        value: highValueCustomerCount,
        help: "Ưu tiên giữ trải nghiệm ổn định cho nhóm này",
        cta: "Xem nhóm giá trị cao",
        icon: Wallet,
        tone: "premium",
        onClick: () => navigateManagerPage("customers", { segment: "high-value" }),
      },
      {
        label: "Chu kỳ quay lại",
        value: formatDays(averageRepeatIntervalDays),
        help: "Dùng để hẹn chiến dịch nhắc quay lại đúng thời điểm",
        cta: "Xem đơn gần đây",
        icon: Clock3,
        tone: "calm",
        onClick: () => navigateManagerPage("orders", { view: "recent" }),
      },
    ],
    [averageRepeatIntervalDays, dormantCustomerCount, highValueCustomerCount],
  );

  return (
    <section className="customer-analytics-page">
      <section className="customer-analytics-hero">
        <div className="customer-analytics-hero__copy">
          <p className="customer-analytics-hero__eyebrow">Phân tích khách hàng</p>
          <h2>Hiểu khách, chọn đúng nhóm cần chăm sóc</h2>
          <p>
            Theo dõi chi tiêu, phân khúc khách, rủi ro rời bỏ và khả năng quay lại
            theo từng nhóm tháng trong một màn hình dễ thao tác cho quản lý ca.
          </p>
          <div className="customer-analytics-quick-actions" aria-label="Thao tác nhanh">
            <button type="button" onClick={() => navigateManagerPage("customers")}>
              <Users size={15} aria-hidden="true" />
              Danh sách khách
            </button>
            <button type="button" onClick={() => navigateManagerPage("orders")}>
              <ReceiptText size={15} aria-hidden="true" />
              Lịch sử đơn
            </button>
            <button type="button" onClick={() => navigateManagerPage("menu")}>
              <Utensils size={15} aria-hidden="true" />
              Kiểm tra menu
            </button>
          </div>
        </div>

        <div className="customer-analytics-toolbar" aria-label="Bộ lọc phân tích khách hàng">
          <label className="customer-analytics-field">
            <span>
              <Store size={14} aria-hidden="true" />
              Nhà hàng
            </span>
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
            <RefreshCw size={15} aria-hidden="true" />
            Làm mới
          </button>
        </div>
      </section>

      <div className="customer-analytics-context">
        <span>{selectedRestaurant?.name || "Chưa chọn nhà hàng"}</span>
        <span>{loading ? "Đang đồng bộ dữ liệu" : "Dữ liệu khách hàng hiện tại"}</span>
        <span>{formatNumber(activeCustomerCount)} khách có đơn</span>
      </div>

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
          <button type="button" onClick={() => navigateManagerPage("customers")}>
            Quản lý khách hàng
          </button>
        </section>
      ) : error ? null : (
        <>
          <div className="customer-analytics-kpis">
            <article className={`customer-kpi customer-kpi--primary ${loading ? "customer-kpi--loading" : ""}`}>
              <span className="customer-kpi__icon"><Users size={18} aria-hidden="true" /></span>
              <span className="customer-kpi__label">Khách có đơn</span>
              <strong className="customer-kpi__value">{loading ? "..." : formatNumber(activeCustomerCount)}</strong>
              <p className="customer-kpi__help">Khách có ít nhất một đơn hàng hợp lệ.</p>
            </article>

            <article className={`customer-kpi customer-kpi--success ${loading ? "customer-kpi--loading" : ""}`}>
              <span className="customer-kpi__icon"><Repeat2 size={18} aria-hidden="true" /></span>
              <span className="customer-kpi__label">Khách quay lại</span>
              <strong className="customer-kpi__value">{loading ? "..." : formatNumber(returningCustomerCount)}</strong>
              <p className="customer-kpi__help">Khách có từ hai đơn hợp lệ trở lên.</p>
            </article>

            <article className={`customer-kpi customer-kpi--accent ${loading ? "customer-kpi--loading" : ""}`}>
              <span className="customer-kpi__icon"><Wallet size={18} aria-hidden="true" /></span>
              <span className="customer-kpi__label">Tổng chi tiêu</span>
              <strong className="customer-kpi__value customer-kpi__value--compact">{loading ? "..." : formatCurrency(totalCustomerSpend)}</strong>
              <p className="customer-kpi__help">Tổng giá trị đơn hợp lệ trong dữ liệu phân tích.</p>
            </article>

            <article className={`customer-kpi customer-kpi--neutral ${loading ? "customer-kpi--loading" : ""}`}>
              <span className="customer-kpi__icon"><ReceiptText size={18} aria-hidden="true" /></span>
              <span className="customer-kpi__label">Giá trị đơn trung bình</span>
              <strong className="customer-kpi__value customer-kpi__value--compact">{loading ? "..." : formatCurrency(averageOrderValue)}</strong>
              <p className="customer-kpi__help">Trung bình chi tiêu trên mỗi đơn hợp lệ.</p>
            </article>
          </div>

          <section className="customer-analytics-strip">
            <div>
              <span>Tỷ lệ quay lại</span>
              <strong>{loading ? "..." : `${returningRate}%`}</strong>
              <small>Dựa trên khách quay lại / khách có đơn</small>
            </div>
            <div>
              <span>Tổng đơn</span>
              <strong>{loading ? "..." : formatNumber(totalOrderCount)}</strong>
              <small>Tổng đơn hợp lệ trong dữ liệu phân tích</small>
            </div>
            <div>
              <span>Chu kỳ quay lại trung bình</span>
              <strong>{loading ? "..." : formatDays(averageRepeatIntervalDays)}</strong>
              <small>Thời gian trung bình giữa các lần mua lại</small>
            </div>
            <div>
              <span>Khách cần chú ý</span>
              <strong>{loading ? "..." : formatNumber(dormantCustomerCount)}</strong>
              <small>{loading ? "..." : `${formatNumber(highValueCustomerCount)} khách giá trị cao`}</small>
            </div>
          </section>

          <section className="customer-action-deck" aria-label="Bảng thao tác khách hàng">
            {commandItems.map((item) => (
              <article className={`customer-command-card customer-command-card--${item.tone}`} key={item.label}>
                <span className="customer-command-card__icon"><item.icon size={17} aria-hidden="true" /></span>
                <div>
                  <span>{item.label}</span>
                  <strong>{loading ? "..." : typeof item.value === "number" ? formatNumber(item.value) : item.value}</strong>
                  <p>{item.help}</p>
                  <button type="button" onClick={item.onClick}>
                    {item.cta} <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </section>

          <section className="customer-analytics-panels">
            <section className="customer-panel customer-panel--primary">
              <div className="customer-panel__head">
                <div>
                  <h3>Món bán nổi bật</h3>
                  <p>Tổng số lượng món đã bán trong dữ liệu phân tích khách hàng.</p>
                </div>
                <button type="button" onClick={() => navigateManagerPage("menu")}>
                  Menu <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
              {loading ? <div className="customer-panel__loading">Đang tải dữ liệu món...</div> : topDishes.length > 0 ? (
                <div className="customer-dish-list">
                  {topDishes.map((item, index) => {
                    const quantity = Number(item?.quantity || 0);
                    const progress = (quantity / maxDishQuantity) * 100;
                    return (
                      <div className="customer-dish-row" key={`${item.dishName}-${index}`}>
                        <div className="customer-rank">#{index + 1}</div>
                        <div className="customer-dish-row__body">
                          <div className="customer-dish-row__meta">
                            <strong>{item?.dishName || "Không rõ tên món"}</strong>
                            <span>{formatDishQuantity(quantity, item?.dishName)}</span>
                          </div>
                          <ProgressBar value={progress} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState title="Chưa có dữ liệu món bán nổi bật" description="Khi có đơn hoàn thành, các món bán chạy sẽ hiển thị tại đây." actionLabel="Kiểm tra menu" onAction={() => navigateManagerPage("menu")} />}
            </section>

            <section className="customer-panel">
              <div className="customer-panel__head">
                <div>
                  <h3>Mật độ đơn theo ngày</h3>
                  <p>Nhận diện ngày có nhiều đơn để chuẩn bị nhân sự và tồn kho.</p>
                </div>
                <button type="button" onClick={() => navigateManagerPage("orders")}>
                  Đơn hàng <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
              {loading ? <div className="customer-panel__loading">Đang tải dữ liệu ngày...</div> : busyDays.length > 0 ? (
                <div className="customer-day-list">
                  {busyDays.map((item, index) => {
                    const count = Number(item?.orderCount || 0);
                    const progress = (count / maxDayOrders) * 100;
                    return (
                      <div className="customer-day-row" key={`${item.date}-${index}`}>
                        <div className="customer-day-row__top">
                          <strong>{formatDate(item?.date)}</strong>
                          <span>{formatNumber(count)} đơn</span>
                        </div>
                        <ProgressBar value={progress} variant="day" />
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState title="Chưa có dữ liệu mật độ đơn" description="Dữ liệu sẽ rõ hơn khi nhà hàng có đơn hàng trong nhiều ngày." actionLabel="Xem đơn hàng" onAction={() => navigateManagerPage("orders")} />}
            </section>
          </section>

          <section className="customer-insight-grid">
            <section className="customer-panel">
              <div className="customer-panel__head">
                <div>
                  <h3>Phân khúc khách hàng</h3>
                  <p>Các nhóm khách theo dữ liệu phân tích hiện tại.</p>
                </div>
                <button type="button" onClick={() => navigateManagerPage("customers")}>
                  Mở danh sách khách <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
              {loading ? <div className="customer-panel__loading">Đang tải phân khúc khách hàng...</div> : visibleCustomerSegments.length > 0 ? (
                <div className="customer-segment-list">
                  {visibleCustomerSegments.map((segment, index) => {
                    const percentage = Number(segment?.percentage || 0);
                    return (
                      <div className="customer-segment-row" key={`${segment?.segmentKey || "segment"}-${index}`}>
                        <div className="customer-segment-row__meta">
                          <strong>{getCustomerSegmentLabel(segment)}</strong>
                          <span>{formatNumber(segment?.customerCount)} khách • {formatPercent(percentage)}</span>
                        </div>
                        <ProgressBar value={percentage} />
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState title="Chưa có dữ liệu phân khúc khách hàng" description="Khi có đủ đơn và hồ sơ khách, hệ thống sẽ chia nhóm tại đây." actionLabel="Mở quản lý khách" onAction={() => navigateManagerPage("customers")} />}
            </section>

            <section className="customer-panel">
              <div className="customer-panel__head">
                <div>
                  <h3>Khách lâu chưa quay lại</h3>
                  <p>Theo dõi nhóm khách lâu chưa quay lại để chăm sóc kịp thời.</p>
                </div>
                <button type="button" onClick={() => navigateManagerPage("customers", { segment: "dormant" })}>
                  Lọc nhóm này <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
              {loading ? <div className="customer-panel__loading">Đang tải khách lâu chưa quay lại...</div> : churnRiskCustomers.length > 0 ? (
                <div className="customer-risk-list">
                  {churnRiskCustomers.map((customer, index) => {
                    const risk = getChurnRiskMeta(customer?.daysSinceLastOrder);
                    return (
                      <article className="customer-risk-row" key={`${customer?.userId || "risk"}-${index}`}>
                        <div className="customer-person-line">
                          <CustomerAvatar name={customer?.fullName} />
                          <div>
                            <div className="customer-risk-row__top">
                              <strong>{customer?.fullName || "Khách chưa có tên"}</strong>
                              <span className={`customer-risk-badge customer-risk-badge--${risk.className}`}>{risk.label}</span>
                            </div>
                            <p>{customer?.phone || "Chưa có số điện thoại"}</p>
                          </div>
                        </div>
                        <div className="customer-risk-row__meta">
                          <span>{formatNumber(customer?.daysSinceLastOrder)} ngày chưa quay lại</span>
                          <span>{formatNumber(customer?.totalOrders)} đơn</span>
                          <span>{formatCurrency(customer?.totalSpend)}</span>
                        </div>
                        <div className="customer-row-actions">
                          {customer?.phone ? (
                            <a className="customer-row-action" href={`tel:${customer.phone}`}>
                              <Phone size={13} aria-hidden="true" />
                              Gọi khách
                            </a>
                          ) : (
                            <span className="customer-row-action customer-row-action--disabled">Thiếu SĐT</span>
                          )}
                          <button type="button" onClick={() => navigateManagerPage("customers", { customerId: customer?.userId })}>
                            Hồ sơ
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : <EmptyState title="Chưa có khách lâu chưa quay lại" description="Hiện chưa có khách nào cần nhắc quay lại trong dữ liệu." />}
            </section>

            <section className="customer-panel">
              <div className="customer-panel__head">
                <div>
                  <h3>Khách giá trị cao</h3>
                  <p>Nhóm khách chi tiêu lớn cần duy trì trải nghiệm tốt.</p>
                </div>
                <button type="button" onClick={() => navigateManagerPage("customers", { segment: "high-value" })}>
                  Xem nhóm giá trị cao <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
              {loading ? <div className="customer-panel__loading">Đang tải khách giá trị cao...</div> : topValueCustomers.length > 0 ? (
                <div className="customer-value-list">
                  {topValueCustomers.map((customer, index) => {
                    const spend = Number(customer?.totalSpend || 0);
                    const progress = (spend / maxTopValueSpend) * 100;
                    return (
                      <article className="customer-value-row" key={`${customer?.userId || "value"}-${index}`}>
                        <div className="customer-person-line">
                          <span className="customer-value-rank">#{index + 1}</span>
                          <div className="customer-value-row__top">
                            <strong>{customer?.fullName || "Khách chưa có tên"}</strong>
                          </div>
                        </div>
                        <div className="customer-value-row__meta">
                          <span>{formatCurrency(spend)}</span>
                          <span>{formatNumber(customer?.totalOrders)} đơn</span>
                          <span>Trung bình/đơn: {formatCurrency(customer?.averageOrderValue)}</span>
                          <span>Đơn gần nhất: {formatDate(customer?.lastOrderAt)}</span>
                        </div>
                        <ProgressBar value={progress} />
                        <div className="customer-row-actions">
                          {customer?.phone ? (
                            <a className="customer-row-action" href={`tel:${customer.phone}`}>
                              <Phone size={13} aria-hidden="true" />
                              Gọi khách
                            </a>
                          ) : (
                            <span className="customer-row-action customer-row-action--disabled">Thiếu SĐT</span>
                          )}
                          <button type="button" onClick={() => navigateManagerPage("orders", { customerId: customer?.userId })}>
                            Xem đơn
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : <EmptyState title="Chưa có khách giá trị cao" description="Khi có đủ dữ liệu chi tiêu, nhóm này sẽ được hiển thị để chăm sóc riêng." />}
            </section>

            <section className="customer-panel">
              <div className="customer-panel__head">
                <div>
                  <h3>Giữ chân theo tháng</h3>
                  <p>Theo dõi hiệu quả giữ chân khách theo từng nhóm tháng.</p>
                </div>
                <span className="customer-panel__note"><Search size={13} aria-hidden="true" /> Giữ chân</span>
              </div>
              {loading ? <div className="customer-panel__loading">Đang tải dữ liệu giữ chân...</div> : cohortRetention.length > 0 ? (
                <div className="customer-cohort-list">
                  {cohortRetention.map((cohort, index) => {
                    const rate = Number(cohort?.retentionRate || 0);
                    return (
                      <div className="customer-cohort-row" key={`${cohort?.cohortMonth || "cohort"}-${index}`}>
                        <div className="customer-cohort-row__meta">
                          <strong>{cohort?.cohortMonth || "—"}</strong>
                          <span>{formatNumber(cohort?.retainedCount)} / {formatNumber(cohort?.cohortSize)} khách ({formatPercent(rate)})</span>
                        </div>
                        <ProgressBar value={rate} variant="day" />
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState title="Chưa có đủ dữ liệu giữ chân" description="Cần thêm lịch sử khách theo nhiều tháng để đánh giá khả năng quay lại." />}
            </section>

            <section className="customer-panel customer-panel--full">
              <div className="customer-panel__head">
                <div>
                  <h3>Gợi ý hành động</h3>
                  <p>Các đề xuất từ hệ thống dựa trên dữ liệu hiện có.</p>
                </div>
                <button type="button" onClick={() => navigateManagerPage("customers")}>
                  Mở danh sách khách <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
              {loading ? <div className="customer-panel__loading">Đang tải gợi ý hành động...</div> : recommendations.length > 0 ? (
                <div className="customer-recommendation-list">
                  {recommendations.map((item, index) => {
                    const priority = String(item?.priority || "LOW").toUpperCase();
                    const priorityClass = ["HIGH", "MEDIUM", "LOW"].includes(priority)
                      ? priority.toLowerCase()
                      : "low";
                    return (
                      <article className={`customer-recommendation-card customer-recommendation-card--${priorityClass}`} key={`${item?.key || "recommendation"}-${index}`}>
                        <div>
                          <h4>{item?.title === "Món được quan tâm nổi bật" ? "Món bán nổi bật" : item?.title || "Gợi ý"}</h4>
                          <p>{item?.description || "—"}</p>
                        </div>
                        <span>{PRIORITY_LABELS[priority] || "Theo dõi"}</span>
                      </article>
                    );
                  })}
                </div>
              ) : <EmptyState title="Chưa có gợi ý hành động" description="Khi có thêm đơn và hành vi khách, hệ thống sẽ đề xuất việc nên làm tiếp theo." />}
            </section>
          </section>

          <section className={`customer-guidance ${!hasActionableInsight ? "customer-guidance--empty customer-guidance--action-center" : ""}`}>
            {!hasActionableInsight ? (
              <>
                <div>
                  <p className="customer-guidance__eyebrow">Bước tiếp theo</p>
                  <h3>Chưa đủ dữ liệu để phân tích khách hàng</h3>
                  <p>Hãy ghi nhận đơn hàng và hoàn thiện dữ liệu khách để hệ thống bắt đầu tạo gợi ý hữu ích.</p>
                </div>
                <div className="customer-guidance__steps">
                  <div><ClipboardList size={16} aria-hidden="true" /><span>Kiểm tra đơn</span></div>
                  <div><UserRoundCog size={16} aria-hidden="true" /><span>Quản lý khách</span></div>
                  <div><Utensils size={16} aria-hidden="true" /><span>Kiểm tra menu</span></div>
                </div>
                <div className="customer-guidance__actions">
                  <button type="button" aria-label="Đi tới quản lý đơn hàng" onClick={() => navigateManagerPage("orders")}>Xem đơn hàng</button>
                  <button type="button" aria-label="Đi tới quản lý khách hàng" onClick={() => navigateManagerPage("customers")}>Quản lý khách hàng</button>
                  <button type="button" aria-label="Đi tới quản lý menu" onClick={() => navigateManagerPage("menu")}>Kiểm tra menu</button>
                </div>
              </>
            ) : (
              <div>
                <p className="customer-guidance__eyebrow">Gợi ý vận hành</p>
                <h3>
                  <BarChart3 size={16} aria-hidden="true" />
                  <span>Dùng dữ liệu phân tích để chăm sóc khách hàng hiệu quả hơn</span>
                </h3>
                <p>Tập trung vào nhóm lâu chưa quay lại, khách giá trị cao và khả năng giữ chân để tối ưu doanh thu.</p>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
};

export default CustomerAnalyticsPage;
