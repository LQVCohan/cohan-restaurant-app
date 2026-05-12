import React, { useContext, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Search,
  Ticket,
  Truck,
  Utensils,
  Gift,
  ShieldCheck,
  ChevronRight,
  Wallet,
  Sparkles,
  X,
  Check,
  Inbox,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import "./VoucherPage.scss";

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
      code
      description
      discountType
      discountValue
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
  { id: "partner", label: "Đối tác", icon: <ShieldCheck size={18} /> },
];

const EMPTY_STATS = {
  points: 0,
};

const normalizeRestaurantId = (restaurant) => {
  if (!restaurant) return "";
  return String(
    restaurant.id || restaurant._id || restaurant.restaurantId || restaurant,
  ).trim();
};

const inferCouponType = (coupon) => {
  const category = String(
    coupon.category || coupon.constraints?.category || "",
  ).toLowerCase();
  if (["shipping", "food", "partner"].includes(category)) return category;
  return "partner";
};

const mapCouponToCard = (coupon) => {
  const isPercent = coupon.discountType === "PERCENT";
  return {
    id: coupon.id,
    code: coupon.code,
    type: inferCouponType(coupon),
    title: isPercent
      ? `Giảm ${coupon.discountValue}%`
      : `Giảm ${Number(coupon.discountValue || 0).toLocaleString("vi-VN")}đ`,
    subTitle: coupon.description || "Ưu đãi áp dụng theo điều kiện",
    expiry: coupon.endAt
      ? new Date(coupon.endAt).toLocaleDateString("vi-VN")
      : "Không giới hạn",
    percent: isPercent ? Number(coupon.discountValue || 0) : 100,
    progress: 0,
    tag: "Coupon",
    color: inferCouponType(coupon) === "shipping" ? "blue" : "green",
    conditions: Array.isArray(coupon.constraints?.conditions)
      ? coupon.constraints.conditions
      : ["Xem điều kiện áp dụng khi thanh toán."],
  };
};

// TODO(#518): physically rename this folder/CSS from VoucherManagement once routes and imports are migrated.
const CouponPage = () => {
  const { id: legacyRouteId, restaurantId: routeRestaurantId } = useParams();
  const [searchParams] = useSearchParams();
  const { restaurants = [], refRestaurant = [] } = useContext(AuthContext) || {};

  const contextRestaurantIds = useMemo(
    () =>
      [...restaurants, ...refRestaurant]
        .map(normalizeRestaurantId)
        .filter(Boolean),
    [restaurants, refRestaurant],
  );

  const restaurantId = useMemo(() => {
    const explicitRouteId = routeRestaurantId
      ? String(routeRestaurantId).trim()
      : "";
    if (explicitRouteId) return explicitRouteId;

    const queryRestaurantId = String(
      searchParams.get("restaurantId") || "",
    ).trim();
    if (queryRestaurantId) return queryRestaurantId;

    const legacyId = legacyRouteId ? String(legacyRouteId).trim() : "";
    if (legacyId && contextRestaurantIds.includes(legacyId)) return legacyId;

    return contextRestaurantIds[0] || "";
  }, [contextRestaurantIds, legacyRouteId, routeRestaurantId, searchParams]);

  const { data: couponData, loading, error } = useQuery(GET_COUPONS, {
    variables: { restaurantId, activeOnly: true, limit: 50, offset: 0 },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });
  const [activeTab, setActiveTab] = useState("all");
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [savedCoupons, setSavedCoupons] = useState([]);

  const apiCoupons = useMemo(
    () => (couponData?.coupons ?? []).map(mapCouponToCard),
    [couponData],
  );

  const filteredCoupons = useMemo(() => {
    return activeTab === "all"
      ? apiCoupons
      : apiCoupons.filter((coupon) => coupon.type === activeTab);
  }, [activeTab, apiCoupons]);

  const handleToggleSave = (id) => {
    setSavedCoupons((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleOpenDetail = (coupon) => {
    setSelectedCoupon(coupon);
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

    if (loading && !couponData) {
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
          <p>Nhà hàng này hiện chưa có coupon đang hoạt động trong nhóm bạn chọn.</p>
        </div>
      );
    }

    return (
      <div className="voucher-grid">
        {filteredCoupons.map((coupon) => {
          const isSaved = savedCoupons.includes(coupon.id);
          return (
            <div key={coupon.id} className={`ticket-card color-${coupon.color}`}>
              <div className="ticket-left">
                <div className="ticket-icon">
                  {coupon.type === "shipping" ? (
                    <Truck size={28} />
                  ) : coupon.type === "food" ? (
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
                  <span className="tag">{coupon.tag}</span>
                  <span className="expiry">HSD: {coupon.expiry}</span>
                </div>

                <div className="ticket-body">
                  <h4 className="t-title">{coupon.title}</h4>
                  <p className="t-sub">{coupon.subTitle}</p>

                  <div className="progress-area">
                    <div className="progress-bg">
                      <div
                        className="progress-fill"
                        style={{ width: `${coupon.progress}%` }}
                      ></div>
                    </div>
                    <span className="progress-text">
                      Đã dùng {coupon.progress}%
                    </span>
                  </div>
                </div>

                <div className="ticket-footer">
                  <button
                    className="btn-detail"
                    onClick={() => handleOpenDetail(coupon)}
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
    <div className="voucher-page">
      <div className="voucher-container">
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
                <span className="value">{EMPTY_STATS.points}</span>
                <span className="label">Points</span>
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
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`cat-pill ${activeTab === cat.id ? "active" : ""}`}
              onClick={() => setActiveTab(cat.id)}
            >
              {cat.icon}
              <span>{cat.label}</span>
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
          className="modal-voucher-overlay"
          onClick={() => setSelectedCoupon(null)}
        >
          <div className="modal-ticket" onClick={(e) => e.stopPropagation()}>
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
