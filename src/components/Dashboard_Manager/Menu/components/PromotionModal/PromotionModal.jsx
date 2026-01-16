import React, { useState, useEffect } from "react";
import Modal from "../../../../common/Modal"; // Giữ nguyên đường dẫn Import Modal của bạn
import {
  FiTag,
  FiAlignLeft,
  FiDollarSign,
  FiCalendar,
  FiLayers,
  FiCheck,
  FiX,
  FiGift,
  FiShoppingBag,
} from "react-icons/fi";
import "./PromotionModal.scss";

const PromotionModal = ({ isOpen, onSave, onClose, menuItems = [] }) => {
  // --- STATE ---
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "percentage", // 'percentage', 'fixed', 'buy_get'
    value: "",
    buyQuantity: "1",
    getQuantity: "1",
    minOrder: "",
    maxDiscount: "",
    scope: "all", // 'all', 'category', 'item'
    scopeId: "",
    startDate: "",
    endDate: "",
    isActive: true,
  });

  const [errors, setErrors] = useState({});

  // Reset form khi mở modal
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: "",
        description: "",
        type: "percentage",
        value: "",
        buyQuantity: "1",
        getQuantity: "1",
        minOrder: "",
        maxDiscount: "",
        scope: "all",
        scopeId: "",
        startDate: "",
        endDate: "",
        isActive: true,
      });
      setErrors({});
    }
  }, [isOpen]);

  // Lấy danh sách Categories unique
  const categories = [...new Set(menuItems.map((item) => item.category))];

  // --- HANDLERS ---
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim())
      newErrors.name = "Vui lòng nhập tên chương trình";

    if (formData.type === "buy_get") {
      if (!formData.buyQuantity || formData.buyQuantity < 1)
        newErrors.buyQuantity = "Nhập SL mua";
      if (!formData.getQuantity || formData.getQuantity < 1)
        newErrors.getQuantity = "Nhập SL tặng";
    } else {
      if (!formData.value) newErrors.value = "Vui lòng nhập giá trị giảm";
    }

    if (!formData.startDate) newErrors.startDate = "Chọn ngày bắt đầu";
    if (!formData.endDate) newErrors.endDate = "Chọn ngày kết thúc";
    if (
      formData.startDate &&
      formData.endDate &&
      formData.startDate >= formData.endDate
    ) {
      newErrors.endDate = "Ngày kết thúc không hợp lệ";
    }

    if (
      (formData.scope === "category" || formData.scope === "item") &&
      !formData.scopeId
    ) {
      newErrors.scopeId = "Vui lòng chọn đối tượng áp dụng";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const submission = {
      ...formData,
      value: formData.type === "buy_get" ? 0 : parseFloat(formData.value),
      buyQuantity:
        formData.type === "buy_get" ? parseInt(formData.buyQuantity) : null,
      getQuantity:
        formData.type === "buy_get" ? parseInt(formData.getQuantity) : null,
      minOrder: formData.minOrder ? parseFloat(formData.minOrder) : 0,
      maxDiscount: formData.maxDiscount
        ? parseFloat(formData.maxDiscount)
        : null,
    };

    onSave(submission);
  };

  // --- FORMAT HELPER ---
  const formatMoney = (val) => {
    if (!val) return "0";
    return new Intl.NumberFormat("vi-VN").format(val);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "...";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getPreviewValue = () => {
    if (formData.type === "percentage")
      return (
        <div className="ticket-value">
          {formData.value || 0}
          <span>%</span>
        </div>
      );
    if (formData.type === "fixed")
      return (
        <div className="ticket-value">
          {formatMoney(formData.value || 0)}
          <span>đ</span>
        </div>
      );
    if (formData.type === "buy_get")
      return (
        <div className="ticket-value">
          <div className="buy-get-text">
            MUA {formData.buyQuantity || "X"} <br /> TẶNG{" "}
            {formData.getQuantity || "Y"}
          </div>
        </div>
      );
    return null;
  };

  const getPreviewSub = () => {
    if (formData.type === "percentage") return "Giảm giá trực tiếp";
    if (formData.type === "fixed") return "Trừ tiền mặt";
    if (formData.type === "buy_get") return "Quà tặng sản phẩm";
    return "";
  };

  // Render Scope Text
  const getScopeText = () => {
    if (formData.scope === "all") return "Toàn bộ thực đơn";
    if (formData.scope === "category")
      return `Danh mục: ${formData.scopeId || "..."}`;

    const item = menuItems.find(
      (i) => i.id.toString() === formData.scopeId.toString()
    );
    return item ? `Món: ${item.name}` : "Món ăn cụ thể";
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tạo chương trình khuyến mãi"
      size="xl"
      className="promotion-modal"
    >
      <div className="pm-container">
        {/* HEADER */}
        <div className="pm-header">
          <h3>
            <FiGift /> Tạo khuyến mãi mới
          </h3>
          <button className="close-btn" onClick={onClose} title="Đóng">
            <FiX />
          </button>
        </div>

        {/* BODY */}
        <div className="pm-body">
          {/* LEFT: FORM INPUTS */}
          <div className="pm-form-scroll">
            {/* 1. Basic Info */}
            <div className="pm-section">
              <div className="pm-section-title">
                <FiTag /> Thông tin cơ bản
              </div>

              <div className="pm-group">
                <label>
                  Tên khuyến mãi <span className="req">*</span>
                </label>
                <div className="pm-input-wrapper">
                  <FiAlignLeft className="pm-icon" />
                  <input
                    className={`pm-input has-icon ${
                      errors.name ? "error" : ""
                    }`}
                    placeholder="Ví dụ: Giờ vàng, Mua 1 Tặng 1..."
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                  />
                </div>
                {errors.name && (
                  <span className="pm-error-msg">{errors.name}</span>
                )}
              </div>

              <div className="pm-group">
                <label>Mô tả ngắn</label>
                <textarea
                  className="pm-textarea"
                  placeholder="Mô tả chi tiết chương trình (tuỳ chọn)..."
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                />
              </div>
            </div>

            {/* 2. Value & Conditions */}
            <div className="pm-section">
              <div className="pm-section-title">
                <FiDollarSign /> Giá trị & Điều kiện
              </div>

              <div className="pm-group">
                <label>Loại khuyến mãi</label>
                <div className="pm-input-wrapper">
                  <select
                    className="pm-select"
                    value={formData.type}
                    onChange={(e) => handleInputChange("type", e.target.value)}
                  >
                    <option value="percentage">Giảm theo phần trăm (%)</option>
                    <option value="fixed">Giảm số tiền cố định (VNĐ)</option>
                    <option value="buy_get">Mua X tặng Y</option>
                  </select>
                </div>
              </div>

              <div className="pm-grid-2">
                {formData.type === "buy_get" ? (
                  <>
                    <div className="pm-group">
                      <label>
                        Số lượng mua <span className="req">*</span>
                      </label>
                      <div className="pm-input-wrapper">
                        <FiShoppingBag className="pm-icon" />
                        <input
                          type="number"
                          className={`pm-input has-icon ${
                            errors.buyQuantity ? "error" : ""
                          }`}
                          value={formData.buyQuantity}
                          onChange={(e) =>
                            handleInputChange("buyQuantity", e.target.value)
                          }
                        />
                        <span className="pm-suffix">món</span>
                      </div>
                      {errors.buyQuantity && (
                        <span className="pm-error-msg">
                          {errors.buyQuantity}
                        </span>
                      )}
                    </div>
                    <div className="pm-group">
                      <label>
                        Số lượng tặng <span className="req">*</span>
                      </label>
                      <div className="pm-input-wrapper">
                        <FiGift className="pm-icon" />
                        <input
                          type="number"
                          className={`pm-input has-icon ${
                            errors.getQuantity ? "error" : ""
                          }`}
                          value={formData.getQuantity}
                          onChange={(e) =>
                            handleInputChange("getQuantity", e.target.value)
                          }
                        />
                        <span className="pm-suffix">món</span>
                      </div>
                      {errors.getQuantity && (
                        <span className="pm-error-msg">
                          {errors.getQuantity}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="pm-group">
                    <label>
                      Giá trị giảm <span className="req">*</span>
                    </label>
                    <div className="pm-input-wrapper">
                      <FiDollarSign className="pm-icon" />
                      <input
                        type="number"
                        className={`pm-input has-icon ${
                          errors.value ? "error" : ""
                        }`}
                        value={formData.value}
                        onChange={(e) =>
                          handleInputChange("value", e.target.value)
                        }
                        placeholder="0"
                      />
                      <span className="pm-suffix">
                        {formData.type === "percentage" ? "%" : "đ"}
                      </span>
                    </div>
                    {errors.value && (
                      <span className="pm-error-msg">{errors.value}</span>
                    )}
                  </div>
                )}

                <div className="pm-group">
                  <label>Đơn tối thiểu</label>
                  <div className="pm-input-wrapper">
                    <FiDollarSign className="pm-icon" />
                    <input
                      type="number"
                      className="pm-input has-icon"
                      value={formData.minOrder}
                      onChange={(e) =>
                        handleInputChange("minOrder", e.target.value)
                      }
                      placeholder="0"
                    />
                    <span className="pm-suffix">đ</span>
                  </div>
                </div>
              </div>

              {formData.type === "percentage" && (
                <div className="pm-group">
                  <label>Giảm tối đa (VNĐ)</label>
                  <div className="pm-input-wrapper">
                    <FiDollarSign className="pm-icon" />
                    <input
                      type="number"
                      className="pm-input has-icon"
                      value={formData.maxDiscount}
                      onChange={(e) =>
                        handleInputChange("maxDiscount", e.target.value)
                      }
                      placeholder="Không giới hạn"
                    />
                    <span className="pm-suffix">đ</span>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Scope & Time */}
            <div className="pm-section">
              <div className="pm-section-title">
                <FiLayers /> Phạm vi & Thời gian
              </div>

              <div className="pm-group">
                <label>Phạm vi áp dụng</label>
                <div className="pm-input-wrapper">
                  <select
                    className="pm-select"
                    value={formData.scope}
                    onChange={(e) => handleInputChange("scope", e.target.value)}
                  >
                    <option value="all">Toàn bộ menu</option>
                    <option value="category">Theo danh mục</option>
                    <option value="item">Món ăn cụ thể</option>
                  </select>
                </div>
              </div>

              {formData.scope === "category" && (
                <div className="pm-group">
                  <label>
                    Chọn danh mục <span className="req">*</span>
                  </label>
                  <div className="pm-input-wrapper">
                    <select
                      className={`pm-select ${errors.scopeId ? "error" : ""}`}
                      value={formData.scopeId}
                      onChange={(e) =>
                        handleInputChange("scopeId", e.target.value)
                      }
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.scopeId && (
                    <span className="pm-error-msg">{errors.scopeId}</span>
                  )}
                </div>
              )}

              {formData.scope === "item" && (
                <div className="pm-group">
                  <label>
                    Chọn món ăn <span className="req">*</span>
                  </label>
                  <div className="pm-input-wrapper">
                    <select
                      className={`pm-select ${errors.scopeId ? "error" : ""}`}
                      value={formData.scopeId}
                      onChange={(e) =>
                        handleInputChange("scopeId", e.target.value)
                      }
                    >
                      <option value="">-- Chọn món --</option>
                      {menuItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.scopeId && (
                    <span className="pm-error-msg">{errors.scopeId}</span>
                  )}
                </div>
              )}

              <div className="pm-grid-2" style={{ marginTop: 16 }}>
                <div className="pm-group">
                  <label>
                    Bắt đầu <span className="req">*</span>
                  </label>
                  <div className="pm-input-wrapper">
                    <input
                      type="datetime-local"
                      className={`pm-input ${errors.startDate ? "error" : ""}`}
                      value={formData.startDate}
                      onChange={(e) =>
                        handleInputChange("startDate", e.target.value)
                      }
                    />
                  </div>
                  {errors.startDate && (
                    <span className="pm-error-msg">{errors.startDate}</span>
                  )}
                </div>
                <div className="pm-group">
                  <label>
                    Kết thúc <span className="req">*</span>
                  </label>
                  <div className="pm-input-wrapper">
                    <input
                      type="datetime-local"
                      className={`pm-input ${errors.endDate ? "error" : ""}`}
                      value={formData.endDate}
                      onChange={(e) =>
                        handleInputChange("endDate", e.target.value)
                      }
                    />
                  </div>
                  {errors.endDate && (
                    <span className="pm-error-msg">{errors.endDate}</span>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Active Toggle */}
            <div className="pm-section">
              <label className="pm-toggle">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    handleInputChange("isActive", e.target.checked)
                  }
                />
                <div className="slider"></div>
                <div className="label-text">
                  Kích hoạt chương trình ngay lập tức
                </div>
              </label>
            </div>
          </div>

          {/* RIGHT: PREVIEW SIDEBAR */}
          <div className="pm-preview-sidebar">
            <div className="preview-label">XEM TRƯỚC VOUCHER</div>

            <div className="ticket-card">
              <div className="ticket-header">
                <span className="ticket-type">VOUCHER</span>
                {getPreviewValue()}
                <div className="ticket-sub">{getPreviewSub()}</div>
              </div>

              <div className="ticket-body">
                <div className="dashed-line"></div>
                <div className="ticket-name">
                  {formData.name || "Tên chương trình"}
                </div>
                <div className="ticket-desc">
                  {formData.description ||
                    "Mô tả ngắn gọn về điều kiện áp dụng của mã giảm giá này..."}
                </div>

                <div className="info-row">
                  <span className="lbl">Áp dụng:</span>
                  <span className="val">{getScopeText()}</span>
                </div>

                {formData.minOrder && (
                  <div className="info-row">
                    <span className="lbl">Đơn tối thiểu:</span>
                    <span className="val">
                      {formatMoney(formData.minOrder)}đ
                    </span>
                  </div>
                )}

                <div className="info-row">
                  <span className="lbl">Hạn dùng:</span>
                  <span className="val">
                    {formData.endDate ? formatDate(formData.endDate) : "..."}
                  </span>
                </div>
              </div>

              <div className="ticket-footer">
                <span
                  className={`status-badge ${
                    formData.isActive ? "active" : "inactive"
                  }`}
                >
                  {formData.isActive ? "Đang hoạt động" : "Tạm dừng"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="pm-footer-actions">
          <button className="btn btn--secondary" onClick={onClose}>
            Hủy bỏ
          </button>
          <button className="btn btn--primary" onClick={handleSubmit}>
            <FiCheck /> Hoàn tất
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PromotionModal;
