import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useApolloClient, useMutation } from "@apollo/client";
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
  FiX,
} from "react-icons/fi";
import { AuthContext } from "../../../../../context/AuthContext";
import {
  MENU_MANAGEMENT_ACTIONS,
  canAccessMenuManagementAction,
} from "../../../../../utils/frontendRoleAccess";
import { LOCAL_IMAGE_VARIANTS } from "../../../../../utils/localImageStore";
import {
  getManagerMenuSelection,
  setManagerMenuSelection,
} from "../../../../../utils/managerMenuSelection";
import LocalImageView from "../../../../common/LocalImageView";
import Modal from "../../../../common/Modal";
import AuditLogModal from "../AuditLogModal/AuditLogModal";
import "./CompactMenuStrip.scss";
import "./CompactMenuStripPolish.scss";
import "./CompactMenuStripMultiMenu.scss";

const SLOT_ORDER = ["breakfast", "lunch", "dinner", "late_night"];
const SLOT_CONFIG = {
  breakfast: { label: "Bữa sáng", description: "Thực đơn phục vụ đầu ngày" },
  lunch: { label: "Bữa trưa", description: "Thực đơn phục vụ buổi trưa" },
  dinner: { label: "Bữa tối", description: "Thực đơn phục vụ buổi tối" },
  late_night: { label: "Bữa khuya", description: "Thực đơn phục vụ khung giờ khuya" },
};

const MENU_FIELDS = gql`
  fragment CompactMultiMenuFields on Menu {
    id
    restaurantId
    timeSlot
    name
    description
    coverImage
    isActive
    itemCount
    revenue
    orderCount
    soldItemCount
    rating
    categoryMenu {
      id
      name
      description
      isActive
    }
  }
`;

const ENSURE_MENU = gql`
  mutation EnsureMenu($input: EnsureMenuInput!) {
    ensureMenu(input: $input) {
      ...CompactMultiMenuFields
    }
  }
  ${MENU_FIELDS}
`;

const COPY_MENU = gql`
  mutation CopyMenu($input: CopyMenuInput!) {
    copyMenu(input: $input) {
      ...CompactMultiMenuFields
    }
  }
  ${MENU_FIELDS}
`;

const DELETE_MENU = gql`
  mutation DeleteMenu($id: ID!, $force: Boolean = false) {
    deleteMenu(id: $id, force: $force)
  }
`;

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

const createDraft = (timeSlot = "breakfast") => ({
  mode: "create",
  id: null,
  sourceMenuId: null,
  name: "",
  description: "",
  timeSlot,
  coverImage: "",
  categoryMenuId: null,
  isActive: true,
});

const CompactMenuStrip = ({
  menus = [],
  menusLoading = false,
  menusError = null,
  onAddMenu,
  onEditMenu,
  onDeleteMenu,
  onToggleMenuActive,
  onCopyMenu,
  selectedTimeSlot,
  onTimeSlotChange,
  onSelectMenu,
  onSyncInventory,
}) => {
  const auth = useContext(AuthContext);
  const client = useApolloClient();
  const [ensureMenu] = useMutation(ENSURE_MENU);
  const [copyMenu] = useMutation(COPY_MENU);
  const [deleteMenu] = useMutation(DELETE_MENU);
  const [selectedMenuId, setSelectedMenuId] = useState(null);
  const [historyMenu, setHistoryMenu] = useState(null);
  const [editor, setEditor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyMenuId, setBusyMenuId] = useState(null);
  const [isMenuListOpen, setIsMenuListOpen] = useState(false);
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

  const restaurantId =
    menus.find((menu) => menu?.restaurantId)?.restaurantId ||
    auth?.activeRestaurantId ||
    auth?.activeRestaurant?.id ||
    null;

  const menusBySlot = useMemo(
    () =>
      new Map(
        SLOT_ORDER.map((slot) => [
          slot,
          menus.filter((menu) => menu?.timeSlot === slot),
        ]),
      ),
    [menus],
  );
  const missingSlotCount = SLOT_ORDER.filter(
    (slot) => !(menusBySlot.get(slot) || []).length,
  ).length;
  const selectedMenu = useMemo(
    () =>
      menus.find((menu) => String(menu?.id) === String(selectedMenuId)) || null,
    [menus, selectedMenuId],
  );

  const selectMenu = (menu) => {
    if (!menu?.id) return;
    setSelectedMenuId(menu.id);
    setManagerMenuSelection({
      restaurantId: menu.restaurantId,
      menuId: menu.id,
      timeSlot: menu.timeSlot,
    });
    onSelectMenu?.(menu);
    onTimeSlotChange?.(menu.timeSlot);
    setActionError("");
  };

  useEffect(() => {
    if (!menus.length) {
      setSelectedMenuId(null);
      setManagerMenuSelection(null);
      return;
    }

    const stored = getManagerMenuSelection();
    const storedMenu = menus.find(
      (menu) =>
        String(menu.id) === String(stored?.menuId) &&
        String(menu.restaurantId) === String(stored?.restaurantId) &&
        (!selectedTimeSlot || menu.timeSlot === selectedTimeSlot),
    );
    const nextMenu =
      storedMenu ||
      menus.find((menu) => menu.timeSlot === selectedTimeSlot) ||
      menus[0];

    if (String(nextMenu?.id) === String(selectedMenuId)) return;
    selectMenu(nextMenu);
    // Selection is intentionally synchronized after menu/time-slot changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menus, selectedTimeSlot]);

  const refreshMenusAndItems = async () => {
    await client.refetchQueries({
      include: ["Menus", "MenuItemsConnection"],
    });
  };

  const openCreate = (timeSlot = selectedTimeSlot || "breakfast") => {
    if (!restaurantId) {
      onAddMenu?.();
      return;
    }
    setEditor(createDraft(timeSlot));
    setActionError("");
    setActionMessage("");
    setIsMenuListOpen(true);
  };

  const openEdit = (menu) => {
    setEditor({
      mode: "edit",
      id: menu.id,
      sourceMenuId: null,
      name: menu.name || "",
      description: menu.description || "",
      timeSlot: menu.timeSlot,
      coverImage: menu.coverImage || "",
      categoryMenuId: menu.categoryMenu?.id || null,
      isActive: menu.isActive !== false,
    });
    setActionError("");
  };

  const openCopy = (menu) => {
    setEditor({
      mode: "copy",
      id: null,
      sourceMenuId: menu.id,
      name: `${menu.name || "Menu"} (bản sao)`,
      description: menu.description || "",
      timeSlot: menu.timeSlot,
      coverImage: menu.coverImage || "",
      categoryMenuId: menu.categoryMenu?.id || null,
      isActive: false,
    });
    setActionError("");
  };

  const handleSaveEditor = async (event) => {
    event.preventDefault();
    if (!editor || !restaurantId || busyMenuId) return;
    const name = editor.name.trim();
    if (!name) {
      setActionError("Vui lòng nhập tên thực đơn.");
      return;
    }

    setBusyMenuId(editor.id || editor.sourceMenuId || "new");
    setActionError("");
    try {
      const result =
        editor.mode === "copy"
          ? await copyMenu({
              variables: {
                input: {
                  restaurantId,
                  sourceMenuId: editor.sourceMenuId,
                  targetTimeSlot: editor.timeSlot,
                  name,
                  description: editor.description || null,
                  coverImage: editor.coverImage || null,
                  categoryMenuId: editor.categoryMenuId || null,
                  isActive: editor.isActive,
                  copyItems: true,
                  copyRecipes: true,
                },
              },
            }).then(({ data }) => data?.copyMenu)
          : await ensureMenu({
              variables: {
                input: {
                  id: editor.mode === "edit" ? editor.id : null,
                  restaurantId,
                  timeSlot: editor.timeSlot,
                  name,
                  description: editor.description || null,
                  coverImage: editor.coverImage || null,
                  categoryMenuId: editor.categoryMenuId || null,
                  isActive: editor.isActive,
                },
              },
            }).then(({ data }) => data?.ensureMenu);

      setEditor(null);
      setActionMessage(
        editor.mode === "copy"
          ? "Đã sao chép thực đơn, món và công thức."
          : editor.mode === "edit"
            ? "Đã cập nhật đúng thực đơn được chọn."
            : "Đã tạo thêm thực đơn trong khung giờ.",
      );
      await refreshMenusAndItems();
      if (result?.id) selectMenu(result);
    } catch (error) {
      setActionError(error?.message || "Không thể lưu thực đơn.");
    } finally {
      setBusyMenuId(null);
    }
  };

  const handleToggleMenu = async (menu) => {
    if (!menu?.id || busyMenuId || !canToggleMenuActive) return;
    setBusyMenuId(menu.id);
    setActionError("");
    try {
      await ensureMenu({
        variables: {
          input: {
            id: menu.id,
            restaurantId: menu.restaurantId,
            timeSlot: menu.timeSlot,
            name: menu.name,
            description: menu.description || null,
            coverImage: menu.coverImage || null,
            categoryMenuId: menu.categoryMenu?.id || null,
            isActive: menu.isActive === false,
          },
        },
      });
      await refreshMenusAndItems();
    } catch (error) {
      setActionError(error?.message || "Không thể cập nhật trạng thái thực đơn.");
    } finally {
      setBusyMenuId(null);
    }
  };

  const handleDeleteMenu = async () => {
    if (!deleteTarget?.id || busyMenuId) return;
    setBusyMenuId(deleteTarget.id);
    setActionError("");
    try {
      await deleteMenu({
        variables: {
          id: deleteTarget.id,
          force: Number(deleteTarget.itemCount || 0) > 0,
        },
      });
      setDeleteTarget(null);
      setActionMessage("Đã xóa thực đơn đã chọn.");
      await refreshMenusAndItems();
    } catch (error) {
      setActionError(error?.message || "Không thể xóa thực đơn.");
    } finally {
      setBusyMenuId(null);
    }
  };

  const handleSyncInventory = async () => {
    const menu = menus.find((entry) => String(entry.id) === String(selectedMenuId));
    if (!menu || isSyncingInventory || !canSyncInventory) return;
    setIsSyncingInventory(true);
    setActionError("");
    try {
      const result = await onSyncInventory({
        restaurantId: menu.restaurantId,
        timeSlot: menu.timeSlot,
      });
      if (result) {
        setActionMessage(
          `Đã kiểm tra ${result.checkedCount || 0} món của ${menu.name}.`,
        );
      }
    } catch (error) {
      setActionError(error?.message || "Không thể kiểm tra tồn kho.");
    } finally {
      setIsSyncingInventory(false);
    }
  };

  const renderMenuCard = (menu, slot) => {
    const active = String(menu.id) === String(selectedMenuId);
    const busy = String(menu.id) === String(busyMenuId);
    return (
      <article
        key={menu.id}
        className={`cms-card ${active ? "cms-active" : ""} ${
          menu.isActive === false ? "cms-disabled" : ""
        }`}
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
                  fallback={<div className="cms-placeholder">Thực đơn</div>}
                />
              ) : (
                <div className="cms-placeholder">Thực đơn</div>
              )}
              {menu.categoryMenu?.name && (
                <span className="cms-cate-badge">Bộ: {menu.categoryMenu.name}</span>
              )}
            </div>
            <div className="cms-badges">
              <span
                className={`cms-slot-tag cms-slot-tag--${menu.timeSlot.replace(
                  /_/g,
                  "-",
                )}`}
              >
                <FiClock aria-hidden="true" />
                {slot.label}
              </span>
              <span
                className={`cms-visibility-status ${
                  menu.isActive === false ? "is-hidden" : "is-visible"
                }`}
              >
                {menu.isActive === false ? "Đang ẩn với khách" : "Đang hiển thị"}
              </span>
            </div>
          </div>
          <div className="cms-card-body">
            <h3 title={menu.name}>{menu.name}</h3>
            <p className="cms-desc">{menu.description || "Chưa có mô tả"}</p>
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
              <div className="cms-stat-item" title={`${menu.orderCount || 0} đơn`}>
                <FiTrendingUp className="ic grow" aria-hidden="true" />
                <strong>{formatCompactRevenue(menu.revenue)}</strong>
              </div>
            </div>
          </div>
        </button>
        <div className="cms-toolbar" aria-label={`Thao tác ${menu.name}`}>
          {canEditMenu && (
            <button type="button" className="cms-tool-btn is-edit" onClick={() => openEdit(menu)}>
              <FiEdit3 aria-hidden="true" /><span>Sửa</span>
            </button>
          )}
          {canToggleMenuActive && (
            <button
              type="button"
              className={`cms-tool-btn ${menu.isActive === false ? "is-show" : "is-hide"}`}
              disabled={busy}
              onClick={() => handleToggleMenu(menu)}
            >
              {menu.isActive === false ? <FiEye /> : <FiEyeOff />}
              <span>{menu.isActive === false ? "Hiện" : "Ẩn"}</span>
            </button>
          )}
          {canCopyMenu && (
            <button type="button" className="cms-tool-btn" onClick={() => openCopy(menu)}>
              <FiCopy aria-hidden="true" /><span>Sao chép</span>
            </button>
          )}
          {canViewHistory && (
            <button type="button" className="cms-tool-btn is-history" onClick={() => setHistoryMenu(menu)}>
              <FiActivity aria-hidden="true" /><span>Lịch sử</span>
            </button>
          )}
          {canDeleteMenu && (
            <button type="button" className="cms-tool-btn is-delete" onClick={() => setDeleteTarget(menu)}>
              <FiTrash2 aria-hidden="true" /><span>Xóa</span>
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <>
      <section className="cms-container cms-container--multi" aria-labelledby="cms-title">
        <div className="cms-header">
          <div className="cms-info">
            <div className="cms-icon-box" aria-hidden="true"><FiLayers size={22} /></div>
            <div className="cms-title-box">
              <h3 id="cms-title">Danh sách thực đơn</h3>
              <p>
                {selectedMenu ? (
                  <>
                    Đang quản lý <strong>{selectedMenu.name}</strong> · {SLOT_CONFIG[selectedMenu.timeSlot]?.label}
                  </>
                ) : (
                  <><strong>{menus.length}</strong> thực đơn trong 4 mốc giờ</>
                )}
              </p>
            </div>
          </div>
          <div className="cms-actions">
            <button type="button" className="cms-btn-add cms-btn-add--secondary" onClick={() => setIsMenuListOpen(true)}>
              <FiLayers aria-hidden="true" /><span className="text">Quản lý danh sách</span>
            </button>
            {canAddMenu && (
              <button type="button" className="cms-btn-add" onClick={() => openCreate()}>
                <FiPlus aria-hidden="true" /><span className="text">Tạo thực đơn</span>
              </button>
            )}
          </div>
        </div>
        {menusError && <div className="cms-action-msg cms-action-msg--error">Không thể tải thực đơn: {menusError.message}</div>}
      </section>

      <Modal isOpen={isMenuListOpen} onClose={() => setIsMenuListOpen(false)} title="Quản lý thực đơn theo khung giờ" size="xl">
        <section className="cms-container cms-container--multi cms-container--dialog">
          <div className="cms-multi-summary">
            <div><strong>{menus.length}</strong><span>thực đơn</span></div>
            <div><strong>{missingSlotCount}</strong><span>mốc giờ chưa có menu</span></div>
            <div className="cms-multi-summary__actions">
              {canSyncInventory && (
                <button type="button" className="cms-btn-add cms-btn-add--secondary" onClick={handleSyncInventory} disabled={!selectedMenuId || isSyncingInventory}>
                  <FiRefreshCw aria-hidden="true" />{isSyncingInventory ? "Đang kiểm tra…" : "Kiểm tra menu chọn"}
                </button>
              )}
              {canAddMenu && (
                <button type="button" className="cms-btn-add" onClick={() => openCreate()}>
                  <FiPlus aria-hidden="true" />Tạo thực đơn
                </button>
              )}
            </div>
          </div>

          {actionError && <div className="cms-action-msg cms-action-msg--error" role="alert">{actionError}</div>}
          {actionMessage && <div className="cms-action-msg cms-action-msg--success" role="status">{actionMessage}</div>}

          {editor && (
            <form className="cms-menu-editor" onSubmit={handleSaveEditor}>
              <div className="cms-menu-editor__heading">
                <div>
                  <strong>{editor.mode === "copy" ? "Sao chép thực đơn" : editor.mode === "edit" ? "Chỉnh sửa thực đơn" : "Tạo thực đơn mới"}</strong>
                  <span>Menu được gắn với một trong bốn mốc giờ, không giới hạn số menu trong cùng mốc.</span>
                </div>
                <button type="button" onClick={() => setEditor(null)} aria-label="Đóng biểu mẫu"><FiX /></button>
              </div>
              <label><span>Tên thực đơn</span><input value={editor.name} onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))} required /></label>
              <label><span>Mốc giờ phục vụ</span><select value={editor.timeSlot} onChange={(event) => setEditor((current) => ({ ...current, timeSlot: event.target.value }))}>{SLOT_ORDER.map((slot) => <option value={slot} key={slot}>{SLOT_CONFIG[slot].label}</option>)}</select></label>
              <label className="cms-menu-editor__description"><span>Mô tả</span><textarea rows={3} value={editor.description} onChange={(event) => setEditor((current) => ({ ...current, description: event.target.value }))} /></label>
              <label className="cms-menu-editor__check"><input type="checkbox" checked={editor.isActive} onChange={(event) => setEditor((current) => ({ ...current, isActive: event.target.checked }))} /><span>Hiển thị với khách hàng</span></label>
              <div className="cms-menu-editor__actions"><button type="button" onClick={() => setEditor(null)}>Hủy</button><button type="submit" disabled={!!busyMenuId}>{busyMenuId ? "Đang lưu…" : "Lưu thực đơn"}</button></div>
            </form>
          )}

          {deleteTarget && (
            <div className="cms-delete-confirm" role="alertdialog" aria-label="Xác nhận xóa thực đơn">
              <div><strong>Xóa “{deleteTarget.name}”?</strong><span>{Number(deleteTarget.itemCount || 0) > 0 ? `Thực đơn có ${deleteTarget.itemCount} món và sẽ được xóa cùng dữ liệu liên quan.` : "Thực đơn chưa có món."}</span></div>
              <button type="button" onClick={() => setDeleteTarget(null)}>Hủy</button>
              <button type="button" className="is-danger" onClick={handleDeleteMenu} disabled={!!busyMenuId}>Xác nhận xóa</button>
            </div>
          )}

          <div className="cms-slot-groups" aria-label="Bốn mốc giờ thực đơn">
            {SLOT_ORDER.map((timeSlot) => {
              const slot = SLOT_CONFIG[timeSlot];
              const slotMenus = menusBySlot.get(timeSlot) || [];
              return (
                <section className="cms-slot-group" key={timeSlot}>
                  <header><div><FiClock aria-hidden="true" /><div><h4>{slot.label}</h4><p>{slot.description}</p></div></div><span>{slotMenus.length} menu</span></header>
                  <div className="cms-slot-group__cards">
                    {menusLoading && !menus.length ? <article className="cms-card cms-card--loading"><span className="cms-skeleton cms-skeleton--title" /></article> : slotMenus.map((menu) => renderMenuCard(menu, slot))}
                    {!menusLoading && slotMenus.length === 0 && (
                      <button type="button" className="cms-empty-menu-card" onClick={() => openCreate(timeSlot)} disabled={!canAddMenu}>
                        <FiPlus aria-hidden="true" /><strong>Chưa có thực đơn</strong><span>Tạo menu đầu tiên cho {slot.label.toLowerCase()}</span>
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
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
