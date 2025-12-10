// src/pages/Restaurant/MenuManagement/components/CompactMenuStrip/CompactMenuStrip.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiEdit3,
  FiTrash2,
  FiCopy,
  FiLayers,
  FiMoreVertical,
  FiTrendingUp,
  FiStar,
  FiClock,
  FiChevronUp,
  FiChevronDown,
  FiTag, // Import thêm icon Tag nếu muốn đẹp hơn
} from "react-icons/fi";
import "./CompactMenuStrip.scss";

const SLOT_CONFIG = {
  breakfast: {
    label: "Sáng",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  lunch: {
    label: "Trưa",
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
  },
  dinner: {
    label: "Tối",
    color: "#4f46e5",
    bg: "#eef2ff",
    border: "#c7d2fe",
  },
  late_night: {
    label: "Khuya",
    color: "#db2777",
    bg: "#fdf2f8",
    border: "#fbcfe8",
  },
};

const CompactMenuStrip = ({
  menus = [],
  menusLoading = false,
  menusError = null,
  isCollapsed = false,
  onToggleCollapse,
  onAddMenu,
  onEditMenu,
  onDeleteMenu,
}) => {
  const scrollRef = useRef(null);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (menus.length > 0 && !activeId) {
      setActiveId(menus[0].id);
    }
    if (!menus.length && activeId) {
      setActiveId(null);
    }
  }, [menus, activeId]);

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    const scrollAmount = 320;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const totalMenus = menus.length;

  return (
    <div className={`compact-menu-strip ${isCollapsed ? "collapsed" : ""}`}>
      {/* Header */}
      <div className="strip-header">
        <div className="header-info">
          <div className="icon-wrapper">
            <FiLayers size={22} />
          </div>
          <div className="text-wrapper">
            <h3>Quản Lý Thực Đơn</h3>
            {!isCollapsed && (
              <>
                {menusLoading ? (
                  <p>Đang tải danh sách menu...</p>
                ) : (
                  <p>
                    Có <strong>{totalMenus}</strong> menu theo khung giờ
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="header-actions">
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
              <button className="btn-primary-add" onClick={() => onAddMenu?.()}>
                <FiPlus /> <span className="text">Tạo Menu Mới</span>
              </button>
            </>
          )}

          <button
            className="toggle-collapse-btn"
            onClick={() => onToggleCollapse?.()}
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

      {!isCollapsed && menusError && (
        <div className="strip-error">
          Lỗi khi tải menu: {menusError.message}
        </div>
      )}

      {/* Cards */}
      {!isCollapsed && (
        <div className="cards-viewport">
          <div className="cards-track" ref={scrollRef}>
            {!menusLoading &&
              menus.map((menu) => {
                const slotStyle =
                  SLOT_CONFIG[menu.timeSlot] || SLOT_CONFIG.breakfast;
                const isActiveCard =
                  activeId === menu.id ||
                  (!activeId && menus[0]?.id === menu.id);

                const itemCount =
                  typeof menu.itemCount === "number" ? menu.itemCount : 0;
                const rating =
                  typeof menu.rating === "number" ? menu.rating : 4.5;
                const revenue = menu.revenue || "-";

                // --- Lấy tên danh mục từ object categoryMenu ---
                const categoryName = menu.categoryMenu?.name;

                return (
                  <div
                    key={menu.id}
                    className={`menu-card ${
                      isActiveCard ? "is-selected" : ""
                    } ${menu.isActive === false ? "is-disabled" : ""}`}
                    onClick={() => setActiveId(menu.id)}
                  >
                    <div className="card-top">
                      <div className="img-holder">
                        {menu.coverImage ? (
                          <img src={menu.coverImage} alt={menu.name} />
                        ) : (
                          <div className="img-placeholder">📋</div>
                        )}

                        {/* --- HIỂN THỊ CATEGORY BADGE (GÓC PHẢI) --- */}
                        {categoryName && (
                          <span className="category-overlay-badge">
                            {categoryName}
                          </span>
                        )}
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
                        {menu.isActive === false && (
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

                    <div className="card-body">
                      <h3 title={menu.name}>{menu.name}</h3>
                      {menu.description && (
                        <p className="desc">{menu.description}</p>
                      )}

                      <div className="stats-row">
                        <div className="stat" title="Số lượng món (mock)">
                          <FiLayers className="ic" />{" "}
                          <strong>{itemCount}</strong>
                        </div>
                        <div className="stat" title="Đánh giá (mock)">
                          <FiStar className="ic star" />{" "}
                          <strong>{rating}</strong>
                        </div>
                        <div className="stat" title="Doanh thu (mock)">
                          <FiTrendingUp className="ic grow" />{" "}
                          <strong>{revenue}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="action-toolbar">
                      <button
                        className="tool-btn edit"
                        title="Chỉnh sửa"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditMenu?.(menu);
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
                          onDeleteMenu?.(menu);
                        }}
                      >
                        <FiTrash2 />
                      </button>
                    </div>

                    {isActiveCard && <div className="active-indicator"></div>}
                  </div>
                );
              })}

            {!menusLoading && (
              <div
                className="menu-card ghost-card"
                onClick={() => onAddMenu?.()}
              >
                <div className="ghost-content">
                  <div className="circle-plus">
                    <FiPlus size={24} />
                  </div>
                  <h4>Thêm Menu</h4>
                </div>
              </div>
            )}

            <div className="spacer-right"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompactMenuStrip;
