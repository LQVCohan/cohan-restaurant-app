import React, { useState, useEffect } from "react";
import Modal from "../../../../common/Modal";
import "./PriceEditModal.scss";

const PriceEditModal = ({ isOpen, menuItems, onSave, onClose }) => {
  const [priceChanges, setPriceChanges] = useState([]);
  const [bulkChange, setBulkChange] = useState({
    type: "percentage", // 'percentage' or 'fixed'
    value: "",
    category: "",
    applyTo: "all", // 'all' or 'category'
  });

  useEffect(() => {
    if (isOpen && menuItems) {
      // Initialize price changes array
      const changes = menuItems.map((item) => ({
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        methods: item.methods.map((method) => ({
          name: method.name,
          originalPrice: method.price,
          newPrice: method.price,
          changed: false,
        })),
      }));
      setPriceChanges(changes);
    }
  }, [isOpen, menuItems]);

  const handlePriceChange = (itemIndex, methodIndex, newPrice) => {
    setPriceChanges((prev) => {
      const updated = [...prev];
      const originalPrice =
        updated[itemIndex].methods[methodIndex].originalPrice;
      updated[itemIndex].methods[methodIndex].newPrice =
        parseFloat(newPrice) || 0;
      updated[itemIndex].methods[methodIndex].changed =
        parseFloat(newPrice) !== originalPrice;
      return updated;
    });
  };

  const applyBulkChange = () => {
    if (!bulkChange.value) {
      alert("Vui lòng nhập giá trị thay đổi");
      return;
    }

    const changeValue = parseFloat(bulkChange.value);

    setPriceChanges((prev) => {
      return prev.map((item) => {
        // Check if should apply to this item
        const shouldApply =
          bulkChange.applyTo === "all" ||
          (bulkChange.applyTo === "category" &&
            item.category === bulkChange.category);

        if (!shouldApply) return item;

        return {
          ...item,
          methods: item.methods.map((method) => {
            let newPrice;

            if (bulkChange.type === "percentage") {
              newPrice = method.originalPrice * (1 + changeValue / 100);
            } else {
              newPrice = method.originalPrice + changeValue;
            }

            newPrice = Math.max(0, Math.round(newPrice / 1000) * 1000); // Round to nearest 1000

            return {
              ...method,
              newPrice,
              changed: newPrice !== method.originalPrice,
            };
          }),
        };
      });
    });
  };

  const resetPrices = () => {
    setPriceChanges((prev) => {
      return prev.map((item) => ({
        ...item,
        methods: item.methods.map((method) => ({
          ...method,
          newPrice: method.originalPrice,
          changed: false,
        })),
      }));
    });
  };

  const getChangedItems = () => {
    return priceChanges.filter((item) =>
      item.methods.some((method) => method.changed)
    );
  };

  const handleSave = () => {
    const changedItems = getChangedItems();

    if (changedItems.length === 0) {
      alert("Không có thay đổi nào để lưu");
      return;
    }

    const updates = changedItems.map((item) => ({
      itemId: item.itemId,
      updates: {
        methods: item.methods.map((method) => ({
          name: method.name,
          price: method.newPrice,
          cookTime: menuItems
            .find((mi) => mi.id === item.itemId)
            .methods.find((m) => m.name === method.name).cookTime,
          unit: menuItems
            .find((mi) => mi.id === item.itemId)
            .methods.find((m) => m.name === method.name).unit,
        })),
      },
    }));

    onSave(updates);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const categories = [
    ...new Set(menuItems?.map((item) => item.category) || []),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chỉnh sửa giá hàng loạt"
      size="xl"
      className="price-edit-modal"
    >
      <div className="price-edit-content">
        {/* Bulk Change Section */}
        <div className="bulk-change-section">
          <h4 className="section-title">💰 Thay đổi giá hàng loạt</h4>

          <div className="bulk-controls">
            <div className="bulk-control-group">
              <label className="form-label">Áp dụng cho:</label>
              <select
                className="form-select"
                value={bulkChange.applyTo}
                onChange={(e) =>
                  setBulkChange((prev) => ({
                    ...prev,
                    applyTo: e.target.value,
                  }))
                }
              >
                <option value="all">Tất cả món ăn</option>
                <option value="category">Theo danh mục</option>
              </select>
            </div>

            {bulkChange.applyTo === "category" && (
              <div className="bulk-control-group">
                <label className="form-label">Danh mục:</label>
                <select
                  className="form-select"
                  value={bulkChange.category}
                  onChange={(e) =>
                    setBulkChange((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="bulk-control-group">
              <label className="form-label">Loại thay đổi:</label>
              <select
                className="form-select"
                value={bulkChange.type}
                onChange={(e) =>
                  setBulkChange((prev) => ({ ...prev, type: e.target.value }))
                }
              >
                <option value="percentage">Phần trăm (%)</option>
                <option value="fixed">Số tiền cố định (VNĐ)</option>
              </select>
            </div>

            <div className="bulk-control-group">
              <label className="form-label">
                Giá trị {bulkChange.type === "percentage" ? "(%)" : "(VNĐ)"}:
              </label>
              <input
                type="number"
                className="form-input"
                value={bulkChange.value}
                onChange={(e) =>
                  setBulkChange((prev) => ({ ...prev, value: e.target.value }))
                }
                placeholder={
                  bulkChange.type === "percentage"
                    ? "Ví dụ: 10 (tăng 10%)"
                    : "Ví dụ: 5000"
                }
              />
            </div>

            <div className="bulk-actions">
              <button className="btn btn--primary" onClick={applyBulkChange}>
                Áp dụng thay đổi
              </button>
              <button className="btn btn--secondary" onClick={resetPrices}>
                Đặt lại tất cả
              </button>
            </div>
          </div>
        </div>

        {/* Price List Section */}
        <div className="price-list-section">
          <div className="section-header">
            <h4 className="section-title">📋 Danh sách giá</h4>
            <div className="summary">
              <span className="summary-text">
                {getChangedItems().length} món có thay đổi
              </span>
            </div>
          </div>

          <div className="price-table">
            <div className="price-table-header">
              <div className="col-name">Món ăn</div>
              <div className="col-category">Danh mục</div>
              <div className="col-method">Cách chế biến</div>
              <div className="col-original">Giá gốc</div>
              <div className="col-new">Giá mới</div>
              <div className="col-change">Thay đổi</div>
            </div>

            <div className="price-table-body">
              {priceChanges.map((item, itemIndex) => (
                <div key={item.itemId} className="price-item">
                  {item.methods.map((method, methodIndex) => (
                    <div
                      key={`${item.itemId}-${methodIndex}`}
                      className={`price-row ${
                        method.changed ? "price-row--changed" : ""
                      }`}
                    >
                      <div className="col-name">
                        {methodIndex === 0 && (
                          <span className="item-name">{item.itemName}</span>
                        )}
                      </div>
                      <div className="col-category">
                        {methodIndex === 0 && (
                          <span className="item-category">{item.category}</span>
                        )}
                      </div>
                      <div className="col-method">{method.name}</div>
                      <div className="col-original">
                        {formatPrice(method.originalPrice)}
                      </div>
                      <div className="col-new">
                        <input
                          type="number"
                          className="price-input"
                          value={method.newPrice}
                          onChange={(e) =>
                            handlePriceChange(
                              itemIndex,
                              methodIndex,
                              e.target.value
                            )
                          }
                          step="1000"
                        />
                      </div>
                      <div className="col-change">
                        {method.changed && (
                          <span
                            className={`change-indicator ${
                              method.newPrice > method.originalPrice
                                ? "change-indicator--increase"
                                : "change-indicator--decrease"
                            }`}
                          >
                            {method.newPrice > method.originalPrice
                              ? "↗️"
                              : "↘️"}
                            {formatPrice(
                              Math.abs(method.newPrice - method.originalPrice)
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn btn--secondary" onClick={onClose}>
            Hủy
          </button>
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={getChangedItems().length === 0}
          >
            Lưu thay đổi ({getChangedItems().length})
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PriceEditModal;
