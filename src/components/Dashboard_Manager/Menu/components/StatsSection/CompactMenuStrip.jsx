import React, { useContext, useEffect, useRef, useState } from "react";
import {
  FiActivity,
  FiChevronLeft,
  FiChevronRight,
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
  breakfast: { label: "Bữa sáng" },
  lunch: { label: "Bữa trưa" },
  dinner: { label: "Bữa tối" },
  late_night: { label: "Bữa khuya" },
};

const formatCompactRevenue = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "--";
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)} triệu`;
  if (number >= 1000) return `${Math.round(number / 1000)} nghìn`;
  return String(Math.round(number));
};

const CompactMenuStrip = ({
  menus = [],
  menusLoading = false,
  menusError = null,
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
    canAccessMenuManagementAction(
      auth?.user,
      MENU_MANAGEMENT_ACTIONS.SYNC_INVENTORY,
    ) && typeof onSyncInventory === "function";
  const canViewHistory = canAccessMenuManagementAction(
    auth?.user,
    MENU_MANAGEMENT_ACTIONS.VIEW_AUDIT,
  );
  const currentActiveId =
    activeMenuId !== undefined ? activeMenuId : internalActiveId;
  const restaurantId =
    menus.find((menu) => menu?.restaurantId)?.restaurantId || null;

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
    if (
      !restaurantId ||
      isSyncingInventory ||
      typeof onSyncInventory !== "function"
    ) {
      return;
    }

    const timeSlot = selectedTimeSlot || menus[0]?.timeSlot || "breakfast";
    setIsSyncingInventory(true);
    setActionError("");
    setActionMessage("");

    try {
      const result = await onSyncInventory({ restaurantId, timeSlot });
      if (!result) return;
      const warningText = result?.warnings?.length
        ? ` Có ${result.warnings.length} cảnh báo cần xem lại.`
        : "";
      setActionMessage(
        `Đã kiểm tra ${result?.checkedCount || 0} món và cập nhật ${result?.updatedCount || 0} trạng thái.${warningText}`,
      );
    } catch (error) {
      setActionError(
        error?.message || "Không thể kiểm tra tồn kho. Vui lòng thử lại.",
      );
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
      <div className="cms-container">
        <div className="cms-header">
          <div className="cms-info">
            <div className="cms-icon-box">
              <FiLayers size={22} />
            </div>
            <div className="cms-title-box">
              <h3>Các thực đơn của nhà hàng</h3>
              <p>
                Chọn một thực đơn để quản lý món. Hiện có{" "}
                <strong>{menus.length}</strong> thực đơn theo các khung giờ.
              </p>
            </div>
          </div>

          <div className="cms-actions">
            <div className="cms-nav-group">
              <button
                type="button"
                className="cms-nav-btn"
                aria-label="Cuộn danh sách thực đơn sang trái"
                onClick={() => scroll("left")}
                disabled={!menus.length}
              >
                <FiChevronLeft />
              </button>
              <button
                type="button"
                className="cms-nav-btn"
                aria-label="Cuộn danh sách thực đơn sang phải"
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
                aria-label="Kiểm tra tồn kho của thực đơn"
                onClick={handleSyncInventory}
                disabled={!restaurantId || isSyncingInventory}
                title="Cập nhật trạng thái món theo tồn kho nguyên liệu"
              >
                <FiRefreshCw />
                <span className="text">
                  {isSyncingInventory
                    ? "Đang kiểm tra..."
                    : "Kiểm tra tồn kho"}
                </span>
              </button>
            )}

            {canAddMenu && (
              <button
                className="cms-btn-add"
                type="button"
                aria-label="Tạo thực đơn theo khung giờ"
                onClick={() => onAddMenu()}
              >
                <FiPlus /> <span className="text">Tạo thực đơn</span>
              </button>
            )}
          </div>
        </div>

        {menusError && (
          <div className="cms-action-msg cms-action-msg--error">
            Không thể tải thực đơn: {menusError.message}
          </div>
        )}
        {actionError && (
          <div className="cms-action-msg cms-action-msg--error">
            {actionError}
          </div>
        )}
        {actionMessage && (
          <div className="cms-action-msg cms-action-msg--success">
            {actionMessage}
          </div>
        )}

        <div className="cms-viewport">
          <div className="cms-track" ref={scrollRef}>
            {!menusLoading &&
              menus.map((menu) => {
                const slot =
                  SLOT_CONFIG[menu.timeSlot] || SLOT_CONFIG.breakfast;
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
                              alt={`Ảnh đại diện thực đơn ${menu.name}`}
                              variant={LOCAL_IMAGE_VARIANTS.THUMB}
                              fallback={
                                <div className="cms-placeholder">Thực đơn</div>
                              }
                            />
                          ) : (
                            <div className="cms-placeholder">Thực đơn</div>
                          )}

                          {menu.categoryMenu?.name && (
                            <span className="cms-cate-badge">
                              Nhóm: {menu.categoryMenu.name}
                            </span>
                          )}
                        </div>

                        <div className="cms-badges">
                          <span
                            className={`cms-slot-tag cms-slot-tag--${String(
                              menu.timeSlot || "breakfast",
                            ).replace(/_/g, "-")}`}
                          >
                            <FiClock size={10} className="cms-slot-tag__icon" />{" "}
                            {slot.label}
                          </span>
                          {menu.isActive === false && (
                            <span className="cms-status-off">
                              Đang ẩn với khách
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="cms-card-body">
                        <h3 title={menu.name}>{menu.name}</h3>
                        <p className="cms-desc">
                          {menu.description || "Chưa có mô tả"}
                        </p>
                        <div className="cms-stats">
                          <div className="cms-stat-item" title="Số món trong thực đơn">
                            <FiLayers className="ic" />{" "}
                            <strong>{menu.itemCount || 0}</strong>
                          </div>
                          <div className="cms-stat-item" title="Điểm đánh giá">
                            <FiStar className="ic star" />{" "}
                            <strong>{menu.rating ?? "--"}</strong>
                          </div>
                          <div
                            className="cms-stat-item"
                            title={`Đơn hàng: ${menu.orderCount || 0} · Số phần đã bán: ${menu.soldItemCount || 0}`}
                          >
                            <FiTrendingUp className="ic grow" />{" "}
                            <strong>
                              {formatCompactRevenue(menu.revenue)}
                            </strong>
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
                            onClick={(event) => {
                              event.stopPropagation();
                              onEditMenu(menu);
                            }}
                          >
                            <FiEdit3 /> <span>Chỉnh sửa</span>
                          </button>
                          <div className="cms-div" />
                        </>
                      )}

                      {canToggleMenuActive && (
                        <button
                          type="button"
                          className={`cms-tool-btn ${menu.isActive === false ? "is-show" : "is-hide"}`}
                          aria-label={
                            menu.isActive === false
                              ? `Hiển thị lại thực đơn ${menu.name}`
                              : `Ẩn thực đơn ${menu.name}`
                          }
                          title={
                            menu.isActive === false
                              ? "Hiển thị lại với khách"
                              : "Ẩn khỏi trang khách hàng"
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleMenuActive(menu);
                          }}
                        >
                          {menu.isActive === false ? <FiEye /> : <FiEyeOff />}
                          <span>
                            {menu.isActive === false ? "Hiển thị" : "Ẩn"}
                          </span>
                        </button>
                      )}

                      {canCopyMenu && (
                        <button
                          type="button"
                          className="cms-tool-btn"
                          aria-label={`Sao chép thực đơn ${menu.name}`}
                          title="Sao chép thực đơn, món ăn và công thức"
                          disabled={!!busyMenuId}
                          onClick={async (event) => {
                            event.stopPropagation();
                            await onCopyMenu(menu);
                          }}
                        >
                          <FiCopy />
                          {busy && <span>Đang xử lý</span>}
                        </button>
                      )}

                      {canViewHistory && (
                        <button
                          type="button"
                          className="cms-tool-btn is-history"
                          aria-label={`Xem lịch sử thực đơn ${menu.name}`}
                          title="Xem lịch sử thay đổi"
                          onClick={(event) => {
                            event.stopPropagation();
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
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteMenu(menu);
                          }}
                        >
                          <FiTrash2 />
                          {busy && <span>Đang xử lý</span>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            {!menusLoading && canAddMenu && (
              <button
                type="button"
                className="cms-card cms-ghost"
                onClick={() => onAddMenu()}
              >
                <div className="cms-ghost-inner">
                  <div className="cms-ghost-circle">
                    <FiPlus size={24} />
                  </div>
                  <h4>Tạo thực đơn theo khung giờ</h4>
                </div>
              </button>
            )}

            <div className="cms-spacer" />
          </div>
        </div>
      </div>

      <AuditLogModal
        isOpen={!!historyMenu}
        onClose={() => setHistoryMenu(null)}
        restaurantId={historyMenu?.restaurantId}
        entity="Menu"
        entityId={historyMenu?.id || historyMenu?._id}
        title={`Lịch sử thực đơn: ${historyMenu?.name || "Thực đơn"}`}
      />
    </>
  );
};

export default CompactMenuStrip;
