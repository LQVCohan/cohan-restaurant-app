import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Activity,
  Edit3,
  Trash2,
  Utensils,
  ImageOff,
  MoreHorizontal,
  AlertTriangle,
} from "lucide-react";
import { AuthContext } from "../../../../../context/AuthContext";
import {
  MENU_MANAGEMENT_ACTIONS,
  canAccessMenuManagementAction,
} from "../../../../../utils/frontendRoleAccess";
import { LOCAL_IMAGE_VARIANTS } from "../../../../../utils/localImageStore";
import { getMenuItemAvailability } from "../../../../../utils/menuItemAvailability";
import LocalImageView from "../../../../common/LocalImageView";
import AuditLogModal from "../AuditLogModal/AuditLogModal";
import PrepStationControl from "./PrepStationControl";
import "./MenuItemCard.scss";

const STATUS_OPTIONS = [
  { value: "available", label: "Sẵn sàng" },
  { value: "unavailable", label: "Tạm dừng" },
  { value: "out_of_stock", label: "Hết món" },
  { value: "hidden", label: "Ẩn khỏi thực đơn" },
];

const getInventoryWarningCta = (item, availability) => {
  const inventoryStatus = String(item?.inventoryStatus || "").toLowerCase();
  const warnings = Array.isArray(item?.stockWarnings) ? item.stockWarnings : [];
  const stockShortages = Array.isArray(item?.stockShortages)
    ? item.stockShortages
    : [];
  const warningText = [...warnings, ...(availability?.warnings || [])]
    .map((warning) => String(warning || "").toLowerCase())
    .join(" ");

  const isNotTracked =
    inventoryStatus === "not_tracked" ||
    warningText.includes("tracking recipe") ||
    warningText.includes("chưa tracking") ||
    warningText.includes("recipe");

  if (isNotTracked) {
    return {
      type: "recipe_missing",
      label: "Thiết lập định lượng",
      title: "Chưa thiết lập định lượng nguyên liệu",
      description:
        "Khai báo nguyên liệu và định lượng để hệ thống tự tính số lượng món còn có thể bán.",
      action: "recipe",
    };
  }

  if (stockShortages.length > 0) {
    return {
      type: "ingredients_missing",
      label: "Xem nguyên liệu thiếu",
      title: "Thiếu nguyên liệu",
      description: "Một số nguyên liệu hiện không đủ để tiếp tục bán món này.",
      action: "inventory",
    };
  }

  if (inventoryStatus === "out_of_stock") {
    return {
      type: "out_of_stock",
      label: "Kiểm tra tồn kho",
      title: "Món đang hết hàng",
      description:
        "Kiểm tra định lượng và tồn kho nguyên liệu trước khi mở bán lại.",
      action: "inventory",
    };
  }

  if (inventoryStatus === "low_stock") {
    return {
      type: "low_stock",
      label: "Kiểm tra nguyên liệu",
      title: "Nguyên liệu sắp hết",
      description: "Nên kiểm tra tồn kho trước khung giờ cao điểm.",
      action: "inventory",
    };
  }

  return null;
};

const MenuItemCard = ({
  item,
  onEdit,
  onDelete,
  onStatusChange,
  onOpenRecipeIssue,
  onOpenInventoryIssue,
  onEditForYou,
  canUpdateItem: canUpdateItemProp,
  updatingStatus = false,
  selected = false,
  onSelectToggle,
}) => {
  const auth = useContext(AuthContext);
  const [imgError, setImgError] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef(null);

  const availability = getMenuItemAvailability(item);

  const canViewHistory = canAccessMenuManagementAction(
    auth?.user,
    MENU_MANAGEMENT_ACTIONS.VIEW_AUDIT,
  );

  useEffect(() => {
    if (!isStatusMenuOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (!statusMenuRef.current?.contains(event.target)) {
        setIsStatusMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isStatusMenuOpen]);

  useEffect(() => {
    if (updatingStatus) setIsStatusMenuOpen(false);
  }, [updatingStatus]);

  const formatPrice = (price) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(Number(price || 0));

  const rawOrderCounter = item?.orderCounter;
  const hasSoldCount =
    rawOrderCounter !== null &&
    rawOrderCounter !== undefined &&
    Number.isFinite(Number(rawOrderCounter));
  const soldCount = hasSoldCount ? Number(rawOrderCounter) : null;
  const forYouMetadata = item?.forYouMetadata;
  const variants = Array.isArray(item.servingVariants)
    ? item.servingVariants
    : [];
  const visibleMethods = variants.slice(0, 3);
  const remainingCount = Math.max(0, variants.length - 3);
  const displayCategoryName = item.categoryName || "Chưa phân loại";
  const baseDisplayPrice = variants[0]?.price ?? item.basePrice ?? 0;
  const quickNote =
    item?.status === "hidden"
      ? "Đang ẩn với khách"
      : item?.status === "out_of_stock"
        ? "Tạm hết món"
        : item?.status === "unavailable"
          ? "Tạm ngưng bán"
          : availability.orderability === "orderable"
            ? "Có thể đặt món"
            : availability.label;

  const renderFallbackImage = () => (
    <div className="placeholder-img">
      {item.status === "out_of_stock" ? (
        <ImageOff size={28} />
      ) : (
        <Utensils size={28} />
      )}
    </div>
  );

  const renderImage = () => {
    if (item.thumbImage && !imgError) {
      return (
        <LocalImageView
          src={item.thumbImage}
          alt={`Ảnh món ${item.name}`}
          variant={LOCAL_IMAGE_VARIANTS.THUMB}
          fallback={renderFallbackImage()}
          onError={() => setImgError(true)}
        />
      );
    }
    return renderFallbackImage();
  };

  const renderStatusBadge = () => (
    <div className={`status-badge ${availability.badgeClassName}`}>
      {item?.status === "available" ? "Sẵn sàng" : availability.label}
    </div>
  );

  const canUpdateItem =
    typeof canUpdateItemProp === "boolean"
      ? canUpdateItemProp
      : canAccessMenuManagementAction(
          auth?.user,
          MENU_MANAGEMENT_ACTIONS.UPDATE_ITEM,
        );

  const canQuickChangeStatus =
    canUpdateItem && typeof onStatusChange === "function";
  const hasActions =
    onEdit || onDelete || canViewHistory || canQuickChangeStatus;
  const primaryWarning = availability.warnings?.[0];
  const warningCta = canUpdateItem
    ? getInventoryWarningCta(item, availability)
    : null;

  const handleWarningCtaClick = (event) => {
    event.stopPropagation();
    if (!warningCta) return;
    if (warningCta.action === "recipe") {
      onOpenRecipeIssue?.(item);
      return;
    }
    onOpenInventoryIssue?.(item);
  };

  return (
    <>
      <article
        className={`menu-item-card ${selected ? "is-selected" : ""}`.trim()}
      >
        {typeof onSelectToggle === "function" && (
          <label
            className="card-select-checkbox"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              aria-label={`Chọn món ${item?.name || ""} để thao tác hàng loạt`}
              onChange={(event) => {
                event.stopPropagation();
                onSelectToggle(item, event.target.checked);
              }}
            />
          </label>
        )}

        <div className="card-image-wrapper">
          {renderImage()}
          <div className="badge-wrapper">{renderStatusBadge()}</div>
          {hasSoldCount && (
            <div className="sales-overlay">
              <div className="sales-stat">
                <div className="stat-info">
                  <span className="label">Đã bán</span>
                  <span className="value">{soldCount} phần</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card-body">
          <div className="info-top">
            <span className="category-name">{displayCategoryName}</span>
            <h3 className="item-name" title={item.name}>
              {item.name}
            </h3>
            <div className="menu-item-card__meta-row">
              <strong className="menu-item-card__price">
                {formatPrice(baseDisplayPrice)}
              </strong>
              <span
                className={`menu-item-card__quick-note menu-item-card__quick-note--${item?.status || "available"}`}
              >
                {quickNote}
              </span>
            </div>
          </div>

          <PrepStationControl item={item} canUpdate={canUpdateItem} />

          {forYouMetadata?.status &&
            (forYouMetadata.status === "missing" && canUpdateItem ? (
              <button
                type="button"
                className={`menu-item-card__for-you-badge menu-item-card__for-you-badge--${forYouMetadata.status} menu-item-card__for-you-badge--actionable`}
                title="Bổ sung thông tin khẩu vị và thành phần dị ứng"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditForYou?.(item);
                }}
              >
                Thiếu thông tin tư vấn
              </button>
            ) : (
              <span
                className={`menu-item-card__for-you-badge menu-item-card__for-you-badge--${forYouMetadata.status}`}
                title={forYouMetadata.label}
              >
                {forYouMetadata.status === "ready"
                  ? "Đã đủ thông tin tư vấn"
                  : "Thiếu thông tin tư vấn"}
              </span>
            ))}

          {primaryWarning && (
            <div className="availability-warning" title={primaryWarning}>
              <AlertTriangle size={14} />
              <span>{primaryWarning}</span>
            </div>
          )}

          {warningCta && (
            <div
              className="menu-item-card__warning-cta"
              title={warningCta.title}
            >
              <div className="menu-item-card__warning-cta-title">
                {warningCta.title}
              </div>
              <div className="menu-item-card__warning-cta-description">
                {warningCta.description}
              </div>
              <button
                type="button"
                className="menu-item-card__warning-cta-button"
                onClick={handleWarningCtaClick}
              >
                {warningCta.label}
              </button>
            </div>
          )}

          <div className="variants-list">
            <div className="list-header">
              <span>Cách chế biến ({variants.length || 1})</span>
              <span>Giá bán</span>
            </div>

            <div className="list-content">
              {variants.length === 0 ? (
                <div className="variant-row single">
                  <span>Cách chế biến mặc định</span>
                  <span className="price">
                    {formatPrice(item.basePrice || 0)}
                  </span>
                </div>
              ) : (
                visibleMethods.map((method) => (
                  <div key={method.key || method.name} className="variant-row">
                    <span className="v-name">
                      {method.name || method.key}
                    </span>
                    <div className="dotted-line" />
                    <span className="v-price">
                      {formatPrice(method.price)}
                    </span>
                  </div>
                ))
              )}

              {remainingCount > 0 && (
                <div className="variant-more">
                  <MoreHorizontal size={14} />
                  <span>Còn {remainingCount} cách chế biến khác</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {hasActions && (
          <div className="card-actions">
            {onEdit && (
              <button
                type="button"
                className="action-btn edit"
                aria-label="Chỉnh sửa món ăn"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit?.();
                }}
                title="Chỉnh sửa thông tin và cách chế biến"
              >
                <Edit3 size={16} /> <span>Chỉnh sửa</span>
              </button>
            )}

            {canViewHistory && (
              <>
                {(onEdit || onDelete) && <div className="divider" />}
                <button
                  type="button"
                  className="action-btn history"
                  aria-label="Xem lịch sử thay đổi của món"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsHistoryOpen(true);
                  }}
                  title="Xem lịch sử thay đổi"
                >
                  <Activity size={16} /> <span>Lịch sử</span>
                </button>
              </>
            )}

            {canQuickChangeStatus && (
              <>
                {(onEdit || canViewHistory || onDelete) && (
                  <div className="divider" />
                )}
                <div
                  className="status-dropdown"
                  ref={statusMenuRef}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="action-btn status-trigger"
                    disabled={updatingStatus}
                    aria-label="Mở menu trạng thái món"
                    aria-haspopup="menu"
                    aria-expanded={isStatusMenuOpen}
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsStatusMenuOpen((current) => !current);
                    }}
                    title="Cập nhật trạng thái bán"
                  >
                    <MoreHorizontal size={16} /> <span>Trạng thái</span>
                  </button>

                  {isStatusMenuOpen && (
                    <div className="status-dropdown-menu" role="menu">
                      {STATUS_OPTIONS.map((option) => {
                        const isCurrent = item?.status === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className="status-dropdown-option"
                            disabled={updatingStatus || isCurrent}
                            role="menuitem"
                            aria-disabled={updatingStatus || isCurrent}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (updatingStatus || isCurrent) return;
                              onStatusChange(item, option.value);
                              setIsStatusMenuOpen(false);
                            }}
                            title={
                              isCurrent
                                ? `Trạng thái hiện tại: ${option.label}`
                                : `Chuyển sang trạng thái: ${option.label}`
                            }
                          >
                            <span>{option.label}</span>
                            {isCurrent && (
                              <span className="status-check">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {onDelete && (
              <>
                {(onEdit || canViewHistory) && <div className="divider" />}
                <button
                  type="button"
                  className="action-btn delete"
                  aria-label="Xóa món ăn"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete?.();
                  }}
                  title="Xóa món ăn"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        )}
      </article>

      <AuditLogModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        restaurantId={item?.restaurantId}
        entity="MenuItem"
        entityId={item?.id || item?._id}
        title={`Lịch sử món: ${item?.name || "Món ăn"}`}
      />
    </>
  );
};

export default MenuItemCard;
