import React, { useState } from "react";
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  Truck,
  Printer,
  Eye,
  Utensils,
  ChefHat,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";
import "./RecentOrders.scss";

// 1. CONFIG: Định nghĩa trạng thái & Icon
const STATUS_CONFIG = {
  pending: { label: "Chờ xác nhận", color: "orange", icon: Clock },
  cooking: { label: "Đang nấu", color: "blue", icon: ChefHat },
  ready: { label: "Sẵn sàng", color: "green", icon: CheckCircle },
  delivery: { label: "Đang giao", color: "purple", icon: Truck },
};

// 2. COMPONENT: Một dòng đơn hàng
const OrderRow = ({ order }) => {
  const { id, type, table, items, total, status, time, customer } = order;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  // Icon đại diện cho loại đơn (Tại bàn vs Giao đi)
  const TypeIcon = type === "dine-in" ? Utensils : ShoppingBag;

  return (
    <div className="order-row fade-in-item">
      {/* Cột 1: Icon & Loại đơn */}
      <div className={`icon-box ${type}`}>
        <TypeIcon size={20} strokeWidth={1.5} />
      </div>

      {/* Cột 2: Thông tin chính (Mã & Món ăn) */}
      <div className="info-col">
        <div className="top-line">
          <span className="order-id">#{id}</span>
          {type === "dine-in" && <span className="table-tag">Bàn {table}</span>}
          <span className="dot">•</span>
          <span className="customer-name">{customer}</span>
        </div>
        <div className="bottom-line">
          <span className="items-summary">{items.join(", ")}</span>
        </div>
      </div>

      {/* Cột 3: Trạng thái & Thời gian */}
      <div className="status-col">
        <div className={`status-badge ${config.color}`}>
          <StatusIcon size={12} />
          <span>{config.label}</span>
        </div>
        <span className="time-ago">{time}</span>
      </div>

      {/* Cột 4: Tổng tiền */}
      <div className="amount-col">{total}</div>

      {/* Cột 5: Hover Actions (Chỉ hiện khi rê chuột) */}
      <div className="actions-overlay">
        <button className="action-btn print" title="In hóa đơn">
          <Printer size={16} />
        </button>
        <button className="action-btn view" title="Xem chi tiết">
          <Eye size={16} />
        </button>
      </div>
    </div>
  );
};

const RecentOrders = () => {
  const [filter, setFilter] = useState("all"); // all | dine-in | delivery

  // Mock Data phong phú hơn
  const allOrders = [
    {
      id: "1024",
      type: "dine-in",
      table: "05",
      customer: "Nguyễn Văn A",
      items: ["Bò Bít Tết", "Rượu Vang Đỏ", "Salad Nga"],
      total: "1.250.000 ₫",
      status: "cooking",
      time: "5 phút trước",
    },
    {
      id: "1023",
      type: "delivery",
      table: null,
      customer: "Chị Lan (Grab)",
      items: ["Cơm Gà Hải Nam", "Trà Đào Cam Sả"],
      total: "185.000 ₫",
      status: "delivery",
      time: "12 phút trước",
    },
    {
      id: "1022",
      type: "dine-in",
      table: "12",
      customer: "Nhóm Anh Minh",
      items: ["Lẩu Thái", "Combo Hải Sản VIP"],
      total: "2.500.000 ₫",
      status: "pending",
      time: "20 phút trước",
    },
    {
      id: "1021",
      type: "takeaway",
      table: null,
      customer: "Khách Vãng Lai",
      items: ["Cafe Sữa Đá"],
      total: "35.000 ₫",
      status: "ready",
      time: "30 phút trước",
    },
  ];

  // Logic lọc
  const displayOrders =
    filter === "all"
      ? allOrders
      : allOrders.filter(
          (o) =>
            o.type === filter ||
            (filter === "delivery" && o.type === "takeaway")
        );

  return (
    <div className="recent-orders-card">
      {/* Header & Tabs */}
      <div className="card-header">
        <div className="header-left">
          <h3>Đơn Hàng Gần Đây</h3>
          <div className="tabs">
            <button
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              Tất cả
            </button>
            <button
              className={filter === "dine-in" ? "active" : ""}
              onClick={() => setFilter("dine-in")}
            >
              Tại bàn
            </button>
            <button
              className={filter === "delivery" ? "active" : ""}
              onClick={() => setFilter("delivery")}
            >
              Giao đi
            </button>
          </div>
        </div>
        <button className="view-all-link">
          Xem tất cả <ArrowRight size={16} />
        </button>
      </div>

      {/* Header Columns (Optional - Scientific Look) */}
      <div className="list-header-row">
        <span className="col-1">Đơn hàng</span>
        <span className="col-2">Trạng thái</span>
        <span className="col-3">Tổng tiền</span>
      </div>

      {/* List */}
      <div className="orders-list-body">
        {displayOrders.length > 0 ? (
          displayOrders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))
        ) : (
          <div className="empty-state">Không có đơn hàng nào.</div>
        )}
      </div>
    </div>
  );
};

export default RecentOrders;
