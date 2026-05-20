import React, { useContext, useState } from "react";
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
import "./MenuItemCard.scss";

const STATUS_OPTIONS = [
  { value: "available", label: "Sẵn sàng" },
  { value: "unavailable", label: "Tạm dừng" },
  { value: "out_of_stock", label: "Hết hàng" },
  { value: "hidden", label: "Ẩn khỏi menu" },
];

const getInventoryWarningCta = (item, availability) => {
  const inventoryStatus = String(item?.inventoryStatus || "").toLowerCase();
  const warnings = Array.isArray(item?.stockWarnings) ? item.stockWarnings : [];
  const stockShortages = Array.isArray(item?.stockShortages) ? item.stockShortages : [];
  const warningText = [
    ...warnings,
    ...(availability?.warnings || []),
  ]
    .map((w) => String(w || "").toLowerCase())
    .join(" ");

  const isNotTracked =
    inventoryStatus === "not_tracked" ||
    warningText.includes("tracking recipe") ||
    warningText.includes("chưa tracking") ||
    warningText.includes("recipe");

  if (isNotTracked) {
    return {
      type: "recipe_missing",
      label: "Cập nhật recipe",
      title: "Món chưa có recipe tracking",
      description: "Thêm recipe để hệ thống tự kiểm tra nguyên liệu và tồn kho.",
      action: "recipe",
    };
  }

  if (stockShortages.length > 0) {
    return {
      type: "ingredients_missing",
      label: "Xem nguyên liệu thiếu",
      title: "Thiếu nguyên liệu",
      description: "Một số nguyên liệu không đủ để bán món này.",
      action: "inventory",
    };
  }

  if (inventoryStatus === "out_of_stock") {
    return {
      type: "out_of_stock",
      label: "Kiểm tra tồn kho",
      title: "Món đang hết hàng",
      description: "Kiểm tra recipe hoặc tồn kho nguyên liệu trước khi mở bán lại.",
      action: "inventory",
    };
  }

  if (inventoryStatus === "low_stock") {
    return {
      type: "low_stock",
      label: "Kiểm tra nguyên liệu",
      title: "Nguyên liệu sắp hết",
      description: "Nên kiểm tra tồn kho trước giờ cao điểm.",
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
  updatingStatus = false,
  selected = false,
  onSelectToggle,
}) => {
  const auth = useContext(AuthContext);
  const [imgError, setImgError] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const availability = getMenuItemAvailability(item);

  const canViewHistory = canAccessMenuManagementAction(
    auth?.user,
    MENU_MANAGEMENT_ACTIONS.VIEW,
  );

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
  const variants = Array.isArray(item.servingVariants)
    ? item.servingVariants
    : [];
  const visibleMethods = variants.slice(0, 3);
  const remainingCount = Math.max(0, variants.length - 3);

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
          alt={item.name}
          variant={LOCAL_IMAGE_VARIANTS.THUMB}
          fallback={renderFallbackImage()}
          onError={() => setImgError(true)}
        />
      );
    }
    return renderFallbackImage();
  };

  const renderStatusBadge = () => {
    return (
      <div className={`status-badge ${availability.badgeClassName}`}>
        {availability.label}
      </div>
    );
  };

  const canUpdateItem = canAccessMenuManagementAction(
    auth?.user,
    MENU_MANAGEMENT_ACTIONS.UPDATE_ITEM,
  );

  const canQuickChangeStatus =
    canUpdateItem && typeof onStatusChange === "function";

  const hasActions = onEdit || onDelete || canViewHistory || canQuickChangeStatus;
  const primaryWarning = availability.warnings?.[0];
  const warningCta = canUpdateItem ? getInventoryWarningCta(item, availability) : null;

  const handleWarningCtaClick = (e) => {
    e.stopPropagation();
    if (!warningCta) return;
    if (warningCta.action === "recipe") {
      onOpenRecipeIssue?.(item);
      return;
    }
    onOpenInventoryIssue?.(item);
  };

  return (
    <>
      <div className="menu-item-card" onClick={onEdit || undefined}>
        {typeof onSelectToggle === "function" && (
          <label
            className="card-select-checkbox"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                onSelectToggle(item, e.target.checked);
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
            <span className="category-name">
              {item.categoryName || item.categoryId || "Danh mục món"}
            </span>
            <h3 className="item-name" title={item.name}>
              {item.name}
            </h3>
          </div>

          {primaryWarning && (
            <div className="availability-warning" title={primaryWarning}>
              <AlertTriangle size={14} />
              <span>{primaryWarning}</span>
            </div>
          )}



          {warningCta && (
            <div className="menu-item-card__warning-cta" title={warningCta.title}>
              <div className="menu-item-card__warning-cta-title">{warningCta.title}</div>
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
              <span>Biến thể ({variants.length || 1})</span>
              <span>Giá bán</span>
            </div>

            <div className="list-content">
              {variants.length === 0 ? (
                <div className="variant-row single">
                  <span>Giá cơ bản</span>
                  <span className="price">
                    {formatPrice(item.basePrice || 0)}
                  </span>
                </div>
              ) : (
                visibleMethods.map((m) => (
                  <div key={m.key || m.name} className="variant-row">
                    <span className="v-name">{m.name || m.key}</span>
                    <div className="dotted-line"></div>
                    <span className="v-price">{formatPrice(m.price)}</span>
                  </div>
                ))
              )}

              {remainingCount > 0 && (
                <div className="variant-more">
                  <MoreHorizontal size={14} />
                  <span>Và {remainingCount} biến thể khác...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {hasActions && (
          <div className="card-actions">
            {onEdit && (
              <button
                className="action-btn edit"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
                title="Chỉnh sửa món & biến thể"
              >
                <Edit3 size={16} /> <span>Chỉnh sửa</span>
              </button>
            )}

            {canViewHistory && (
              <>
                {(onEdit || onDelete) && <div className="divider"></div>}
                <button
                  className="action-btn history"
                  onClick={(e) => {
                    e.stopPropagation();
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
                {(onEdit || canViewHistory || onDelete) && <div className="divider"></div>}
                <div
                  className={`status-quick-actions ${updatingStatus ? "disabled" : ""}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {STATUS_OPTIONS.map((option) => {
                    const isCurrent = item?.status === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className="status-action-btn"
                        disabled={updatingStatus || isCurrent}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (updatingStatus || isCurrent) return;
                          onStatusChange(item, option.value);
                        }}
                        title={isCurrent ? `Đang ở trạng thái ${option.label}` : `Chuyển sang ${option.label}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {onDelete && (
              <>
                {(onEdit || canViewHistory) && <div className="divider"></div>}
                <button
                  className="action-btn delete"
                  onClick={(e) => {
                    e.stopPropagation();
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
      </div>

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
