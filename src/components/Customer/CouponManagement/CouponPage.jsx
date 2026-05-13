import React, { useContext, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Check,
  Gift,
  Inbox,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Truck,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { COUPON_CATEGORIES } from "@/utils/constants";
import "./CouponPage.scss";

const GET_COUPONS = gql`
  query Coupons(
    $restaurantId: ID!
    $activeOnly: Boolean = true
    $limit: Int = 50
    $offset: Int = 0
  ) {
    coupons(
      restaurantId: $restaurantId
      activeOnly: $activeOnly
      limit: $limit
      offset: $offset
    ) {
      id
      name
      code
      category
      description
      discountType
      discountValue
      minOrderValue
      maxDiscount
      maxUsage
      used
      publishAt
      startAt
      endAt
      isActive
      constraints
    }
  }
`;

const CATEGORIES = [
  { id: "all", label: "Tất cả", icon: <Ticket size={18} /> },
  { id: "shipping", label: "Vận chuyển", icon: <Truck size={18} /> },
  { id: "food", label: "Đồ ăn", icon: <Utensils size={18} /> },
  { id: "table", label: "Đặt bàn", icon: <ShieldCheck size={18} /> },
  { id: "order", label: "Đặt món", icon: <Gift size={18} /> },
];

const normalizeRestaurantId = (restaurant) => {
  if (!restaurant) return "";
  return String(
    restaurant.id || restaurant._id || restaurant.restaurantId || restaurant,
  ).trim();
};

const formatCurrency = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "Không giới hạn";

const getCouponCategory = (coupon) => String(coupon.category || "order").toLowerCase();

const getCouponColor = (category) => {
  if (category === "shipping") return "blue";
  if (category === "food") return "orange";
  if (category === "table") return "purple";
  return "green";
};

const buildUsage = (coupon) => {
  const maxUsage = Number(coupon.maxUsage || 0);
  const used = Number(coupon.used || 0);

  if (!maxUsage) {
    return {
      label: "Không giới hạn lượt dùng",
      percent: null,
    };
  }

  const remaining = Math.max(maxUsage - used, 0);
  return {
    label: `Còn ${remaining.toLocaleString("vi-VN")}/${maxUsage.toLocaleString("vi-VN")} lượt`,
    percent: Math.min(Math.round((used / maxUsage) * 100), 100),
  };
};

const buildConditionLines = (coupon) => {
  const constraints = coupon.constraints || {};
  const lines = [];

  if (Number(coupon.minOrderValue || 0) > 0) {
    lines.push(`Đơn tối thiểu ${formatCurrency(coupon.minOrderValue)}.`);
  }

  if (Number(coupon.maxDiscount || 0) > 0) {
    lines.push(`Giảm tối đa ${formatCurrency(coupon.maxDiscount)}.`);
  }

  const usage = buildUsage(coupon);
  lines.push(usage.label + ".");

  lines.push(`Hiệu lực: ${formatDate(coupon.startAt)} - ${formatDate(coupon.endAt)}.`);

  if (constraints.stackable) {
    lines.push("Có thể dùng chồng với coupon khác.");
  }

  if (constraints.combinableWithPromotions) {
    lines.push("Có thể dùng chung với Promotion hợp lệ.");
  }

  if (constraints.exclusive) {
    lines.push("Coupon độc quyền, có thể chặn ưu đãi khác.");
  }

  if (Array.isArray(constraints.conditions)) {
    lines.push(...constraints.conditions.filter(Boolean));
  }

  return lines.length ? lines : ["Xem điều kiện áp dụng khi thanh toán."];
};

const mapCouponToCard = (coupon) => {
  const category = getCouponCategory(coupon);
  const isPercent = coupon.discountType === "PERCENT";
  const usage = buildUsage(coupon);

  return {
    id: coupon.id,
    name: coupon.name || coupon.code,
    code: coupon.code,
    category,
    categoryLabel: COUPON_CATEGORIES[category] || category,
    title: coupon.name || (isPercent
      ? `Giảm ${coupon.discountValue}%`
      : `Giảm ${formatCurrency(coupon.discountValue)}`),
    subTitle: coupon.description || "Ưu đãi áp dụng theo điều kiện",
    discountLabel: isPercent
      ? `Giảm ${coupon.discountValue}%`
      : `Giảm ${formatCurrency(coupon.discountValue)}`,
    expiry: formatDate(coupon.endAt),
    usage,
    tag: "Coupon",
    color: getCouponColor(category),
    conditions: buildConditionLines(coupon),
  };
};

const CouponPage = () => {
  const { restaurantId: routeRestaurantId } = useParams();
  const [searchParams] = useSearchParams();
  const { restaurants = [], refRestaurant = [] } = useContext(AuthContext) || {};

  const contextRestaurantId = useMemo(
    () =>
      [...restaurants, ...refRestaurant]
        .map(normalizeRestaurantId)
        .find(Boolean) || "",
    [restaurants, refRestaurant],
  );

  const restaurantId = useMemo(() => {
    const routeId = routeRestaurantId ? String(routeRestaurantId).trim() : "";
    if (routeId) return routeId;

    const queryRestaurantId = String(
      searchParams.get("restaurantId") || "",
    ).trim();
    if (queryRestaurantId) return queryRestaurantId;

    return contextRestaurantId;
  }, [contextRestaurantId, routeRestaurantId, searchParams]);

  const { data, loading, error } = useQuery(GET_COUPONS, {
    variables: { restaurantId, activeOnly: true, limit: 50, offset: 0 },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });
  const [activeTab, setActiveTab] = useState("all");
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [savedCoupons, setSavedCoupons] = useState([]);

  const coupons = useMemo(
    () => (data?.coupons ?? []).map(mapCouponToCard),
    [data?.coupons],
  );

  const filteredCoupons = useMemo(() => {
    return activeTab === "all"
      ? coupons
      : coupons.filter((coupon) => coupon.category === activeTab);
  }, [activeTab, coupons]);

  const handleToggleSave = (id) => {
    setSavedCoupons((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const renderCouponUsage = (coupon) => {
    if (coupon.usage.percent == null) {
      return <span className="usage-text">{coupon.usage.label}</span>;
    }

    return (
      <div className="usage-area">
        <div className="usage-bg">
          <div
            className="usage-fill"
            style={{ width: `${coupon.usage.percent}%` }}
          ></div>
        </div>
        <span className="usage-text">{coupon.usage.label}</span>
      </div>
    );
  };

  const renderCouponContent = () => {
    if (!restaurantId) {
      return (
        <div className="empty-state">
          <Inbox size={42} />
          <h3>Chọn nhà hàng để xem Coupon</h3>
          <p>
            Coupon được phát hành theo từng nhà hàng. Vui lòng chọn nhà hàng
            trước khi xem ưu đãi.
          </p>
        </div>
      );
    }

    if (loading && !data) {
      return (
        <div className="empty-state">
          <Ticket size={42} />
          <h3>Đang tải Coupon...</h3>
          <p>Chúng tôi đang lấy danh sách coupon mới nhất cho nhà hàng này.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="empty-state">
          <Inbox size={42} />
          <h3>Chưa thể tải Coupon</h3>
          <p>Vui lòng thử lại sau hoặc chọn nhà hàng khác.</p>
        </div>
      );
    }

    if (!filteredCoupons.length) {
      return (
        <div className="empty-state">
          <Inbox size={42} />
          <h3>Chưa có Coupon phù hợp</h3>
          <p>
            Nhà hàng này hiện chưa có coupon đang hoạt động trong nhóm bạn chọn.
          </p>
        </div>
      );
    }

    return (
      <div className="coupon-grid">
        {filteredCoupons.map((coupon) => {
          const isSaved = savedCoupons.includes(coupon.id);
          return (
            <div key={coupon.id} className={`ticket-card color-${coupon.color}`}>
              <div className="ticket-left">
                <div className="ticket-icon">
                  {coupon.category === "shipping" ? (
                    <Truck size={28} />
                  ) : coupon.category === "food" ? (
                    <Utensils size={28} />
                  ) : (
                    <Gift size={28} />
                  )}
                </div>
                <div className="vertical-dashed"></div>
                <div className="cutout top"></div>
                <div className="cutout bottom"></div>
              </div>

              <div className="ticket-right">
                <div className="ticket-header">
                  <span className="tag">{coupon.categoryLabel}</span>
                  <span className="expiry">HSD: {coupon.expiry}</span>
                </div>

                <div className="ticket-body">
                  <h4 className="t-title">{coupon.title}</h4>
                  <p className="t-sub">{coupon.subTitle}</p>
                  <p className="discount-label">{coupon.discountLabel}</p>
                  {renderCouponUsage(coupon)}
                </div>

                <div className="ticket-footer">
                  <button
                    className="btn-detail"
                    onClick={() => setSelectedCoupon(coupon)}
                  >
                    Điều kiện
                  </button>
                  <button
                    className={`btn-save ${isSaved ? "saved" : ""}`}
                    onClick={() => handleToggleSave(coupon.id)}
                  >
                    {isSaved ? (
                      <>
                        Đã lưu <Check size={14} />
                      </>
                    ) : (
                      "Lưu ngay"
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="coupon-page">
      <div className="coupon-container">
        <div className="dashboard-header">
          <div className="welcome-text">
            <h1>Kho Coupon & Ưu đãi</h1>
            <p>Săn deal hời, ăn chơi không lo về giá!</p>
          </div>
          <div className="stats-card">
            <div className="stat-item">
              <div className="icon-circle bg-yellow">
                <Sparkles size={20} />
              </div>
              <div>
                <span className="value">{coupons.length}</span>
                <span className="label">Coupon</span>
              </div>
            </div>
            <div className="divider"></div>
            <div className="stat-item">
              <div className="icon-circle bg-blue">
                <Wallet size={20} />
              </div>
              <div>
                <span className="value">{savedCoupons.length}</span>
                <span className="label">Đã lưu</span>
              </div>
            </div>
          </div>
        </div>

        <div className="action-bar">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input type="text" placeholder="Tìm kiếm coupon..." />
            <button>Tìm</button>
          </div>
        </div>

        <div className="categories-wrapper">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              className={`cat-pill ${activeTab === category.id ? "active" : ""}`}
              onClick={() => setActiveTab(category.id)}
            >
              {category.icon}
              <span>{category.label}</span>
            </button>
          ))}
        </div>

        <div className="section-title">
          <h3>✨ Coupon dành cho bạn</h3>
        </div>

        {renderCouponContent()}
      </div>

      {selectedCoupon && (
        <div
          className="modal-coupon-overlay"
          onClick={() => setSelectedCoupon(null)}
        >
          <div className="modal-ticket" onClick={(event) => event.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedCoupon(null)}>
              <X size={24} />
            </button>
            <div className="modal-header-bg">
              <Ticket size={50} />
              <h3>{selectedCoupon.title}</h3>
              <span className="modal-code">{selectedCoupon.code}</span>
            </div>
            <div className="modal-content">
              <div className="info-row">
                <span>Hạn sử dụng</span>
                <span className="val">{selectedCoupon.expiry}</span>
              </div>
              <div className="condition-list">
                <h4>Điều kiện áp dụng</h4>
                <ul>
                  {selectedCoupon.conditions.map((condition, index) => (
                    <li key={`${selectedCoupon.id}-${index}`}>{condition}</li>
                  ))}
                </ul>
              </div>
              <button
                className="btn-use-now"
                onClick={() => handleToggleSave(selectedCoupon.id)}
              >
                {savedCoupons.includes(selectedCoupon.id)
                  ? "Bỏ lưu coupon"
                  : "Lưu coupon ngay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponPage;
