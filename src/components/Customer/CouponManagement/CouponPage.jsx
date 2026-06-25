import React, { useContext, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, Check, Clock, Compass, Inbox, Search, Ticket, Wallet } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import useUserCoupons from "@/hooks/useUserCoupons";
import CouponCard from "./CouponCard";
import CouponDetailModal from "./CouponDetailModal";
import { filterCoupons, isCouponExpired, normalizeCoupon, sortCoupons } from "./couponUtils";
import "./CouponPage.scss";

const GET_COUPONS = gql`
  query Coupons($restaurantId: ID!, $activeOnly: Boolean = true, $limit: Int = 50, $offset: Int = 0) {
    coupons(restaurantId: $restaurantId, activeOnly: $activeOnly, limit: $limit, offset: $offset) {
      id name code category description discountType discountValue minOrderValue maxDiscount maxUsage used publishAt startAt endAt isActive constraints restaurantId
    }
  }
`;

const FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "saved", label: "Đã lưu" },
  { id: "valid", label: "Còn hiệu lực" },
  { id: "expiring", label: "Sắp hết hạn" },
  { id: "used", label: "Đã dùng" },
  { id: "expired", label: "Hết hạn" },
  { id: "shipping", label: "Vận chuyển" },
  { id: "food", label: "Đồ ăn" },
  { id: "table", label: "Đặt bàn" },
  { id: "order", label: "Đặt món" },
];

const CouponPage = () => {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated = false, token, user } = useContext(AuthContext) || {};
  const loggedIn = Boolean(isAuthenticated || token || user?.id || user?._id);
  const isWalletPage = !restaurantId;
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [actionError, setActionError] = useState("");

  const couponsQuery = useQuery(GET_COUPONS, {
    variables: { restaurantId, activeOnly: true, limit: 50, offset: 0 },
    skip: isWalletPage || !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const userCoupons = useUserCoupons({ restaurantId: restaurantId || null, status: isWalletPage ? null : "saved", skip: !loggedIn });

  const savedByCouponId = useMemo(() => {
    const map = new Map();
    userCoupons.myCoupons.forEach((row) => {
      const couponId = String(row?.couponId || row?.coupon?.id || "").trim();
      if (couponId) map.set(couponId, row);
    });
    return map;
  }, [userCoupons.myCoupons]);

  const coupons = useMemo(() => {
    const sourceRows = isWalletPage ? userCoupons.myCoupons : couponsQuery.data?.coupons || [];
    return sortCoupons(sourceRows.map((row) => normalizeCoupon(row, isWalletPage ? row : savedByCouponId.get(String(row?.id || "")))));
  }, [couponsQuery.data?.coupons, isWalletPage, savedByCouponId, userCoupons.myCoupons]);

  const visibleCoupons = useMemo(() => filterCoupons(coupons, activeTab, searchTerm), [activeTab, coupons, searchTerm]);
  const expiringCount = coupons.filter((coupon) => coupon.endAt && !isCouponExpired(coupon) && new Date(coupon.endAt).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000).length;
  const validCount = coupons.filter((coupon) => ["active", "saved"].includes(coupon.status)).length;
  const pageLoading = (isWalletPage ? userCoupons.loading : couponsQuery.loading || userCoupons.loading) && !coupons.length;
  const pageError = isWalletPage ? userCoupons.error : couponsQuery.error || userCoupons.error;

  const requireLogin = () => {
    setActionError("Vui lòng đăng nhập để lưu coupon");
    navigate("/login", { state: { from: location } });
  };

  const handleSave = async (coupon) => {
    if (!loggedIn) return requireLogin();
    setActionError("");
    try {
      const result = await userCoupons.saveCoupon(coupon.id);
      if (!result) throw new Error("save failed");
    } catch {
      setActionError("Không thể lưu coupon. Vui lòng thử lại.");
    }
  };

  const handleRemove = async (coupon) => {
    setActionError("");
    try {
      const ok = await userCoupons.removeSavedCoupon(coupon.id);
      if (!ok) throw new Error("remove failed");
    } catch {
      setActionError("Không thể bỏ lưu coupon. Vui lòng thử lại.");
    }
  };

  const handleUseNow = (coupon) => navigate(coupon.restaurantId ? `/restaurant/${coupon.restaurantId}` : "/restaurants");
  const retry = () => { couponsQuery.refetch?.(); userCoupons.refetch?.(); };

  return (
    <main className="coupon-page">
      <section className="coupon-hero">
        <div><span className="coupon-eyebrow">FoodHub / VPOS</span><h1>Kho Coupon</h1><p>{isWalletPage ? "Quản lý các coupon bạn đã lưu và dùng ngay khi đặt món." : "Chọn ưu đãi thật đang hoạt động tại nhà hàng này."}</p></div>
        <div className="coupon-stats">
          <div><Ticket /><strong>{coupons.length}</strong><span>Tổng coupon</span></div>
          <div><Wallet /><strong>{coupons.filter((c) => c.isSaved).length}</strong><span>Đã lưu</span></div>
          <div><Check /><strong>{validCount}</strong><span>Còn hiệu lực</span></div>
          <div><Clock /><strong>{expiringCount}</strong><span>Sắp hết hạn</span></div>
        </div>
      </section>

      <section className="coupon-toolbar">
        <label className="coupon-search"><Search size={19} /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm theo tên, mã, mô tả, danh mục..." /></label>
        <div className="coupon-tabs">{FILTERS.map((filter) => <button key={filter.id} className={activeTab === filter.id ? "active" : ""} onClick={() => setActiveTab(filter.id)}>{filter.label}</button>)}</div>
      </section>

      {actionError && <div className="coupon-alert" role="alert"><AlertCircle size={18} />{actionError}</div>}

      {!loggedIn && isWalletPage ? (
        <div className="coupon-empty"><Inbox size={44} /><h2>Đăng nhập để xem Kho Coupon</h2><p>Kho Coupon dùng dữ liệu thật từ tài khoản của bạn.</p><button onClick={() => navigate("/login", { state: { from: location } })}>Đăng nhập</button></div>
      ) : pageLoading ? (
        <div className="coupon-empty"><Ticket size={44} /><h2>Đang tải coupon...</h2><p>FoodHub đang lấy ưu đãi mới nhất.</p></div>
      ) : pageError ? (
        <div className="coupon-empty coupon-empty--error"><AlertCircle size={44} /><h2>Không thể tải coupon</h2><p>Đã có lỗi khi lấy dữ liệu thật. Vui lòng thử lại.</p><button onClick={retry}>Thử lại</button></div>
      ) : visibleCoupons.length ? (
        <section className="coupon-grid">{visibleCoupons.map((coupon) => <CouponCard key={coupon.id} coupon={coupon} busy={userCoupons.loading} onSave={handleSave} onRemove={handleRemove} onUse={handleUseNow} onDetail={setSelectedCoupon} />)}</section>
      ) : (
        <div className="coupon-empty"><Compass size={44} /><h2>Chưa có coupon phù hợp</h2><p>{isWalletPage ? "Bạn chưa lưu coupon nào hoặc bộ lọc hiện tại không có kết quả." : "Nhà hàng này hiện chưa có coupon phù hợp với bộ lọc."}</p><button onClick={() => navigate("/restaurants")}>Khám phá nhà hàng</button></div>
      )}

      <CouponDetailModal coupon={selectedCoupon} onClose={() => setSelectedCoupon(null)} />
    </main>
  );
};

export default CouponPage;
