import React, { useContext, useEffect, useRef, useState } from "react";
import { gql, useMutation } from "@apollo/client";
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

const MENU_FIELDS = gql`
  fragment CompactMenuFields on Menu {
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

const MENUS_QUERY = gql`
  query Menus($restaurantId: ID!) {
    menus(restaurantId: $restaurantId) {
      ...CompactMenuFields
    }
  }
  ${MENU_FIELDS}
`;

const COPY_MENU_MUTATION = gql`
  mutation CopyMenu($input: CopyMenuInput!) {
    copyMenu(input: $input) {
      ...CompactMenuFields
    }
  }
  ${MENU_FIELDS}
`;

const DELETE_MENU_MUTATION = gql`
  mutation DeleteMenu($id: ID!, $force: Boolean = false) {
    deleteMenu(id: $id, force: $force)
  }
`;

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

const TIME_SLOT_ORDER = ["breakfast", "lunch", "dinner", "late_night"];
const TIME_SLOT_VALUES = new Set(TIME_SLOT_ORDER);

const getHeaderTimeSlotSelect = () => {
  if (typeof document === "undefined") return null;
  return Array.from(document.querySelectorAll("select.mm-select")).find((select) =>
    Array.from(select.options || []).some((option) => TIME_SLOT_VALUES.has(option.value)),
  );
};

const getSelectedHeaderTimeSlot = () => {
  const select = getHeaderTimeSlotSelect();
  return TIME_SLOT_VALUES.has(select?.value) ? select.value : null;
};

const dispatchSelectChange = (timeSlot) => {
  const select = getHeaderTimeSlotSelect();
  if (!select || !TIME_SLOT_VALUES.has(timeSlot)) return;
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value",
  )?.set;
  if (setter) setter.call(select, timeSlot);
  else select.value = timeSlot;
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

const firstFreeSlot = (menus) => {
  const used = new Set((menus || []).map((menu) => menu.timeSlot));
  return TIME_SLOT_ORDER.find((slot) => !used.has(slot)) || null;
};

const copyName = (source, menus) => {
  const base = `${source?.name || "Menu"} (bản sao)`;
  const names = new Set(
    (menus || []).map((menu) =>
      String(menu?.name || "")
        .trim()
        .toLowerCase(),
    ),
  );
  let name = base;
  let i = 2;
  while (names.has(name.trim().toLowerCase())) {
    name = `${base} ${i}`;
    i += 1;
  }
  return name;
};

const errorText = (error, fallback) =>
  error?.graphQLErrors
    ?.map((entry) => entry?.message)
    .filter(Boolean)
    .join("; ") ||
  error?.message ||
  fallback;

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

  const [copyMenuMutation] = useMutation(COPY_MENU_MUTATION, {
    update(cache, { data }) {
      const copied = data?.copyMenu;
      if (!copied?.restaurantId) return;
      cache.updateQuery(
        { query: MENUS_QUERY, variables: { restaurantId: copied.restaurantId } },
        (prev) => {
          const current = prev?.menus || [];
          return current.some((menu) => menu.id === copied.id)
            ? prev
            : { menus: [...current, copied] };
        },
      );
    },
  });

  const [deleteMenuMutation] = useMutation(DELETE_MENU_MUTATION, {
    update(cache, _result, { variables }) {
      const id = variables?.id;
      const target = menus.find((menu) => String(menu.id) === String(id));
      if (!target?.restaurantId) return;
      cache.updateQuery(
        { query: MENUS_QUERY, variables: { restaurantId: target.restaurantId } },
        (prev) => ({
          menus: (prev?.menus || []).filter(
            (menu) => String(menu.id) !== String(id),
          ),
        }),
      );
      cache.evict({ id: cache.identify({ __typename: "Menu", id }) });
      cache.gc();
    },
  });

  const canAddMenu = typeof onAddMenu === "function";
  const canEditMenu = typeof onEditMenu === "function";
  const canToggleMenuActive = typeof onToggleMenuActive === "function";
  const canCopyMenu = typeof onCopyMenu === "function";
  const canDeleteMenu =
    typeof onDeleteMenu === "function" ||
    canAccessMenuManagementAction(auth?.user, MENU_MANAGEMENT_ACTIONS.DELETE_MENU);
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

  useEffect(() => {
    const select = getHeaderTimeSlotSelect();
    if (!select) return undefined;
    const sync = () => {
      const selected = menus.find((menu) => menu.timeSlot === select.value);
      if (selected) setInternalActiveId(selected.id);
    };
    sync();
    select.addEventListener("change", sync);
    return () => select.removeEventListener("change", sync);
  }, [menus]);

  const selectMenu = (menu) => {
    setInternalActiveId(menu.id);
    if (typeof onSelectMenu === "function") onSelectMenu(menu);
    else dispatchSelectChange(menu.timeSlot);
  };

  const handleCopyMenu = async (menu) => {
    if (!menu?.id || !menu?.restaurantId || busyMenuId) return;
    const targetTimeSlot = firstFreeSlot(menus);
    if (!targetTimeSlot) {
      setActionMessage("");
      setActionError("Không thể sao chép vì nhà hàng này đã có đủ 4 thực đơn theo khung giờ.");
      return;
    }
    setBusyMenuId(menu.id);
    setActionError("");
    setActionMessage("");
    try {
      const { data } = await copyMenuMutation({
        variables: {
          input: {
            restaurantId: menu.restaurantId,
            sourceMenuId: menu.id,
            targetTimeSlot,
            name: copyName(menu, menus),
            description: menu.description || null,
            coverImage: menu.coverImage || null,
            categoryMenuId: menu.categoryMenu?.id || null,
            isActive: false,
            copyItems: true,
            copyRecipes: true,
          },
        },
      });
      if (data?.copyMenu) {
        setInternalActiveId(data.copyMenu.id);
        dispatchSelectChange(data.copyMenu.timeSlot);
      }
    } catch (error) {
      setActionError(errorText(error, "Không thể sao chép thực đơn. Vui lòng thử lại."));
    } finally {
      setBusyMenuId(null);
    }
  };

  const handleSyncInventory = async () => {
    if (!restaurantId || isSyncingInventory || typeof onSyncInventory !== "function") return;
    const timeSlot = getSelectedHeaderTimeSlot() || menus[0]?.timeSlot || "breakfast";

    setIsSyncingInventory(true);
    setActionError("");
    setActionMessage("");

    try {
      const result = await onSyncInventory({ restaurantId, timeSlot });
      if (!result) return;
      const warningText = result?.warnings?.length
        ? ` Có ${result.warnings.length} cảnh báo cần kiểm tra.`
        : "";
      setActionMessage(
        `Đã kiểm tra ${result?.checkedCount || 0} món, cập nhật ${result?.updatedCount || 0} trạng thái.${warningText}`,
      );
    } catch (error) {
      setActionError(errorText(error, "Không thể đồng bộ tồn kho. Vui lòng thử lại."));
    } finally {
      setIsSyncingInventory(false);
    }
  };

  const handleDeleteMenu = async (menu) => {
    if (!menu?.id || busyMenuId) return;
    if (typeof onDeleteMenu === "function") return onDeleteMenu(menu);
    const count = Number(menu.itemCount || 0);
    const force = count > 0;
    const message = force
      ? `Thực đơn "${menu.name || menu.timeSlot}" đang có ${count} món. Xóa sẽ xóa kèm các món và recipe trong thực đơn này. Bạn chắc chắn?`
      : `Bạn chắc chắn muốn xóa thực đơn "${menu.name || menu.timeSlot}"?`;
    if (typeof window !== "undefined" && !window.confirm(message)) return;
    setBusyMenuId(menu.id);
    setActionError("");
    setActionMessage("");
    try {
      await deleteMenuMutation({ variables: { id: menu.id, force } });
      const nextMenu = menus.find((candidate) => candidate.id !== menu.id);
      if (nextMenu) {
        setInternalActiveId(nextMenu.id);
        dispatchSelectChange(nextMenu.timeSlot);
      }
    } catch (error) {
      setActionError(errorText(error, "Không thể xóa thực đơn. Vui lòng thử lại."));
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
              <h3>Quản Lý Thực Đơn</h3>
              {!isCollapsed && (
                <p>
                  Đã tạo <strong>{menus.length}</strong> thực đơn theo khung giờ
                  và nhóm thực đơn
                </p>
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
                    disabled={!menus.length}
                  >
                    <FiChevronLeft />
                  </button>
                  <button
                    className="cms-nav-btn"
                    onClick={() => scroll("right")}
                    disabled={!menus.length}
                  >
                    <FiChevronRight />
                  </button>
                </div>
                {canSyncInventory && (
                  <button
                    className="cms-btn-add"
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
                  <button className="cms-btn-add" onClick={() => onAddMenu()}>
                    <FiPlus /> <span className="text">Tạo thực đơn</span>
                  </button>
                )}
              </>
            )}
            <button
              className="cms-btn-toggle"
              onClick={() => onToggleCollapse?.()}
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
                      onClick={() => selectMenu(menu)}
                    >
                      {active && <div className="cms-indicator" />}
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
                      <div className="cms-toolbar">
                        {canEditMenu && (
                          <>
                            <button
                              className="cms-tool-btn is-edit"
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
                            className={`cms-tool-btn ${menu.isActive === false ? "is-show" : "is-hide"}`}
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
                            className="cms-tool-btn"
                            title="Sao chép thực đơn kèm món và recipe"
                            disabled={!!busyMenuId}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyMenu(menu);
                            }}
                          >
                            <FiCopy />{busy && <span>...</span>}
                          </button>
                        )}
                        {canViewHistory && (
                          <button
                            className="cms-tool-btn is-history"
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
                            className="cms-tool-btn is-delete"
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
                <div className="cms-card cms-ghost" onClick={() => onAddMenu()}>
                  <div className="cms-ghost-inner">
                    <div className="cms-ghost-circle">
                      <FiPlus size={24} />
                    </div>
                    <h4>Thêm thực đơn</h4>
                  </div>
                </div>
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
