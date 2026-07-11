import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Users,
  MapPin,
  Wallet,
  UtensilsCrossed,
  XCircle,
  BadgePercent,
} from "lucide-react";
import { useCart } from "../../../../context/CartProvider";
import { useCustomerPromotionPreview } from "../../../../hooks/useDiscountPreview";
import { mapCartItemToOrderItemInput } from "../../../../utils/discountPreviewPayload";
import "./BookingSummary.scss";

const BookingSummary = ({
  selectedTable,
  onConfirm,
  onCancel,
  selectedFloorName,
  menuDeposit = 0,
  menuItemsCount = 0,
  onOrderDishes,
}) => {
  const { id: restaurantId } = useParams();
  const { cart = [] } = useCart();
  const [menuPricing, setMenuPricing] = useState(null);
  const [pricingError, setPricingError] = useState("");
  const {
    previewCustomerPromotion,
    loading: pricingLoading,
  } = useCustomerPromotionPreview();

  const restaurantCartItems = useMemo(
    () =>
      (cart || []).filter(
        (item) => String(item.restaurantId) === String(restaurantId),
      ),
    [cart, restaurantId],
  );
  const previewItems = useMemo(
    () =>
      restaurantCartItems.map((item) =>
        mapCartItemToOrderItemInput(item, { includeCartHoldRef: true }),
      ),
    [restaurantCartItems],
  );

  useEffect(() => {
    if (!selectedTable || !restaurantId || !previewItems.length) {
      setMenuPricing(null);
      setPricingError("");
      return undefined;
    }

    let active = true;
    setPricingError("");
    previewCustomerPromotion({
      restaurantId,
      orderType: "dine_in",
      items: previewItems,
      pricing: {
        taxRate: 0,
        serviceRate: 0,
        shippingFee: 0,
      },
      promotionIds: [],
    })
      .then((breakdown) => {
        if (active) setMenuPricing(breakdown);
      })
      .catch((error) => {
        if (!active) return;
        setMenuPricing(null);
        setPricingError(
          error?.message || "Giá ưu đãi sẽ được xác nhận khi tạo đặt bàn.",
        );
      });

    return () => {
      active = false;
    };
  }, [
    previewCustomerPromotion,
    previewItems,
    restaurantId,
    selectedTable,
  ]);

  const formatPrice = (price) => {
    if (!price || price === 0) return "Miễn phí";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const fallbackSubtotal = Math.max(0, Number(menuDeposit || 0) * 2);
  const pricedSubtotal = Number(menuPricing?.subtotal ?? fallbackSubtotal);
  const promotionDiscount = Math.max(
    0,
    Number(menuPricing?.promotionDiscount || 0),
  );
  const payableMenuTotal = Math.max(
    0,
    Number(
      menuPricing?.grandTotal ??
        menuPricing?.finalTotal ??
        pricedSubtotal - promotionDiscount,
    ),
  );
  const promotionAdjustedDeposit = Math.round(payableMenuTotal * 0.5);

  return (
    <div className="bsm-card">
      <div className="bsm-header">
        <h3 className="bsm-title">Thông tin đặt bàn</h3>
        <span className="bsm-subtitle">Bàn và chi phí dự kiến</span>
      </div>

      <div className="bsm-body">
        {selectedTable ? (
          <>
            <div className="bsm-selected-visual">
              <div className="bsm-table-icon">
                <span className="label">{selectedTable.label}</span>
              </div>
              <div className="bsm-text-info">
                <span className="floor-badge">
                  {selectedFloorName || "Khu vực chung"}
                </span>
                <span className="status-text">Đang được chọn</span>
              </div>
            </div>

            <div className="bsm-info-list">
              <div className="bsm-info-item">
                <div className="icon-wrapper">
                  <Users size={18} />
                </div>
                <div className="details">
                  <span className="label">Sức chứa</span>
                  <span className="value">{selectedTable.capacity} khách</span>
                </div>
              </div>

              <div className="bsm-info-item">
                <div className="icon-wrapper">
                  <MapPin size={18} />
                </div>
                <div className="details">
                  <span className="label">Vị trí</span>
                  <span className="value">
                    {selectedFloorName || "Tầng trệt"}
                  </span>
                </div>
              </div>

              <div className="bsm-divider"></div>

              <div className="bsm-info-item total">
                <div className="icon-wrapper">
                  <Wallet size={18} />
                </div>
                <div className="details">
                  <span className="label">Đặt cọc bàn</span>
                  <span className="value highlight">
                    {formatPrice(
                      selectedTable.deposit ??
                        selectedTable.depositAmount ??
                        selectedTable.price,
                    )}
                  </span>
                </div>
              </div>

              {menuItemsCount > 0 ? (
                <>
                  <div className="bsm-info-item">
                    <div className="icon-wrapper">
                      <UtensilsCrossed size={18} />
                    </div>
                    <div className="details">
                      <span className="label">Tạm tính món</span>
                      <span className="value">
                        {formatPrice(pricedSubtotal)}
                      </span>
                    </div>
                  </div>

                  {promotionDiscount > 0 ? (
                    <div className="bsm-info-item">
                      <div className="icon-wrapper">
                        <BadgePercent size={18} />
                      </div>
                      <div className="details">
                        <span className="label">Khuyến mãi món</span>
                        <span className="value">
                          -{formatPrice(promotionDiscount)}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="bsm-info-item">
                    <div className="details">
                      <span className="label">Tổng món sau ưu đãi</span>
                      <span className="value">
                        {pricingLoading
                          ? "Đang xác nhận..."
                          : formatPrice(payableMenuTotal)}
                      </span>
                    </div>
                  </div>
                </>
              ) : null}

              <div className="bsm-info-item total">
                <div className="icon-wrapper">
                  <UtensilsCrossed size={18} />
                </div>
                <div className="details">
                  <span className="label">Cọc món 50% sau ưu đãi</span>
                  <span className="value highlight">
                    {menuItemsCount > 0
                      ? pricingLoading
                        ? "Đang tính..."
                        : formatPrice(promotionAdjustedDeposit)
                      : "Chưa có món"}
                  </span>
                </div>
              </div>

              {pricingError ? (
                <div className="bsm-info-item">
                  <div className="details">
                    <span className="label">Xác nhận giá</span>
                    <span className="value">
                      Máy chủ sẽ tính lại ưu đãi khi tạo đặt bàn.
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="bsm-info-item">
                <div className="details">
                  <span className="label">Món đã chọn</span>
                  <span className="value">
                    {menuItemsCount} món trong giỏ
                  </span>
                </div>
                {onOrderDishes && (
                  <button
                    type="button"
                    className="bsm-btn bsm-btn-secondary"
                    onClick={onOrderDishes}
                  >
                    Chọn món đi kèm
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="bsm-empty-state">
            <div className="bsm-empty-icon">
              <UtensilsCrossed size={48} strokeWidth={1.6} />
            </div>
            <p className="bsm-empty-text">Vui lòng chọn bàn trên sơ đồ</p>
            <span className="bsm-empty-subtext">
              Bấm vào bàn màu xanh để tiếp tục đặt bàn
            </span>
          </div>
        )}
      </div>

      <div className="bsm-footer">
        <button
          className="bsm-btn bsm-btn-confirm"
          disabled={!selectedTable || (menuItemsCount > 0 && pricingLoading)}
          onClick={onConfirm}
        >
          {pricingLoading && menuItemsCount > 0
            ? "Đang xác nhận ưu đãi..."
            : "Xác nhận đặt bàn"}
        </button>

        {selectedTable && (
          <button className="bsm-btn bsm-btn-cancel" onClick={onCancel}>
            <span>Hủy chọn</span>
            <XCircle size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default BookingSummary;
