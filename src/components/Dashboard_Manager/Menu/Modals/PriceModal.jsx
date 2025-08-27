import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  Percent,
  Calendar,
  BarChart3,
  Eye,
  Check,
} from "lucide-react";
import Modal from "../../../common/Modal";
import Button from "../../../common/Button";
import {
  CATEGORIES,
  PRICE_ADJUSTMENT_TYPES,
  PRICE_DIRECTIONS,
} from "../../../../utils/constants";
import { formatPrice, getCategoryText } from "../../../../utils/formatters";
import "./PriceModal.scss";

const PriceModal = ({
  isOpen,
  onClose,
  menuItems,
  onBulkUpdatePrices,
  onShowNotification,
}) => {
  const [activeTab, setActiveTab] = useState("bulk");
  const [bulkSettings, setBulkSettings] = useState({
    category: "",
    adjustmentType: PRICE_ADJUSTMENT_TYPES.PERCENT,
    value: "",
    direction: PRICE_DIRECTIONS.INCREASE,
  });
  const [showPreview, setShowPreview] = useState(false);

  const previewData = useMemo(() => {
    if (!bulkSettings.value || parseFloat(bulkSettings.value) <= 0) {
      return [];
    }

    let itemsToAdjust = menuItems;
    if (bulkSettings.category) {
      itemsToAdjust = menuItems.filter(
        (item) => item.category === bulkSettings.category
      );
    }

    return itemsToAdjust.map((item) => {
      let newPrice;
      const value = parseFloat(bulkSettings.value);

      if (bulkSettings.adjustmentType === PRICE_ADJUSTMENT_TYPES.PERCENT) {
        newPrice =
          bulkSettings.direction === PRICE_DIRECTIONS.INCREASE
            ? item.price * (1 + value / 100)
            : item.price * (1 - value / 100);
      } else {
        newPrice =
          bulkSettings.direction === PRICE_DIRECTIONS.INCREASE
            ? item.price + value
            : item.price - value;
      }

      newPrice = Math.max(0, Math.round(newPrice));
      const change = newPrice - item.price;
      const changePercent = ((change / item.price) * 100).toFixed(1);

      return {
        ...item,
        newPrice,
        change,
        changePercent,
      };
    });
  }, [menuItems, bulkSettings]);

  const handlePreview = () => {
    if (!bulkSettings.value || parseFloat(bulkSettings.value) <= 0) {
      onShowNotification("Vui lòng nhập giá trị điều chỉnh hợp lệ!", "error");
      return;
    }
    setShowPreview(true);
  };

  const handleApplyBulkAdjustment = () => {
    if (previewData.length === 0) {
      onShowNotification("Không có món nào để điều chỉnh!", "error");
      return;
    }

    onBulkUpdatePrices(
      bulkSettings.category,
      bulkSettings.adjustmentType,
      parseFloat(bulkSettings.value),
      bulkSettings.direction
    );

    const actionText =
      bulkSettings.direction === PRICE_DIRECTIONS.INCREASE ? "tăng" : "giảm";
    const valueText =
      bulkSettings.adjustmentType === PRICE_ADJUSTMENT_TYPES.PERCENT
        ? `${bulkSettings.value}%`
        : formatPrice(parseFloat(bulkSettings.value));

    onShowNotification(
      `Đã ${actionText} giá ${previewData.length} món ${valueText}!`,
      "success"
    );

    // Reset form
    setBulkSettings({
      category: "",
      adjustmentType: PRICE_ADJUSTMENT_TYPES.PERCENT,
      value: "",
      direction: PRICE_DIRECTIONS.INCREASE,
    });
    setShowPreview(false);
  };

  const totalRevenue = useMemo(() => {
    return menuItems.reduce((sum, item) => sum + item.price, 0);
  }, [menuItems]);

  const tabs = [
    {
      key: "bulk",
      label: "Điều chỉnh giá hàng loạt",
      icon: TrendingUp,
    },
    {
      key: "discount",
      label: "Chương trình giảm giá",
      icon: Percent,
    },
    {
      key: "event",
      label: "Sự kiện đặc biệt",
      icon: Calendar,
    },
    {
      key: "cost",
      label: "Báo cáo tài chính",
      icon: BarChart3,
    },
  ];

  const renderBulkContent = () => (
    <div className="price-section">
      <h3 className="price-section__title">Điều chỉnh giá hàng loạt</h3>

      <div className="price-form">
        <div className="price-form__row">
          <div className="price-form__group">
            <label className="price-form__label">Chọn danh mục</label>
            <select
              className="price-form__select"
              value={bulkSettings.category}
              onChange={(e) =>
                setBulkSettings((prev) => ({
                  ...prev,
                  category: e.target.value,
                }))
              }
            >
              <option value="">Tất cả danh mục</option>
              {Object.values(CATEGORIES).map((category) => (
                <option key={category.key} value={category.key}>
                  {category.emoji} {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="price-form__group">
            <label className="price-form__label">Loại điều chỉnh</label>
            <select
              className="price-form__select"
              value={bulkSettings.adjustmentType}
              onChange={(e) =>
                setBulkSettings((prev) => ({
                  ...prev,
                  adjustmentType: e.target.value,
                }))
              }
            >
              <option value={PRICE_ADJUSTMENT_TYPES.PERCENT}>
                Theo phần trăm (%)
              </option>
              <option value={PRICE_ADJUSTMENT_TYPES.AMOUNT}>
                Theo số tiền (VNĐ)
              </option>
            </select>
          </div>
        </div>

        <div className="price-form__row">
          <div className="price-form__group">
            <label className="price-form__label">Giá trị điều chỉnh</label>
            <input
              type="number"
              className="price-form__input"
              placeholder="Nhập giá trị..."
              value={bulkSettings.value}
              onChange={(e) =>
                setBulkSettings((prev) => ({ ...prev, value: e.target.value }))
              }
            />
          </div>

          <div className="price-form__group">
            <label className="price-form__label">Hướng điều chỉnh</label>
            <select
              className="price-form__select"
              value={bulkSettings.direction}
              onChange={(e) =>
                setBulkSettings((prev) => ({
                  ...prev,
                  direction: e.target.value,
                }))
              }
            >
              <option value={PRICE_DIRECTIONS.INCREASE}>Tăng giá</option>
              <option value={PRICE_DIRECTIONS.DECREASE}>Giảm giá</option>
            </select>
          </div>
        </div>

        {showPreview && previewData.length > 0 && (
          <div className="bulk-preview">
            <h4 className="bulk-preview__title">Xem trước thay đổi</h4>
            <div className="bulk-preview__list">
              {previewData.slice(0, 10).map((item) => (
                <div key={item.id} className="bulk-preview__item">
                  <div className="bulk-preview__name">{item.name}</div>
                  <div className="bulk-preview__prices">
                    <span className="bulk-preview__old-price">
                      {formatPrice(item.price)}
                    </span>
                    <span className="bulk-preview__new-price">
                      {formatPrice(item.newPrice)}
                    </span>
                    <span
                      className={`bulk-preview__change bulk-preview__change--${bulkSettings.direction}`}
                    >
                      {bulkSettings.direction === PRICE_DIRECTIONS.INCREASE
                        ? "+"
                        : ""}
                      {item.changePercent}%
                    </span>
                  </div>
                </div>
              ))}
              {previewData.length > 10 && (
                <div className="bulk-preview__more">
                  và {previewData.length - 10} món khác...
                </div>
              )}
            </div>
          </div>
        )}

        <div className="price-form__actions">
          <Button variant="secondary" onClick={handlePreview}>
            <Eye size={16} />
            Xem trước
          </Button>
          <Button variant="primary" onClick={handleApplyBulkAdjustment}>
            <Check size={16} />
            Áp dụng thay đổi
          </Button>
        </div>
      </div>
    </div>
  );

  const renderDiscountContent = () => (
    <div className="price-section">
      <h3 className="price-section__title">Chương trình giảm giá</h3>
      <div className="empty-content">
        <p>Chưa có chương trình giảm giá nào</p>
        <Button variant="primary">Tạo chương trình mới</Button>
      </div>
    </div>
  );

  const renderEventContent = () => (
    <div className="price-section">
      <h3 className="price-section__title">Sự kiện đặc biệt & Chi phí</h3>
      <div className="cost-summary">
        <div className="cost-card">
          <div className="cost-card__icon">💰</div>
          <div className="cost-card__info">
            <div className="cost-card__label">Tổng doanh thu dự kiến</div>
            <div className="cost-card__value">{formatPrice(totalRevenue)}</div>
          </div>
        </div>
        <div className="cost-card">
          <div className="cost-card__icon">🎉</div>
          <div className="cost-card__info">
            <div className="cost-card__label">Chi phí sự kiện</div>
            <div className="cost-card__value">0 VNĐ</div>
          </div>
        </div>
        <div className="cost-card">
          <div className="cost-card__icon">📊</div>
          <div className="cost-card__info">
            <div className="cost-card__label">Lợi nhuận ước tính</div>
            <div className="cost-card__value">{formatPrice(totalRevenue)}</div>
          </div>
        </div>
      </div>
      <div className="empty-content">
        <p>Chưa có sự kiện nào được tạo</p>
        <Button variant="primary">Tạo sự kiện mới</Button>
      </div>
    </div>
  );

  const renderCostContent = () => (
    <div className="price-section">
      <h3 className="price-section__title">Báo cáo tài chính</h3>
      <div className="cost-summary">
        <div className="cost-card">
          <div className="cost-card__icon">💰</div>
          <div className="cost-card__info">
            <div className="cost-card__label">Tổng doanh thu menu</div>
            <div className="cost-card__value">{formatPrice(totalRevenue)}</div>
          </div>
        </div>
        <div className="cost-card">
          <div className="cost-card__icon">🎉</div>
          <div className="cost-card__info">
            <div className="cost-card__label">Tổng chi phí sự kiện</div>
            <div className="cost-card__value">0 VNĐ</div>
          </div>
        </div>
        <div className="cost-card">
          <div className="cost-card__icon">📈</div>
          <div className="cost-card__info">
            <div className="cost-card__label">Lợi nhuận thuần</div>
            <div className="cost-card__value">{formatPrice(totalRevenue)}</div>
          </div>
        </div>
      </div>
      <div className="chart-placeholder">
        <BarChart3 size={48} />
        <p>Biểu đồ tài chính sẽ hiển thị ở đây</p>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "bulk":
        return renderBulkContent();
      case "discount":
        return renderDiscountContent();
      case "event":
        return renderEventContent();
      case "cost":
        return renderCostContent();
      default:
        return renderBulkContent();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quản lý giá & Khuyến mãi"
      size="xl"
    >
      <div className="price-modal">
        <div className="price-tabs">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.key}
                className={`price-tab ${
                  activeTab === tab.key ? "price-tab--active" : ""
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                <IconComponent size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="price-content">{renderContent()}</div>
      </div>
    </Modal>
  );
};

export default PriceModal;
