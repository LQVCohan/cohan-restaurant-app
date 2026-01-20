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
} from "react-icons/fi";
import "./CompactMenuStrip.scss";

// Không thay đổi config, chỉ đổi tên class bên dưới
const SLOT_CONFIG = {
  breakfast: {
    label: "Sáng",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  lunch: { label: "Trưa", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  dinner: { label: "Tối", color: "#b89365", bg: "#fdf8f3", border: "#f1e5d5" },
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
  activeMenuId,
  onSelectMenu,
}) => {
  const scrollRef = useRef(null);
  const [internalActiveId, setInternalActiveId] = useState(null);
  const currentActiveId =
    activeMenuId !== undefined ? activeMenuId : internalActiveId;

  useEffect(() => {
    if (menus.length > 0 && !currentActiveId && !activeMenuId) {
      const firstId = menus[0].id;
      setInternalActiveId(firstId);
      onSelectMenu?.(menus[0]);
    }
  }, [menus, currentActiveId, activeMenuId, onSelectMenu]);

  const handleCardClick = (menu) => {
    setInternalActiveId(menu.id);
    onSelectMenu?.(menu);
  };

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const totalMenus = menus.length;

  return (
    <div className={`cms-container ${isCollapsed ? "is-collapsed" : ""}`}>
      {/* Header */}
      <div className="cms-header">
        <div className="cms-info">
          <div className="cms-icon-box">
            <FiLayers size={22} />
          </div>
          <div className="cms-title-box">
            <h3>Quản Lý Thực Đơn</h3>
            {!isCollapsed && (
              <>
                {menusLoading ? (
                  <p>Đang tải danh sách...</p>
                ) : (
                  <p>
                    Đã tạo <strong>{totalMenus}</strong> menu theo khung giờ
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="cms-actions">
          {!isCollapsed && (
            <>
              <div className="cms-nav-group">
                <button
                  className="cms-nav-btn"
                  onClick={() => scroll("left")}
                  disabled={menus.length === 0}
                >
                  <FiChevronLeft />
                </button>
                <button
                  className="cms-nav-btn"
                  onClick={() => scroll("right")}
                  disabled={menus.length === 0}
                >
                  <FiChevronRight />
                </button>
              </div>
              <button className="cms-btn-add" onClick={() => onAddMenu?.()}>
                <FiPlus /> <span className="text">Tạo Menu</span>
              </button>
            </>
          )}

          <button
            className="cms-btn-toggle"
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
        <div className="cms-error-msg">Lỗi: {menusError.message}</div>
      )}

      {/* Cards Viewport */}
      {!isCollapsed && (
        <div className="cms-viewport">
          <div className="cms-track" ref={scrollRef}>
            {!menusLoading &&
              menus.map((menu) => {
                const slotStyle =
                  SLOT_CONFIG[menu.timeSlot] || SLOT_CONFIG.breakfast;
                const isActive = currentActiveId === menu.id;
                const itemCount =
                  typeof menu.itemCount === "number" ? menu.itemCount : 0;
                const rating =
                  typeof menu.rating === "number" ? menu.rating : 4.5;
                const revenue = menu.revenue || "0đ";
                const categoryName = menu.categoryMenu?.name;

                return (
                  <div
                    key={menu.id}
                    className={`cms-card ${isActive ? "cms-active" : ""} ${
                      menu.isActive === false ? "cms-disabled" : ""
                    }`}
                    onClick={() => handleCardClick(menu)}
                  >
                    {isActive && <div className="cms-indicator"></div>}

                    <div className="cms-card-top">
                      <div className="cms-img-box">
                        {menu.coverImage ? (
                          <img src={menu.coverImage} alt={menu.name} />
                        ) : (
                          <div className="cms-placeholder">🍽️</div>
                        )}
                        {categoryName && (
                          <span className="cms-cate-badge">{categoryName}</span>
                        )}
                      </div>

                      <div className="cms-badges">
                        <span
                          className="cms-slot-tag"
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
                          <span className="cms-status-off">Đang ẩn</span>
                        )}
                      </div>

                      <button
                        className="cms-more-btn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FiMoreVertical />
                      </button>
                    </div>

                    <div className="cms-card-body">
                      <h3 title={menu.name}>{menu.name}</h3>
                      <p className="cms-desc">
                        {menu.description || "Chưa có mô tả..."}
                      </p>

                      <div className="cms-stats">
                        <div className="cms-stat-item" title="Số món">
                          <FiLayers className="ic" />{" "}
                          <strong>{itemCount}</strong>
                        </div>
                        <div className="cms-stat-item" title="Đánh giá">
                          <FiStar className="ic star" />{" "}
                          <strong>{rating}</strong>
                        </div>
                        <div className="cms-stat-item" title="Doanh thu">
                          <FiTrendingUp className="ic grow" />{" "}
                          <strong>{revenue}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="cms-toolbar">
                      <button
                        className="cms-tool-btn is-edit"
                        title="Chỉnh sửa"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditMenu?.(menu);
                        }}
                      >
                        <FiEdit3 /> <span>Sửa</span>
                      </button>
                      <div className="cms-div"></div>
                      <button
                        className="cms-tool-btn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FiCopy />
                      </button>
                      <button
                        className="cms-tool-btn is-delete"
                        title="Xóa"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteMenu?.(menu);
                        }}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                );
              })}

            {!menusLoading && (
              <div className="cms-card cms-ghost" onClick={() => onAddMenu?.()}>
                <div className="cms-ghost-inner">
                  <div className="cms-ghost-circle">
                    <FiPlus size={24} />
                  </div>
                  <h4>Thêm Menu</h4>
                </div>
              </div>
            )}

            <div className="cms-spacer"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompactMenuStrip;
