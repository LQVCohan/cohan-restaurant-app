import React, { useContext, useEffect, useRef, useState } from "react";
import {
  FiActivity,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiClock,
  FiCopy,
  FiEdit3,
  FiEye,
  FiEyeOff,
  FiLayers,
  FiPlus,
  FiRefreshCw,
  FiStar,
  FiTrash2,
  FiTrendingUp,
} from "react-icons/fi";
import { AuthContext } from "../../../../../context/AuthContext";
import {
  MENU_MANAGEMENT_ACTIONS,
  canAccessMenuManagementAction,
} from "../../../../../utils/frontendRoleAccess";
import { LOCAL_IMAGE_VARIANTS } from "../../../../../utils/localImageStore";
import LocalImageView from "../../../../common/LocalImageView";
import AuditLogModal from "../AuditLogModal/AuditLogModal";
import "./CompactMenuStrip.scss";
import "./CompactMenuStripPolish.scss";

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
    color: "#b89365",
    bg: "#fdf8f3",
    border: "#f1e5d5",
  },
  late_night: {
    label: "Khuya",
    color: "#db2777",
    bg: "#fdf2f8",
    border: "#fbcfe8",
  },
};

const formatCompactRevenue = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "--";
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}tr`;
  if (number >= 1000) return `${Math.round(number / 1000)}k`;
  return String(Math.round(number));
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
  onToggleMenuActive,
  onCopyMenu,
  activeMenuId,
  selectedTimeSlot,
  onTimeSlotChange,
  onSelectMenu,
  onSyncInventory,
}) => {
  const auth = useContext(AuthContext);
  const scrollRef = useRef(null);
  const [internalActiveId, setInternalActiveId] = useState(null);
  const [historyMenu, setHistoryMenu] = useState(null);
  const [busyMenuId, setBusyMenuId] = useState(null);
  const [isSyncingInventory, setIsSyncingInventory] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const canAddMenu = typeof onAddMenu === "function";
  const canEditMenu = typeof onEditMenu === "function";
  const canToggleMenuActive = typeof onToggleMenuActive === "function";
  const canCopyMenu = typeof onCopyMenu === "function";
  const canDeleteMenu = typeof onDeleteMenu === "function";
  const canSyncInventory =
    canAccessMenuManagementAction(auth?.user, MENU_MANAGEMENT_ACTIONS.SYNC_INVENTORY) &&
    typeof onSyncInventory === "function";
  const canViewHistory = canAccessMenuManagementAction(
    auth?.user,
    MENU_MANAGEMENT_ACTIONS.VIEW_AUDIT,
  );
  const currentActiveId = activeMenuId !== undefined ? activeMenuId : internalActiveId;
  const restaurantId = menus.find((menu) => menu?.restaurantId)?.restaurantId || null;

  useEffect(() => {
    if (!menus.length || currentActiveId || activeMenuId) return;
    setInternalActiveId(menus[0].id);
    onSelectMenu?.(menus[0]);
  }, [menus, currentActiveId, activeMenuId, onSelectMenu]);


  const selectMenu = (menu) => {
    setInternalActiveId(menu.id);
    onSelectMenu?.(menu);
    onTimeSlotChange?.(menu?.timeSlot || null);
  };

  const handleSyncInventory = async () => {
    if (!restaurantId || isSyncingInventory || typeof onSyncInventory !== "function") return;
    const timeSlot = selectedTimeSlot || menus[0]?.timeSlot || "breakfast";

    setIsSyncingInventory(true);
    setActionError("");
    setActionMessage("");

    try {
      const result = await onSyncInventory({ restaurantId, timeSlot });
      if (!result) return;
      const warningText = result?.warnings?.length
        ? ` Có ${result.warnings.length} cảnh báo cần kiểm tra.`
        : "";
      setActionMessage(`Đã kiểm tra ${result?.checkedCount || 0} món, cập nhật ${result?.updatedCount || 0} trạng thái.${warningText}`);
    } catch (error) {
      setActionError(error?.message || "Không thể đồng bộ tồn kho. Vui lòng thử lại.");
    } finally {
      setIsSyncingInventory(false);
    }
  };

  const handleDeleteMenu = async (menu) => {
    if (!menu?.id || busyMenuId || typeof onDeleteMenu !== "function") return;
    setBusyMenuId(menu.id);
    try {
      await onDeleteMenu(menu);
    } finally {
      setBusyMenuId(null);
    }
  };

  const scroll = (direction) => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -300 : 300,
      behavior: "smooth",
    });
  };

  return (
    <>
      <div className={`cms-container ${isCollapsed ? "is-collapsed" : ""}`}>
        <div className="cms-header">
          <div className="cms-info">
            <div className="cms-icon-box">
              <FiLayers size={22} />
            </div>
            <div className="cms-title-box">
              <h3>Khung giờ thực đơn</h3>
              {!isCollapsed && (
                <p>
                  Đã tạo <strong>{menus.length}</strong> thực đơn theo khung giờ
                  và nhóm menu
                </p>
              )}
            </div>
          </div>
          <div className="cms-actions">
            {!isCollapsed && (
              <>
                <div className="cms-nav-group">
                  <button
                    type="button"
                    className="cms-nav-btn"
                    aria-label="Cuộn menu sang trái"
                    onClick={() => scroll("left")}
                    disabled={!menus.length}
                  >
                    <FiChevronLeft />
                  </button>
                  <button
                    type="button"
                    className="cms-nav-btn"
                    aria-label="Cuộn menu sang phải"
                    onClick={() => scroll("right")}
                    disabled={!menus.length}
                  >
                    <FiChevronRight />
                  </button>
                </div>
                {canSyncInventory && (
                  <button
                    type="button"
                    className="cms-btn-add"
                    aria-label="Đồng bộ tồn kho thực đơn"
                    onClick={handleSyncInventory}
                    disabled={!restaurantId || isSyncingInventory}
                    title="Đồng bộ trạng thái hết hàng theo tồn kho"
                  >
                    <FiRefreshCw />
                    <span className="text">
                      {isSyncingInventory ? "Đang đồng bộ..." : "Đồng bộ tồn kho"}
                    </span>
                  </button>
                )}
                {canAddMenu && (
                  <button className="cms-btn-add" type="button" aria-label="Tạo menu theo khung giờ" onClick={() => onAddMenu()}>
                    <FiPlus /> <span className="text">Tạo menu theo khung giờ</span>
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              className="cms-btn-toggle"
              onClick={() => onToggleCollapse?.()}
              aria-label={isCollapsed ? "Mở rộng danh sách thực đơn" : "Thu gọn danh sách thực đơn"}
              title={isCollapsed ? "Mở rộng" : "Thu gọn"}
            >
              {isCollapsed ? <FiChevronDown size={20} /> : <FiChevronUp size={20} />}
            </button>
          </div>
        </div>

        {!isCollapsed && menusError && (
          <div className="cms-error-msg">Lỗi: {menusError.message}</div>
        )}
        {!isCollapsed && actionError && (
          <div className="cms-error-msg">Lỗi: {actionError}</div>
        )}
        {!isCollapsed && actionMessage && (
          <div className="cms-error-msg" style={{ color: "#047857", borderColor: "#a7f3d0", background: "#ecfdf5" }}>
            {actionMessage}
          </div>
        )}

        {!isCollapsed && (
          <div className="cms-viewport">
            <div className="cms-track" ref={scrollRef}>
              {!menusLoading &&
                menus.map((menu) => {
                  const slot = SLOT_CONFIG[menu.timeSlot] || SLOT_CONFIG.breakfast;
                  const active = currentActiveId === menu.id;
                  const busy = busyMenuId === menu.id;
                  return (
                    <div
                      key={menu.id}
                      className={`cms-card ${active ? "cms-active" : ""} ${menu.isActive === false ? "cms-disabled" : ""}`}
                    >
                      {active && <div className="cms-indicator" />}
                      <button
                        type="button"
                        className="cms-card-select"
                        onClick={() => selectMenu(menu)}
                      >
                        <div className="cms-card-top">
                        <div className="cms-img-box">
                          {menu.coverImage ? (
                            <LocalImageView
                              src={menu.coverImage}
                              alt={menu.name}
                              variant={LOCAL_IMAGE_VARIANTS.THUMB}
                              fallback={<div className="cms-placeholder">🍽️</div>}
                            />
                          ) : (
                            <div className="cms-placeholder">🍽️</div>
                          )}
                          {menu.categoryMenu?.name && (
                            <span className="cms-cate-badge">
                              Nhóm thực đơn: {menu.categoryMenu.name}
                            </span>
                          )}
                        </div>
                        <div className="cms-badges">
                          <span
                            className="cms-slot-tag"
                            style={{
                              color: slot.color,
                              background: slot.bg,
                              borderColor: slot.border,
                            }}
                          >
                            <FiClock size={10} style={{ marginRight: 4 }} /> {slot.label}
                          </span>
                          {menu.isActive === false && (
                            <span className="cms-status-off">Đang ẩn</span>
                          )}
                        </div>
                      </div>
                      <div className="cms-card-body">
                        <h3 title={menu.name}>{menu.name}</h3>
                        <p className="cms-desc">{menu.description || "Chưa có mô tả..."}</p>
                        <div className="cms-stats">
                          <div className="cms-stat-item" title="Số món">
                            <FiLayers className="ic" /> <strong>{menu.itemCount || 0}</strong>
                          </div>
                          <div className="cms-stat-item" title="Đánh giá">
                            <FiStar className="ic star" /> <strong>{menu.rating ?? "--"}</strong>
                          </div>
                          <div
                            className="cms-stat-item"
                            title={`Đơn: ${menu.orderCount || 0} · Đã bán: ${menu.soldItemCount || 0}`}
                          >
                            <FiTrendingUp className="ic grow" /> <strong>{formatCompactRevenue(menu.revenue)}</strong>
                          </div>
                        </div>
                      </div>
                      </button>
                      <div className="cms-toolbar">
                        {canEditMenu && (
                          <>
                            <button
                              type="button"
                              className="cms-tool-btn is-edit"
                              aria-label={`Chỉnh sửa thực đơn ${menu.name}`}
                              title="Chỉnh sửa thực đơn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditMenu(menu);
                              }}
                            >
                              <FiEdit3 /> <span>Sửa</span>
                            </button>
                            <div className="cms-div" />
                          </>
                        )}
                        {canToggleMenuActive && (
                          <button
                            type="button"
                            className={`cms-tool-btn ${menu.isActive === false ? "is-show" : "is-hide"}`}
                            aria-label={menu.isActive === false ? `Bật lại thực đơn ${menu.name}` : `Ẩn thực đơn ${menu.name}`}
                            title={menu.isActive === false ? "Bật lại thực đơn" : "Ẩn thực đơn"}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleMenuActive(menu);
                            }}
                          >
                            {menu.isActive === false ? <FiEye /> : <FiEyeOff />}
                            <span>{menu.isActive === false ? "Bật" : "Ẩn"}</span>
                          </button>
                        )}
                        {canCopyMenu && (
                          <button
                            type="button"
                            className="cms-tool-btn"
                            aria-label={`Sao chép thực đơn ${menu.name}`}
                            title="Sao chép thực đơn kèm món và recipe"
                            disabled={!!busyMenuId}
                            onClick={async (e) => {
                              e.stopPropagation();
                              await onCopyMenu(menu);
                            }}
                          >
                            <FiCopy />{busy && <span>...</span>}
                          </button>
                        )}
                        {canViewHistory && (
                          <button
                            type="button"
                            className="cms-tool-btn is-history"
                            aria-label={`Xem lịch sử thực đơn ${menu.name}`}
                            title="Xem lịch sử thay đổi"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryMenu(menu);
                            }}
                          >
                            <FiActivity />
                          </button>
                        )}
                        {canDeleteMenu && (
                          <button
                            type="button"
                            className="cms-tool-btn is-delete"
                            aria-label={`Xóa thực đơn ${menu.name}`}
                            title="Xóa thực đơn"
                            disabled={!!busyMenuId}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMenu(menu);
                            }}
                          >
                            <FiTrash2 />{busy && <span>...</span>}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              {!menusLoading && canAddMenu && (
                <button type="button" className="cms-card cms-ghost" onClick={() => onAddMenu()}>
                  <div className="cms-ghost-inner">
                    <div className="cms-ghost-circle">
                      <FiPlus size={24} />
                    </div>
                    <h4>Tạo menu theo khung giờ</h4>
                  </div>
                </button>
              )}
              <div className="cms-spacer" />
            </div>
          </div>
        )}
      </div>
      <AuditLogModal
        isOpen={!!historyMenu}
        onClose={() => setHistoryMenu(null)}
        restaurantId={historyMenu?.restaurantId}
        entity="Menu"
        entityId={historyMenu?.id || historyMenu?._id}
        title={`Lịch sử menu: ${historyMenu?.name || "Thực đơn"}`}
      />
      
    </>
  );
};

export default CompactMenuStrip;
