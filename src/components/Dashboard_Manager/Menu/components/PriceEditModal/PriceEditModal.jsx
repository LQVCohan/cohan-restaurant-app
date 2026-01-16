import React, { useState, useEffect, useMemo } from "react";
import Modal from "../../../../common/Modal"; // Giữ nguyên đường dẫn của bạn
import {
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiCheck,
  FiTrendingUp,
  FiTrendingDown,
  FiZap,
} from "react-icons/fi";
import "./PriceEditModal.scss";

const PriceEditModal = ({ isOpen, menuItems, onSave, onClose }) => {
  const [priceChanges, setPriceChanges] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  // Bulk state
  const [bulkChange, setBulkChange] = useState({
    type: "percentage", // 'percentage' | 'fixed'
    value: "",
    category: "",
    applyTo: "all",
  });

  // Init data khi mở modal
  useEffect(() => {
    if (isOpen && menuItems) {
      const changes = menuItems.map((item) => ({
        itemId: item.id,
        itemName: item.name,
        category: item.categoryMenu?.name || item.category || "Khác", // Handle nested category obj if needed
        methods: item.methods.map((method) => ({
          name: method.name,
          originalPrice: method.price,
          newPrice: method.price,
          changed: false,
        })),
      }));
      setPriceChanges(changes);
      setSearchTerm("");
      setFilterCategory("all");
      setBulkChange({
        type: "percentage",
        value: "",
        category: "",
        applyTo: "all",
      });
    }
  }, [isOpen, menuItems]);

  // Handle thay đổi giá từng món
  const handlePriceChange = (itemId, methodName, newValue) => {
    setPriceChanges((prev) =>
      prev.map((item) => {
        if (item.itemId !== itemId) return item;

        return {
          ...item,
          methods: item.methods.map((method) => {
            if (method.name !== methodName) return method;

            // Validate input
            const val = newValue === "" ? 0 : parseFloat(newValue);
            return {
              ...method,
              newPrice: val,
              changed: val !== method.originalPrice,
            };
          }),
        };
      })
    );
  };

  // Logic Apply Bulk Change
  const applyBulkChange = () => {
    if (!bulkChange.value) return;

    const changeValue = parseFloat(bulkChange.value);

    setPriceChanges((prev) =>
      prev.map((item) => {
        // Filter logic for bulk
        const shouldApply =
          bulkChange.applyTo === "all" ||
          (bulkChange.applyTo === "category" &&
            item.category === bulkChange.category);

        if (!shouldApply) return item;

        return {
          ...item,
          methods: item.methods.map((method) => {
            let newPrice = method.originalPrice;

            if (bulkChange.type === "percentage") {
              newPrice = method.originalPrice * (1 + changeValue / 100);
            } else {
              newPrice = method.originalPrice + changeValue;
            }

            // Làm tròn đến 1000
            newPrice = Math.max(0, Math.round(newPrice / 1000) * 1000);

            return {
              ...method,
              newPrice,
              changed: newPrice !== method.originalPrice,
            };
          }),
        };
      })
    );
  };

  // Reset về ban đầu
  const resetPrices = () => {
    if (
      !window.confirm("Bạn có chắc chắn muốn đặt lại toàn bộ giá về ban đầu?")
    )
      return;
    setPriceChanges((prev) =>
      prev.map((item) => ({
        ...item,
        methods: item.methods.map((method) => ({
          ...method,
          newPrice: method.originalPrice,
          changed: false,
        })),
      }))
    );
  };

  // Lọc danh sách hiển thị (Search & Filter)
  const filteredItems = useMemo(() => {
    return priceChanges.filter((item) => {
      const matchSearch = item.itemName
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchCat =
        filterCategory === "all" || item.category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [priceChanges, searchTerm, filterCategory]);

  // Lấy danh sách Categories unique
  const categories = useMemo(() => {
    return [...new Set(priceChanges.map((i) => i.category))];
  }, [priceChanges]);

  // Tổng hợp items đã thay đổi
  const getChangedItems = () => {
    return priceChanges.filter((item) => item.methods.some((m) => m.changed));
  };

  const changedCount = getChangedItems().length;

  const handleSave = () => {
    const changedItems = getChangedItems();
    if (changedItems.length === 0) return;

    const updates = changedItems.map((item) => ({
      itemId: item.itemId,
      updates: {
        methods: item.methods.map((method) => {
          // Find original method details safely
          const originalItem = menuItems.find((mi) => mi.id === item.itemId);
          const originalMethod = originalItem?.methods.find(
            (m) => m.name === method.name
          );

          return {
            name: method.name,
            price: method.newPrice,
            cookTime: originalMethod?.cookTime || 0, // Fallback safe
            unit: originalMethod?.unit || "phần",
          };
        }),
      },
    }));
    onSave(updates);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("vi-VN").format(price);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Điều chỉnh giá hàng loạt"
      size="xl"
      className="price-edit-modal"
    >
      <div className="pem-container">
        {/* --- 1. TOOLBAR: Bulk Controls --- */}
        <div className="pem-toolbar">
          <div className="pem-row">
            <div className="pem-control-group" style={{ flex: "0 0 auto" }}>
              <label>Áp dụng cho</label>
              <select
                className="pem-select"
                value={bulkChange.applyTo}
                onChange={(e) =>
                  setBulkChange({ ...bulkChange, applyTo: e.target.value })
                }
              >
                <option value="all">Tất cả món ăn</option>
                <option value="category">Theo danh mục</option>
              </select>
            </div>

            {bulkChange.applyTo === "category" && (
              <div className="pem-control-group">
                <label>Chọn danh mục</label>
                <select
                  className="pem-select"
                  value={bulkChange.category}
                  onChange={(e) =>
                    setBulkChange({ ...bulkChange, category: e.target.value })
                  }
                >
                  <option value="">-- Chọn --</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="pem-control-group">
              <label>Loại điều chỉnh</label>
              <select
                className="pem-select"
                value={bulkChange.type}
                onChange={(e) =>
                  setBulkChange({ ...bulkChange, type: e.target.value })
                }
              >
                <option value="percentage">Tăng/Giảm %</option>
                <option value="fixed">Cộng/Trừ tiền (VNĐ)</option>
              </select>
            </div>

            <div className="pem-control-group">
              <label>
                Giá trị {bulkChange.type === "percentage" ? "(%)" : "(VNĐ)"}
              </label>
              <input
                type="number"
                className="pem-input"
                placeholder={
                  bulkChange.type === "percentage"
                    ? "VD: 10 hoặc -10"
                    : "VD: 5000"
                }
                value={bulkChange.value}
                onChange={(e) =>
                  setBulkChange({ ...bulkChange, value: e.target.value })
                }
              />
            </div>

            <button className="pem-btn-apply" onClick={applyBulkChange}>
              <FiZap /> Áp dụng
            </button>
            <button className="pem-btn-reset" onClick={resetPrices}>
              <FiRefreshCw /> Đặt lại
            </button>
          </div>
        </div>

        {/* --- 2. TABLE WRAPPER --- */}
        <div className="pem-table-wrapper">
          {/* Internal Filters */}
          <div className="pem-search-bar">
            <FiSearch className="search-icon" size={18} />
            <input
              type="text"
              placeholder="Tìm món ăn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div
              style={{
                width: 1,
                height: 20,
                background: "#e2e8f0",
                margin: "0 8px",
              }}
            ></div>
            <FiFilter className="search-icon" size={16} />
            <select
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 13,
                color: "#64748b",
                cursor: "pointer",
              }}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="pem-scroll-area">
            {filteredItems.length === 0 ? (
              <div className="pem-empty">
                Không tìm thấy món ăn nào phù hợp.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Món ăn</th>
                    <th>Quy cách</th>
                    <th>Giá hiện tại</th>
                    <th>Giá mới (VNĐ)</th>
                    <th>Chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <React.Fragment key={item.itemId}>
                      {item.methods.map((method, idx) => (
                        <tr
                          key={`${item.itemId}-${idx}`}
                          className={method.changed ? "is-changed" : ""}
                        >
                          {/* Group Name cell visually */}
                          <td>
                            {idx === 0 && (
                              <div>
                                <div style={{ fontWeight: 600 }}>
                                  {item.itemName}
                                </div>
                                <span className="pem-cate-tag">
                                  {item.category}
                                </span>
                              </div>
                            )}
                          </td>
                          <td>{method.name}</td>
                          <td style={{ color: "#64748b" }}>
                            {formatPrice(method.originalPrice)}
                          </td>
                          <td>
                            <input
                              type="number"
                              className={`pem-input-price ${
                                method.changed ? "changed" : ""
                              }`}
                              value={method.newPrice}
                              step={1000}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                handlePriceChange(
                                  item.itemId,
                                  method.name,
                                  e.target.value
                                )
                              }
                            />
                          </td>
                          <td>
                            {method.changed && (
                              <>
                                {method.newPrice > method.originalPrice ? (
                                  <span className="pem-indicator inc">
                                    <FiTrendingUp />{" "}
                                    {formatPrice(
                                      method.newPrice - method.originalPrice
                                    )}
                                  </span>
                                ) : method.newPrice < method.originalPrice ? (
                                  <span className="pem-indicator dec">
                                    <FiTrendingDown />{" "}
                                    {formatPrice(
                                      method.originalPrice - method.newPrice
                                    )}
                                  </span>
                                ) : null}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* --- 3. FOOTER --- */}
        <div className="pem-footer">
          <div className="pem-stats">
            Đang hiển thị <strong>{filteredItems.length}</strong> món. Đã sửa
            đổi <strong>{changedCount}</strong> món.
          </div>
          <div className="pem-actions">
            <button className="btn-cancel" onClick={onClose}>
              Hủy bỏ
            </button>
            <button
              className="btn-save"
              onClick={handleSave}
              disabled={changedCount === 0}
            >
              <FiCheck style={{ marginRight: 6 }} />
              Lưu {changedCount > 0 ? `(${changedCount})` : ""} thay đổi
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PriceEditModal;
