import React, { useContext, useEffect, useState } from "react";
import {
  FiActivity,
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
import Modal from "../../../../common/Modal";
import AuditLogModal from "../AuditLogModal/AuditLogModal";
import "./CompactMenuStrip.scss";
import "./CompactMenuStripPolish.scss";

const SLOT_ORDER = ["breakfast", "lunch", "dinner", "late_night"];

const SLOT_CONFIG = {
  breakfast: {
    label: "Bữa sáng",
    description: "Thực đơn phục vụ đầu ngày",
  },
  lunch: {
    label: "Bữa trưa",
    description: "Thực đơn phục vụ buổi trưa",
  },
  dinner: {
    label: "Bữa tối",
    description: "Thực đơn phục vụ buổi tối",
  },
  late_night: {
    label: "Bữa khuya",
    description: "Thực đơn phục vụ khung giờ khuya",
  },
};

const compactNumberFormatter = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatCompactRevenue = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0
    ? compactNumberFormatter.format(number)
    : "--";
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
  const [internalActiveId, setInternalActiveId] = useState(null);
  const [historyMenu, setHistoryMenu] = useState(null);
  const [busyMenuId, setBusyMenuId] = useState(null);
  const [isSyncingInventory, setIsSyncingInventory] = useState(false);
  const [isMenuListOpen, setIsMenuListOpen] = useState(false);
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
  const menusBySlot = new Map(
    menus
      .filter((menu) => menu?.timeSlot)
      .map((menu) => [menu.timeSlot, menu]),
  );
  const missingSlotCount = SLOT_ORDER.filter(
    (timeSlot) => !menusBySlot.has(timeSlot),
  ).length;

  useEffect(() => {
    if (!menus.length || currentActiveId || activeMenuId) return;
    const selectedMenu =
      menus.find((menu) => menu.timeSlot === selectedTimeSlot) || menus[0];
    setInternalActiveId(selectedMenu.id);
    onSelectMenu?.(selectedMenu);
  }, [
    activeMenuId,
    currentActiveId,
    menus,
    onSelectMenu,
    selectedTimeSlot,
  ]);

  const selectMenu = (menu) => {
    setInternalActiveId(menu.id);
    onSelectMenu?.(menu);
    onTimeSlotChange?.(menu.timeSlot || null);
    setIsMenuListOpen(false);
  };

  const selectEmptySlot = (timeSlot) => {
    onTimeSlotChange?.(timeSlot);
    setIsMenuListOpen(false);
  };

  const closeListAndRun = (callback, menu) => {
    setIsMenuListOpen(false);
    callback?.(menu);
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

  const handleToggleMenu = async (menu) => {
    if (!menu?.id || busyMenuId || !canToggleMenuActive) return;
    setBusyMenuId(menu.id);
    setActionError("");
    try {
      await onToggleMenuActive(menu);
    } catch (error) {
      setActionError(
        error?.message || "Không thể cập nhật trạng thái thực đơn.",
      );
    } finally {
      setBusyMenuId(null);
    }
  };

  const handleDeleteMenu = async (menu) => {
    if (!menu?.id || busyMenuId || !canDeleteMenu) return;
    setBusyMenuId(menu.id);
    setIsMenuListOpen(false);
    try {
      await onDeleteMenu(menu);
    } finally {
      setBusyMenuId(null);
    }
  };

  const openHistory = (menu) => {
    setIsMenuListOpen(false);
    setHistoryMenu(menu);
  };

  const renderSlotGrid = () => (
    <div className="cms-slot-grid" aria-label="4 khung giờ thực đơn">
      {menusLoading && menus.length === 0
        ? SLOT_ORDER.map((timeSlot) => (
            <article
              key={timeSlot}
              className="cms-card cms-card--loading"
              aria-label={`Đang tải ${SLOT_CONFIG[timeSlot].label}`}
            >
              <span className="cms-skeleton cms-skeleton--badge" />
              <span className="cms-skeleton cms-skeleton--title" />
              <span className="cms-skeleton cms-skeleton--line" />
              <span className="cms-skeleton cms-skeleton--stats" />
            </article>
          ))
        : SLOT_ORDER.map((timeSlot) => {
            const slot = SLOT_CONFIG[timeSlot];
            const menu = menusBySlot.get(timeSlot);

            if (!menu) {
              const selected = selectedTimeSlot === timeSlot;
              return (
                <article
                  key={timeSlot}
                  className={`cms-card cms-card--empty ${selected ? "cms-active" : ""}`}
                >
                  {selected && <div className="cms-indicator" />}
                  <button
                    type="button"
                    className="cms-empty-select"
                    onClick={() => selectEmptySlot(timeSlot)}
                    aria-pressed={selected}
                    aria-label={`Chọn ${slot.label}, chưa có thực đơn`}
                  >
                    <span
                      className={`cms-slot-tag cms-slot-tag--${timeSlot.replace(/_/g, "-")}`}
                    >
                      <FiClock aria-hidden="true" />
                      {slot.label}
                    </span>
                    <span className="cms-empty-icon" aria-hidden="true">
                      <FiPlus />
                    </span>
                    <strong>Chưa có thực đơn</strong>
                    <span>{slot.description}</span>
                    <small>Chọn khung giờ này để tạo thực đơn mới.</small>
                  </button>
                </article>
              );
            }

            const active =
              currentActiveId === menu.id || selectedTimeSlot === timeSlot;
            const busy = busyMenuId === menu.id;

            return (
              <article
                key={menu.id}
                className={`cms-card ${active ? "cms-active" : ""} ${menu.isActive === false ? "cms-disabled" : ""}`}
              >
                {active && <div className="cms-indicator" />}

                <button
                  type="button"
                  className="cms-card-select"
                  onClick={() => selectMenu(menu)}
                  aria-pressed={active}
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
                          Bộ: {menu.categoryMenu.name}
                        </span>
                      )}
                    </div>

                    <div className="cms-badges">
                      <span
                        className={`cms-slot-tag cms-slot-tag--${timeSlot.replace(/_/g, "-")}`}
                      >
                        <FiClock aria-hidden="true" />
                        {slot.label}
                      </span>
                      <span
                        className={`cms-visibility-status ${menu.isActive === false ? "is-hidden" : "is-visible"}`}
                      >
                        {menu.isActive === false
                          ? "Đang ẩn với khách"
                          : "Đang hiển thị"}
                      </span>
                    </div>
                  </div>

                  <div className="cms-card-body">
                    <h3 title={menu.name}>{menu.name}</h3>
                    <p className="cms-desc">
                      {menu.description || "Chưa có mô tả"}
                    </p>
                    <div className="cms-stats">
                      <div className="cms-stat-item" title="Số món trong thực đơn">
                        <FiLayers className="ic" aria-hidden="true" />
                        <strong>{menu.itemCount || 0}</strong>
                        <span>món</span>
                      </div>
                      <div className="cms-stat-item" title="Điểm đánh giá">
                        <FiStar className="ic star" aria-hidden="true" />
                        <strong>{menu.rating ?? "--"}</strong>
                      </div>
                      <div
                        className="cms-stat-item"
                        title={`Đơn hàng: ${menu.orderCount || 0} · Số phần đã bán: ${menu.soldItemCount || 0}`}
                      >
                        <FiTrendingUp className="ic grow" aria-hidden="true" />
                        <strong>{formatCompactRevenue(menu.revenue)}</strong>
                      </div>
                    </div>
                  </div>
                </button>

                <div className="cms-toolbar" aria-label={`Thao tác ${menu.name}`}>
                  {canEditMenu && (
                    <button
                      type="button"
                      className="cms-tool-btn is-edit"
                      aria-label={`Chỉnh sửa thực đơn ${menu.name}`}
                      onClick={() => closeListAndRun(onEditMenu, menu)}
                    >
                      <FiEdit3 aria-hidden="true" />
                      <span>Sửa</span>
                    </button>
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
                      disabled={busy}
                      onClick={() => handleToggleMenu(menu)}
                    >
                      {menu.isActive === false ? (
                        <FiEye aria-hidden="true" />
                      ) : (
                        <FiEyeOff aria-hidden="true" />
                      )}
                      <span>
                        {busy
                          ? "Đang xử lý…"
                          : menu.isActive === false
                            ? "Hiển thị"
                            : "Ẩn"}
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
                      onClick={() => closeListAndRun(onCopyMenu, menu)}
                    >
                      <FiCopy aria-hidden="true" />
                      <span>Sao chép</span>
                    </button>
                  )}

                  {canViewHistory && (
                    <button
                      type="button"
                      className="cms-tool-btn is-history"
                      aria-label={`Xem lịch sử thực đơn ${menu.name}`}
                      onClick={() => openHistory(menu)}
                    >
                      <FiActivity aria-hidden="true" />
                      <span>Lịch sử</span>
                    </button>
                  )}

                  {canDeleteMenu && (
                    <button
                      type="button"
                      className="cms-tool-btn is-delete"
                      aria-label={`Xóa thực đơn ${menu.name}`}
                      disabled={!!busyMenuId}
                      onClick={() => handleDeleteMenu(menu)}
                    >
                      <FiTrash2 aria-hidden="true" />
                      <span>Xóa</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
    </div>
  );

  return (
    <>
      <section className="cms-container" aria-labelledby="cms-title">
        <div className="cms-header">
          <div className="cms-info">
            <div className="cms-icon-box" aria-hidden="true">
              <FiLayers size={22} />
            </div>
            <div className="cms-title-box">
              <h3 id="cms-title">Danh sách thực đơn</h3>
              <p>
                Hiện có <strong>{menus.length}</strong> thực đơn và{" "}
                <strong>{missingSlotCount}</strong> khung giờ chưa tạo.
              </p>
            </div>
          </div>

          <div className="cms-actions">
            <button
              type="button"
              className="cms-btn-add cms-btn-add--secondary"
              aria-haspopup="dialog"
              onClick={() => setIsMenuListOpen(true)}
            >
              <FiLayers aria-hidden="true" />
              <span className="text">Xem danh sách thực đơn</span>
            </button>

            {canAddMenu && missingSlotCount > 0 && (
              <button
                className="cms-btn-add"
                type="button"
                onClick={() => onAddMenu()}
              >
                <FiPlus aria-hidden="true" />
                <span className="text">Tạo thực đơn</span>
              </button>
            )}
          </div>
        </div>

        {menusError && (
          <div className="cms-action-msg cms-action-msg--error" role="alert">
            Không thể tải thực đơn: {menusError.message}
          </div>
        )}
      </section>

      <Modal
        isOpen={isMenuListOpen}
        onClose={() => setIsMenuListOpen(false)}
        title="Danh sách thực đơn"
        size="xl"
      >
        <section className="cms-container" aria-label="Quản lý danh sách thực đơn">
          <div className="cms-header">
            <div className="cms-info">
              <div className="cms-icon-box" aria-hidden="true">
                <FiLayers size={22} />
              </div>
              <div className="cms-title-box">
                <h3>Quản lý thực đơn theo khung giờ</h3>
                <p>
                  Chọn một thực đơn để xem món, hoặc dùng các thao tác bên dưới để
                  chỉnh sửa và quản lý trạng thái hiển thị.
                </p>
              </div>
            </div>

            <div className="cms-actions">
              {canSyncInventory && (
                <button
                  type="button"
                  className="cms-btn-add cms-btn-add--secondary"
                  aria-label="Kiểm tra tồn kho của thực đơn đang chọn"
                  onClick={handleSyncInventory}
                  disabled={!restaurantId || isSyncingInventory}
                  title="Cập nhật trạng thái món theo tồn kho nguyên liệu"
                >
                  <FiRefreshCw aria-hidden="true" />
                  <span className="text">
                    {isSyncingInventory ? "Đang kiểm tra…" : "Kiểm tra tồn kho"}
                  </span>
                </button>
              )}

              {canAddMenu && missingSlotCount > 0 && (
                <button
                  className="cms-btn-add"
                  type="button"
                  onClick={() => closeListAndRun(onAddMenu)}
                >
                  <FiPlus aria-hidden="true" />
                  <span className="text">Tạo thực đơn</span>
                </button>
              )}
            </div>
          </div>

          {menusError && (
            <div className="cms-action-msg cms-action-msg--error" role="alert">
              Không thể tải thực đơn: {menusError.message}
            </div>
          )}
          {actionError && (
            <div className="cms-action-msg cms-action-msg--error" role="alert">
              {actionError}
            </div>
          )}
          {actionMessage && (
            <div
              className="cms-action-msg cms-action-msg--success"
              role="status"
              aria-live="polite"
            >
              {actionMessage}
            </div>
          )}

          {renderSlotGrid()}
        </section>
      </Modal>

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
