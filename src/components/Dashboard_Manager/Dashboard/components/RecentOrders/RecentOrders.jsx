import React, { useState } from "react";
import {
  Clock,
  CheckCircle,
  Truck,
  ChefHat,
  MoreHorizontal,
  ArrowRight,
  Printer,
  Eye,
  CreditCard,
  Banknote,
  Utensils,
  ShoppingBag,
  MapPin,
} from "lucide-react";
import "./RecentOrders.scss";

// CONFIG: Màu sắc & Icon cho trạng thái
const STATUS_CONFIG = {
  pending: { label: "Chờ xác nhận", color: "orange", icon: Clock },
  cooking: { label: "Đang chế biến", color: "blue", icon: ChefHat },
  ready: { label: "Đã xong", color: "green", icon: CheckCircle },
  delivery: { label: "Đang giao", color: "purple", icon: Truck },
  cancelled: { label: "Đã hủy", color: "red", icon: MoreHorizontal },
};

// HELPER: Cắt ngắn danh sách món ăn
const formatItems = (items) => {
  if (items.length <= 2) return items.join(", ");
  return `${items.slice(0, 2).join(", ")} +${items.length - 2} món`;
};

// COMPONENT: Một dòng đơn hàng
const OrderRow = ({ order }) => {
  const { id, type, table, items, total, status, time, customer, payment } =
    order;
  const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const StatusIcon = statusInfo.icon;

  // Icon loại đơn
  const isDineIn = type === "dine-in";
  const TypeIcon = isDineIn ? Utensils : ShoppingBag;

  return (
    <div className="order-row fade-in-item">
      {/* 1. Order Info & Customer */}
      <div className="col-info">
        <div className="avatar-box">
          <img
            src={`https://ui-avatars.com/api/?name=${customer}&background=random&color=fff&size=40`}
            alt="avatar"
          />
          <div className={`type-badge ${type}`}>
            <TypeIcon size={10} />
          </div>
        </div>
        <div className="text-wrapper">
          <div className="row-top">
            <span className="customer-name">{customer}</span>
            <span className="dot">•</span>
            <span className="order-id">#{id}</span>
          </div>
          <div className="row-bottom">
            {isDineIn ? (
              <span className="location-tag">
                <MapPin size={10} /> Bàn {table}
              </span>
            ) : (
              <span className="location-tag delivery">Mang đi</span>
            )}
            <span className="time-ago">{time}</span>
          </div>
        </div>
      </div>

      {/* 2. Menu Items */}
      <div className="col-menu">
        <span className="menu-text" title={items.join(", ")}>
          {formatItems(items)}
        </span>
      </div>

      {/* 3. Status Badge */}
      <div className="col-status">
        <div className={`status-pill ${statusInfo.color}`}>
          <StatusIcon size={12} strokeWidth={2.5} />
          <span>{statusInfo.label}</span>
        </div>
      </div>

      {/* 4. Payment & Total */}
      <div className="col-total">
        <span className="amount">{total}</span>
        <div className="payment-info">
          {payment === "card" ? (
            <CreditCard size={12} />
          ) : (
            <Banknote size={12} />
          )}
          <span>{payment === "card" ? "CK/Thẻ" : "Tiền mặt"}</span>
        </div>
      </div>

      {/* 5. Actions (Hover to show) */}
      <div className="col-actions">
        <button className="btn-icon" title="In hóa đơn">
          <Printer size={16} />
        </button>
        <button className="btn-icon primary" title="Xem chi tiết">
          <Eye size={16} />
        </button>
      </div>
    </div>
  );
};

const RecentOrders = () => {
  const [filter, setFilter] = useState("all");

  // Mock Data Nâng cao
  const allOrders = [
    {
      id: "2045",
      type: "dine-in",
      table: "05",
      customer: "Nguyễn Văn A",
      items: ["Bò Bít Tết HK", "Rượu Vang Đỏ", "Khoai Tây Chiên", "Salad Nga"],
      total: "1.250.000 ₫",
      status: "cooking",
      time: "5m",
      payment: "card",
    },
    {
      id: "2044",
      type: "delivery",
      table: null,
      customer: "Shipper Grab (Chị Lan)",
      items: ["Cơm Gà Hải Nam", "Trà Đào Cam Sả"],
      total: "185.000 ₫",
      status: "delivery",
      time: "12m",
      payment: "cash", // Thu hộ
    },
    {
      id: "2043",
      type: "dine-in",
      table: "VIP 2",
      customer: "Trần Minh",
      items: ["Combo Sashimi", "Lẩu Thái", "Bia Tiger (Tháp)"],
      total: "3.500.000 ₫",
      status: "pending",
      time: "20m",
      payment: "card",
    },
    {
      id: "2042",
      type: "takeaway",
      table: null,
      customer: "Khách Vãng Lai",
      items: ["Cafe Sữa Đá", "Bánh Mì Chảo"],
      total: "65.000 ₫",
      status: "ready",
      time: "32m",
      payment: "cash",
    },
    {
      id: "2041",
      type: "dine-in",
      table: "10",
      customer: "Lê Thị B",
      items: ["Mì Ý Sốt Kem", "Salad Caesar"],
      total: "220.000 ₫",
      status: "cancelled",
      time: "45m",
      payment: "cash",
    },
  ];

  const displayOrders =
    filter === "all"
      ? allOrders
      : allOrders.filter(
          (o) =>
            o.type === filter ||
            (filter === "delivery" && o.type === "takeaway")
        );

  return (
    <div className="dashboard-widget recent-orders">
      {/* Header Widget */}
      <div className="widget-header">
        <h3 className="widget-title">Đơn Hàng Gần Đây</h3>
        <div className="header-actions">
          {/* Segmented Control */}
          <div className="segmented-control">
            {[
              { id: "all", label: "Tất cả" },
              { id: "dine-in", label: "Tại bàn" },
              { id: "delivery", label: "Giao đi" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`segment-btn ${filter === tab.id ? "active" : ""}`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button className="btn-link">
            Xem tất cả <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Table Headers */}
      <div className="table-header-row">
        <span className="th-1">Khách hàng / Mã</span>
        <span className="th-2">Thực đơn gọi</span>
        <span className="th-3">Trạng thái</span>
        <span className="th-4">Tổng tiền</span>
        <span className="th-5"></span> {/* Cột action rỗng */}
      </div>

      {/* Scrollable List */}
      <div className="order-list-body custom-scrollbar">
        {displayOrders.length > 0 ? (
          displayOrders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <ShoppingBag size={40} />
            </div>
            <p>Chưa có đơn hàng nào</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentOrders;
