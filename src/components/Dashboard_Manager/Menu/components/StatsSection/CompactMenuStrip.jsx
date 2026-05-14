// src/pages/Restaurant/MenuManagement/components/CompactMenuStrip/CompactMenuStrip.jsx
import React, { useContext, useEffect, useRef, useState } from "react";
import { gql, useMutation } from "@apollo/client";
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
  FiEye,
  FiEyeOff,
  FiActivity,
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

const MENU_FIELDS = gql`
  fragment CompactMenuFields on Menu {
    id
    restaurantId
    timeSlot
    name
    description
    coverImage
    isActive
    createdAt
    updatedAt
    itemCount
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

const TIME_SLOT_VALUES = new Set(Object.keys(SLOT_CONFIG));
const TIME_SLOT_ORDER = ["breakfast", "lunch", "dinner", "late_night"];

const getHeaderTimeSlotSelect = () => {
  if (typeof document === "undefined") return null;

  return Array.from(document.querySelectorAll("select.mm-select")).find(
    (select) =>
      Array.from(select.options || []).some((option) =>
        TIME_SLOT_VALUES.has(option.value),
      ),
  );
};

const dispatchNativeSelectChange = (select, value) => {
  if (!select || !TIME_SLOT_VALUES.has(value)) return;

  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value",
  )?.set;

  if (setter) setter.call(select, value);
  else select.value = value;

  select.dispatchEvent(new Event("change", { bubbles: true }));
};

const buildCopyMenuName = (sourceMenu, menus = []) => {
  const baseName = `${sourceMenu?.name || "Menu"} (bản sao)`;
  const existingNames = new Set(
    menus.map((menu) => String(menu?.name || "").trim().toLowerCase()),
  );

  let candidate = baseName;
  let counter = 2;

  while (existingNames.has(candidate.trim().toLowerCase())) {
    candidate = `${baseName} ${counter}`;
    counter += 1;
  }

  return candidate;
};

const getSuggestedCopyTimeSlot = (menus = []) => {
  const usedSlots = new Set(menus.map((menu) => menu.timeSlot));
  return TIME_SLOT_ORDER.find((slot) => !usedSlots.has(slot)) || null;
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
}) => {
  const auth = useContext(AuthContext);
  const scrollRef = useRef(null);
  const [internalActiveId, setInternalActiveId] = useState(null);
  const [historyMenu, setHistoryMenu] = useState(null);
  const [copyError, setCopyError] = useState("");
  const [copyingMenuId, setCopyingMenuId] = useState(null);

  const [copyMenuMutation] = useMutation(COPY_MENU_MUTATION, {
    update(cache, { data }) {
      const copied = data?.copyMenu;
      if (!copied?.restaurantId) return;
      cache.updateQuery(
        { query: MENUS_QUERY, variables: { restaurantId: copied.restaurantId } },
        (prev) => {
          if (!prev?.menus) return { menus: [copied] };
          const exists = prev.menus.some((menu) => menu.id === copied.id);
          return exists ? prev : { menus: [...prev.menus, copied] };
        },
      );
    },
  });

  const currentActiveId =
    activeMenuId !== undefined ? activeMenuId : internalActiveId;
  const canDeleteMenu = typeof onDeleteMenu === "function";
  const canToggleMenuActive = typeof onToggleMenuActive === "function";
  const canAddMenu = typeof onAddMenu === "function";
  const canEditMenu = typeof onEditMenu === "function";
  const canCopyMenu = typeof onCopyMenu === "function";
  const canViewHistory = canAccessMenuManagementAction(
    auth?.user,
    MENU_MANAGEMENT_ACTIONS.VIEW,
  );

  useEffect(() => {
    if (menus.length > 0 && !currentActiveId && !activeMenuId) {
      const firstId = menus[0].id;
      setInternalActiveId(firstId);
      onSelectMenu?.(menus[0]);
    }
  }, [menus, currentActiveId, activeMenuId, onSelectMenu]);

  useEffect(() => {
    const select = getHeaderTimeSlotSelect();
    if (!select) return undefined;

    const syncActiveMenuFromFilter = () => {
      const selectedMenu = menus.find((menu) => menu.timeSlot === select.value);
      if (selectedMenu) setInternalActiveId(selectedMenu.id);
    };

    syncActiveMenuFromFilter();
    select.addEventListener("change", syncActiveMenuFromFilter);
    return () => select.removeEventListener("change", syncActiveMenuFromFilter);
  }, [menus]);

  const handleCardClick = (menu) => {
    setInternalActiveId(menu.id);

    if (typeof onSelectMenu === "function") {
      onSelectMenu(menu);
      return;
    }

    const select = getHeaderTimeSlotSelect();
    dispatchNativeSelectChange(select, menu.timeSlot);
  };

  const handleCopyMenu = async (menu) => {
    if (!menu?.restaurantId || !menu?.id || copyingMenuId) return;

    const targetTimeSlot = getSuggestedCopyTimeSlot(menus);
    if (!targetTimeSlot) {
      setCopyError(
        "Không thể sao chép vì nhà hàng này đã có đủ 4 thực đơn theo khung giờ.",
      );
      return;
    }

    setCopyError("");
    setCopyingMenuId(menu.id);

    try {
      const { data } = await copyMenuMutation({
        variables: {
          input: {
            restaurantId: menu.restaurantId,
            sourceMenuId: menu.id,
            targetTimeSlot,
            name: buildCopyMenuName(menu, menus),
            description: menu.description || null,
            coverImage: menu.coverImage || null,
            categoryMenuId: menu.categoryMenu?.id || null,
            isActive: false,
            copyItems: true,
            copyRecipes: true,
          },
        },
      });

      const copied = data?.copyMenu;
      if (copied?.timeSlot) {
        setInternalActiveId(copied.id);
        const select = getHeaderTimeSlotSelect();
        dispatchNativeSelectChange(select, copied.timeSlot);
      }
    } catch (error) {
      setCopyError(
        error?.message || "Không thể sao chép thực đơn. Vui lòng thử lại.",
      );
    } finally {
      setCopyingMenuId(null);
    }
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
                <>
                  {menusLoading ? (
                    <p>Đang tải danh sách...</p>
                  ) : (
                    <p>
                      Đã tạo <strong>{totalMenus}</strong> thực đơn theo khung giờ
                      và nhóm thực đơn
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
        {!isCollapsed && copyError && (
          <div className="cms-error-msg">Lỗi: {copyError}</div>
        )}

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
                    typeof menu.rating === "number" ? menu.rating : null;
                  const revenue = menu.revenue || null;
                  const categoryName = menu.categoryMenu?.name;
                  const isCopying = copyingMenuId === menu.id;

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
                            <LocalImageView
                              src={menu.coverImage}
                              alt={menu.name}
                              variant={LOCAL_IMAGE_VARIANTS.THUMB}
                              fallback={<div className="cms-placeholder">🍽️</div>}
                            />
                          ) : (
                            <div className="cms-placeholder">🍽️</div>
                          )}
                          {categoryName && (
                            <span className="cms-cate-badge">
                              Nhóm thực đơn: {categoryName}
                            </span>
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
                            <strong>{rating ?? "--"}</strong>
                          </div>
                          <div className="cms-stat-item" title="Doanh thu">
                            <FiTrendingUp className="ic grow" />{" "}
                            <strong>{revenue || "--"}</strong>
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
                            <div className="cms-div"></div>
                          </>
                        )}

                        {canToggleMenuActive && (
                          <button
                            className={`cms-tool-btn ${
                              menu.isActive === false ? "is-show" : "is-hide"
                            }`}
                            title={
                              menu.isActive === false
                                ? "Bật lại thực đơn"
                                : "Ẩn thực đơn"
                            }
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
                            disabled={!!copyingMenuId}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyMenu(menu);
                            }}
                          >
                            <FiCopy />
                            {isCopying && <span>...</span>}
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
                            title="Ẩn thực đơn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteMenu(menu);
                            }}
                          >
                            <FiTrash2 />
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

              <div className="cms-spacer"></div>
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
