import React, { useState, useRef } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiEdit3,
  FiTrash2,
  FiCopy,
  FiEye,
  FiLayers,
  FiMoreVertical,
  FiTrendingUp,
  FiStar,
  FiClock,
  FiChevronUp,
  FiChevronDown, // Icon cho nút thu gọn
} from "react-icons/fi";
import "./CompactMenuStrip.scss";

// --- Dữ liệu mẫu (Giữ nguyên sự phong phú) ---
const MOCK_DATA = [
  {
    _id: "m1",
    name: "Sáng Khởi Động (Business)",
    description: "Combo năng lượng cho dân văn phòng.",
    timeSlot: "breakfast",
    itemCount: 15,
    revenue: "2.5M",
    rating: 4.8,
    isActive: true,
    coverImage:
      "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&q=80",
  },
  {
    _id: "m2",
    name: "Cơm Trưa Văn Phòng",
    description: "Đổi món mỗi ngày, đầy đủ dinh dưỡng.",
    timeSlot: "lunch",
    itemCount: 24,
    revenue: "8.1M",
    rating: 4.5,
    isActive: true,
    coverImage:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80",
  },
  {
    _id: "m3",
    name: "Tiệc Tối Lãng Mạn (Couple)",
    description: "Set menu Âu Á kết hợp rượu vang.",
    timeSlot: "dinner",
    itemCount: 12,
    revenue: "12.4M",
    rating: 4.9,
    isActive: true,
    coverImage:
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80",
  },
  {
    _id: "m4",
    name: "Ăn Vặt Đêm Khuya",
    description: "Các món chiên, nướng nhẹ nhàng.",
    timeSlot: "late_night",
    itemCount: 8,
    revenue: "1.2M",
    rating: 4.2,
    isActive: false,
    coverImage:
      "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&q=80",
  },
  {
    _id: "m5",
    name: "Brunch Cuối Tuần",
    description: "Thực đơn đặc biệt thứ 7 & CN.",
    timeSlot: "lunch",
    itemCount: 30,
    revenue: "5.6M",
    rating: 4.7,
    isActive: true,
    coverImage:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&q=80",
  },
];

const SLOT_CONFIG = {
  breakfast: {
    label: "Sáng",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  lunch: { label: "Trưa", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  dinner: { label: "Tối", color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" },
  late_night: {
    label: "Khuya",
    color: "#db2777",
    bg: "#fdf2f8",
    border: "#fbcfe8",
  },
};

const CompactMenuStrip = ({ onAdd, onEdit, onDelete }) => {
  const [activeId, setActiveId] = useState(MOCK_DATA[0]?._id);
  const [isCollapsed, setIsCollapsed] = useState(false); // State thu gọn
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className={`compact-menu-strip ${isCollapsed ? "collapsed" : ""}`}>
      {/* --- Header Section --- */}
      <div className="strip-header">
        <div className="header-info">
          <div className="icon-wrapper">
            <FiLayers size={22} />
          </div>
          <div className="text-wrapper">
            <h3>Quản Lý Thực Đơn</h3>
            {!isCollapsed && (
              <p>
                Tổng quan <strong>{MOCK_DATA.length}</strong> thực đơn đang hoạt
                động
              </p>
            )}
          </div>
        </div>

        <div className="header-actions">
          {/* Nút điều hướng chỉ hiện khi mở rộng */}
          {!isCollapsed && (
            <>
              <div className="nav-group">
                <button className="nav-btn" onClick={() => scroll("left")}>
                  <FiChevronLeft />
                </button>
                <button className="nav-btn" onClick={() => scroll("right")}>
                  <FiChevronRight />
                </button>
              </div>
              <button className="btn-primary-add" onClick={onAdd}>
                <FiPlus /> <span className="text">Tạo Menu Mới</span>
              </button>
            </>
          )}

          {/* Nút Thu Gọn / Mở Rộng */}
          <button
            className="toggle-collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Mở rộng" : "Thu gọn"}
          >
            {isCollapsed ? (
              <FiChevronDown size={20} />
            ) : (
              <FiChevronUp size={20} />
            )}
          </button>
        </div>
      </div>

      {/* --- Cards Scroll Section (Ẩn khi collapsed) --- */}
      {!isCollapsed && (
        <div className="cards-viewport">
          <div className="cards-track" ref={scrollRef}>
            {MOCK_DATA.map((menu) => {
              const slotStyle =
                SLOT_CONFIG[menu.timeSlot] || SLOT_CONFIG.breakfast;
              const isActive = activeId === menu._id;

              return (
                <div
                  key={menu._id}
                  className={`menu-card ${isActive ? "is-selected" : ""} ${
                    !menu.isActive ? "is-disabled" : ""
                  }`}
                  onClick={() => setActiveId(menu._id)}
                >
                  {/* Card Top */}
                  <div className="card-top">
                    <div className="img-holder">
                      <img src={menu.coverImage} alt={menu.name} />
                    </div>
                    <div className="badges">
                      <span
                        className="slot-badge"
                        style={{
                          color: slotStyle.color,
                          background: slotStyle.bg,
                          borderColor: slotStyle.border,
                        }}
                      >
                        <FiClock size={10} style={{ marginRight: 4 }} />{" "}
                        {slotStyle.label}
                      </span>
                      {!menu.isActive && (
                        <span className="status-badge off">Đang ẩn</span>
                      )}
                    </div>
                    <button
                      className="more-opt"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FiMoreVertical />
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="card-body">
                    <h3 title={menu.name}>{menu.name}</h3>
                    <p className="desc">{menu.description}</p>

                    <div className="stats-row">
                      <div className="stat" title="Số lượng món">
                        <FiLayers className="ic" />{" "}
                        <strong>{menu.itemCount}</strong>
                      </div>
                      <div className="stat" title="Đánh giá">
                        <FiStar className="ic star" />{" "}
                        <strong>{menu.rating}</strong>
                      </div>
                      <div className="stat" title="Doanh thu">
                        <FiTrendingUp className="ic grow" />{" "}
                        <strong>{menu.revenue}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Action Toolbar - Fix vị trí */}
                  <div className="action-toolbar">
                    <button
                      className="tool-btn edit"
                      title="Chỉnh sửa"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(menu);
                      }}
                    >
                      <FiEdit3 /> <span>Sửa</span>
                    </button>
                    <div className="divider"></div>
                    <button
                      className="tool-btn icon-only"
                      title="Nhân bản"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FiCopy />
                    </button>
                    <button
                      className="tool-btn icon-only delete"
                      title="Xóa"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(menu._id);
                      }}
                    >
                      <FiTrash2 />
                    </button>
                  </div>

                  {isActive && <div className="active-indicator"></div>}
                </div>
              );
            })}

            {/* Ghost Card */}
            <div className="menu-card ghost-card" onClick={onAdd}>
              <div className="ghost-content">
                <div className="circle-plus">
                  <FiPlus size={24} />
                </div>
                <h4>Thêm Menu</h4>
              </div>
            </div>

            <div className="spacer-right"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompactMenuStrip;
