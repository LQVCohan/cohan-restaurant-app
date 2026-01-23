import React, { useState, useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  Search,
  Ticket,
  Truck,
  Utensils,
  Gift,
  ShieldCheck,
  Clock,
  Lock,
  ChevronRight,
  Wallet,
  Sparkles,
  X,
  Check,
} from "lucide-react";
import "./VoucherPage.scss";

const GET_COUPONS = gql`
  query Coupons($activeOnly: Boolean = true, $limit: Int = 50, $offset: Int = 0) {
    coupons(activeOnly: $activeOnly, limit: $limit, offset: $offset) {
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

// --- MOCK DATA ---
const USER_STATS = {
  points: 1250,
  rank: "Gold Member",
  vouchersCount: 5,
};

const CATEGORIES = [
  { id: "all", label: "Tất cả", icon: <Ticket size={18} /> },
  { id: "shipping", label: "Vận chuyển", icon: <Truck size={18} /> },
  { id: "food", label: "Đồ ăn", icon: <Utensils size={18} /> },
  { id: "partner", label: "Đối tác", icon: <ShieldCheck size={18} /> },
];

const VOUCHERS = [
  {
    id: 1,
    code: "FREESHIP_MAX",
    type: "shipping",
    title: "Freeship Xtra - Giảm 30k",
    subTitle: "Đơn tối thiểu 100k",
    expiry: "31/12/2023",
    percent: 100,
    progress: 80,
    tag: "Hot",
    color: "blue",
    conditions: [
      "Áp dụng cho đơn hàng từ 100k.",
      "Giảm tối đa 30k phí vận chuyển.",
      "Không áp dụng cùng khuyến mãi khác.",
    ],
  },
  {
    id: 2,
    code: "FOOD_DEAL",
    type: "food",
    title: "Giảm 50% Món Thái",
    subTitle: "Tối đa 50k - Quán ThaiMarket",
    expiry: "20/11/2023",
    percent: 50,
    progress: 45,
    tag: "Limited",
    color: "orange",
    conditions: [
      "Chỉ áp dụng tại quán ThaiMarket.",
      "Tối đa 50k trên tổng hóa đơn.",
      "Áp dụng cho khách hàng mới.",
    ],
  },
  {
    id: 3,
    code: "NEW_USER",
    type: "partner",
    title: "Giảm 20k thanh toán Zalopay",
    subTitle: "Áp dụng cho mọi đơn hàng",
    expiry: "15/12/2023",
    percent: 20,
    progress: 10,
    tag: "Partner",
    color: "green",
    conditions: ["Thanh toán qua ví ZaloPay.", "Mỗi khách hàng dùng 1 lần."],
  },
];

const LOCKED_ITEMS = [
  {
    id: 101,
    title: "Voucher Hạng Kim Cương - 500k",
    desc: "Đặc quyền VIP",
    condition: "Cần thêm 1500 điểm",
    icon: <Lock size={24} />,
    status: "locked",
  },
  {
    id: 102,
    title: "Flash Sale 12.12 - 1k",
    desc: "Mở bán lúc 12:00",
    condition: "Mở lúc: 12/12 - 12:00",
    icon: <Clock size={24} />,
    status: "upcoming",
  },
];

const VoucherPage = () => {
  const { data: couponData } = useQuery(GET_COUPONS, {
    variables: { activeOnly: true, limit: 50, offset: 0 },
    fetchPolicy: "cache-and-network",
  });
  const [activeTab, setActiveTab] = useState("all");

  // State quản lý Modal và Lưu Voucher
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [savedVouchers, setSavedVouchers] = useState([]);

  const apiVouchers = useMemo(() => {
    const coupons = couponData?.coupons ?? [];
    if (!coupons.length) return VOUCHERS;

    return coupons.map((coupon) => {
      const isPercent = coupon.discountType === "PERCENT";
      return {
        id: coupon.id,
        code: coupon.code,
        type: "partner",
        title: isPercent
          ? `Giảm ${coupon.discountValue}%`
          : `Giảm ${Number(coupon.discountValue || 0).toLocaleString()}đ`,
        subTitle: coupon.description || "Ưu đãi áp dụng theo điều kiện",
        expiry: coupon.endAt
          ? new Date(coupon.endAt).toLocaleDateString("vi-VN")
          : "Không giới hạn",
        percent: isPercent ? coupon.discountValue : 100,
        progress: 100,
        tag: "Ưu đãi",
        color: "green",
        conditions: Array.isArray(coupon.constraints?.conditions)
          ? coupon.constraints.conditions
          : ["Xem điều kiện áp dụng khi thanh toán."],
      };
    });
  }, [couponData]);

  const filteredVouchers = useMemo(() => {
    return activeTab === "all"
      ? apiVouchers
      : apiVouchers.filter((v) => v.type === activeTab);
  }, [activeTab, apiVouchers]);

  // Xử lý Lưu / Bỏ lưu
  const handleToggleSave = (id) => {
    setSavedVouchers((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id); // Bỏ lưu
      } else {
        return [...prev, id]; // Lưu mới
      }
    });
  };

  // Mở Modal
  const handleOpenDetail = (voucher) => {
    setSelectedVoucher(voucher);
  };

  return (
    <div className="voucher-page">
      <div className="voucher-container">
        {/* DASHBOARD HEADER */}
        <div className="dashboard-header">
          <div className="welcome-text">
            <h1>Kho Voucher & Ưu đãi</h1>
            <p>Săn deal hời, ăn chơi không lo về giá!</p>
          </div>
          <div className="stats-card">
            <div className="stat-item">
              <div className="icon-circle bg-yellow">
                <Sparkles size={20} />
              </div>
              <div>
                <span className="value">{USER_STATS.points}</span>
                <span className="label">Points</span>
              </div>
            </div>
            <div className="divider"></div>
            <div className="stat-item">
              <div className="icon-circle bg-blue">
                <Wallet size={20} />
              </div>
              <div>
                <span className="value">{savedVouchers.length}</span>
                <span className="label">Đã lưu</span>
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTER */}
        <div className="action-bar">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input type="text" placeholder="Tìm kiếm voucher..." />
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

        {/* LIST VOUCHER */}
        <div className="section-title">
          <h3>✨ Ưu đãi dành cho bạn</h3>
        </div>

        <div className="voucher-grid">
          {filteredVouchers.map((v) => {
            const isSaved = savedVouchers.includes(v.id);
            return (
              <div key={v.id} className={`ticket-card color-${v.color}`}>
                <div className="ticket-left">
                  <div className="ticket-icon">
                    {v.type === "shipping" ? (
                      <Truck size={28} />
                    ) : v.type === "food" ? (
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
                    <span className="tag">{v.tag}</span>
                    <span className="expiry">HSD: {v.expiry}</span>
                  </div>

                  <div className="ticket-body">
                    <h4 className="t-title">{v.title}</h4>
                    <p className="t-sub">{v.subTitle}</p>

                    <div className="progress-area">
                      <div className="progress-bg">
                        <div
                          className="progress-fill"
                          style={{ width: `${v.progress}%` }}
                        ></div>
                      </div>
                      <span className="progress-text">
                        Đã dùng {v.progress}%
                      </span>
                    </div>
                  </div>

                  <div className="ticket-footer">
                    <button
                      className="btn-detail"
                      onClick={() => handleOpenDetail(v)}
                    >
                      Điều kiện
                    </button>
                    <button
                      className={`btn-save ${isSaved ? "saved" : ""}`}
                      onClick={() => handleToggleSave(v.id)}
                    >
                      {isSaved ? (
                        <>
                          Đã lưu <Check size={14} />
                        </>
                      ) : (
                        "Lưu Ngay"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* LOCKED SECTION */}
        <div className="section-title mt-5">
          <h3>🔒 Sắp mở khóa</h3>
        </div>
        <div className="voucher-grid">
          {LOCKED_ITEMS.map((item) => (
            <div key={item.id} className="ticket-card is-locked">
              <div className="ticket-left">
                <div className="ticket-icon">{item.icon}</div>
                <div className="vertical-dashed"></div>
                <div className="cutout top"></div>
                <div className="cutout bottom"></div>
              </div>
              <div className="ticket-right">
                <h4 className="t-title">{item.title}</h4>
                <p className="t-sub">{item.desc}</p>
                <div className="lock-badge">{item.condition}</div>
                <button disabled className="btn-locked">
                  Chưa khả dụng
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- MODAL POPUP --- */}
      {selectedVoucher && (
        <div
          className="modal-voucher-overlay"
          onClick={() => setSelectedVoucher(null)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="close-btn"
              onClick={() => setSelectedVoucher(null)}
            >
              <X size={24} />
            </button>

            <div className={`modal-header color-${selectedVoucher.color}`}>
              <div className="modal-icon-large">
                {selectedVoucher.type === "shipping" ? (
                  <Truck size={40} />
                ) : (
                  <Utensils size={40} />
                )}
              </div>
              <h3>{selectedVoucher.title}</h3>
              <span className="modal-code">{selectedVoucher.code}</span>
            </div>

            <div className="modal-body">
              <div className="info-row">
                <span className="label">Hạn sử dụng:</span>
                <span className="val">{selectedVoucher.expiry}</span>
              </div>
              <div className="divider"></div>
              <h4>Điều kiện áp dụng:</h4>
              <ul className="condition-list">
                {selectedVoucher.conditions?.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            <div className="modal-footer-action">
              <button
                className="btn-full"
                onClick={() => {
                  handleToggleSave(selectedVoucher.id);
                  setSelectedVoucher(null);
                }}
              >
                {savedVouchers.includes(selectedVoucher.id)
                  ? "Bỏ lưu voucher"
                  : "Lưu Voucher Ngay"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoucherPage;
