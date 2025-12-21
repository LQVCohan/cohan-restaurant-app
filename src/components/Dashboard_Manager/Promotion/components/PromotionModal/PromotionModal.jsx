import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  FileText,
  Tag,
  Clock,
  Percent,
  DollarSign,
  Users,
  Store,
} from "lucide-react";
import { RESTAURANTS, PROMOTION_TYPES } from "../../../../../utils/constants";
import "./PromotionModal.scss";

const PromotionModal = ({ promotion, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    type: "",
    discountValue: "",
    minOrderValue: "",
    maxDiscount: "",
    startDate: "",
    endDate: "",
    usageLimit: "",
    targetAudience: "all",
    restaurantId: "",
    description: "",
    conditions: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (promotion) {
      setFormData({
        name: promotion.name || "",
        code: promotion.code || "",
        type: promotion.type || "",
        discountValue: promotion.discountValue || "",
        minOrderValue: promotion.minOrderValue || "",
        maxDiscount: promotion.maxDiscount || "",
        startDate: promotion.startDate || "",
        endDate: promotion.endDate || "",
        usageLimit: promotion.usageLimit || "",
        targetAudience: promotion.targetAudience || "all",
        restaurantId: promotion.restaurantId || "",
        description: promotion.description || "",
        conditions: promotion.conditions ? promotion.conditions.join("\n") : "",
      });
    }
  }, [promotion]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Bắt buộc nhập";
    if (!formData.code.trim()) newErrors.code = "Bắt buộc nhập";
    if (!formData.type) newErrors.type = "Chọn loại";
    if (!formData.discountValue) newErrors.discountValue = "Nhập giá trị";
    if (!formData.startDate) newErrors.startDate = "Chọn ngày";
    if (!formData.endDate) newErrors.endDate = "Chọn ngày";
    if (!formData.restaurantId) newErrors.restaurantId = "Chọn nhà hàng";
    if (
      formData.startDate &&
      formData.endDate &&
      formData.startDate >= formData.endDate
    ) {
      newErrors.endDate = "Ngày kết thúc không hợp lệ";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Logic xử lý dữ liệu (giữ nguyên logic cũ)
    const formattedData = {
      ...formData,
      discountValue: parseFloat(formData.discountValue),
      minOrderValue: formData.minOrderValue
        ? parseFloat(formData.minOrderValue)
        : null,
      maxDiscount: formData.maxDiscount
        ? parseFloat(formData.maxDiscount)
        : null,
      usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
      conditions: formData.conditions.split("\n").filter((c) => c.trim()),
      status: "active",
    };
    onSave(formattedData);
  };

  return (
    <div
      className="premium-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="premium-modal">
        {/* --- HEADER --- */}
        <div className="modal-header">
          <div className="header-content">
            <h2>{promotion ? "Chỉnh sửa ưu đãi" : "Tạo ưu đãi mới"}</h2>
            <p>Điền thông tin chi tiết để thiết lập chương trình khuyến mãi.</p>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* --- BODY (Scrollable) --- */}
        <div className="modal-body">
          <form id="promoForm" onSubmit={handleSubmit}>
            {/* SECTION 1: CƠ BẢN */}
            <div className="form-section">
              <h3 className="section-title">
                <FileText size={18} /> Thông tin chung
              </h3>
              <div className="grid-2">
                <div className="form-group full">
                  <label>
                    Tên chương trình <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="VD: Mừng khai trương cơ sở 2"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={errors.name ? "error" : ""}
                  />
                  {errors.name && (
                    <span className="err-msg">{errors.name}</span>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    Mã Code <span className="req">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <Tag size={16} className="input-icon" />
                    <input
                      type="text"
                      name="code"
                      placeholder="VD: SUMMER2024"
                      className={`code-input ${errors.code ? "error" : ""}`}
                      value={formData.code}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Nhà hàng áp dụng <span className="req">*</span>
                  </label>
                  <select
                    name="restaurantId"
                    value={formData.restaurantId}
                    onChange={handleInputChange}
                    className={errors.restaurantId ? "error" : ""}
                  >
                    <option value="">-- Chọn chi nhánh --</option>
                    {Object.entries(RESTAURANTS).map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 2: GIÁ TRỊ & ĐIỀU KIỆN */}
            <div className="form-section">
              <h3 className="section-title">
                <Percent size={18} /> Giá trị ưu đãi
              </h3>
              <div className="grid-3">
                <div className="form-group">
                  <label>
                    Loại giảm giá <span className="req">*</span>
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                  >
                    <option value="">-- Loại --</option>
                    {Object.entries(PROMOTION_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Mức giảm <span className="req">*</span>
                  </label>
                  <input
                    type="number"
                    name="discountValue"
                    placeholder="0"
                    value={formData.discountValue}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Giảm tối đa</label>
                  <input
                    type="number"
                    name="maxDiscount"
                    placeholder="Không giới hạn"
                    value={formData.maxDiscount}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="grid-2 mt-3">
                <div className="form-group">
                  <label>Đơn tối thiểu</label>
                  <div className="input-icon-wrapper">
                    <DollarSign size={16} className="input-icon" />
                    <input
                      type="number"
                      name="minOrderValue"
                      placeholder="0"
                      value={formData.minOrderValue}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Giới hạn lượt dùng</label>
                  <input
                    type="number"
                    name="usageLimit"
                    placeholder="Tổng lượt dùng tối đa"
                    value={formData.usageLimit}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: THỜI GIAN & ĐỐI TƯỢNG */}
            <div className="form-section">
              <h3 className="section-title">
                <Clock size={18} /> Thời gian & Đối tượng
              </h3>
              <div className="grid-2">
                <div className="form-group">
                  <label>
                    Bắt đầu <span className="req">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    className={errors.startDate ? "error" : ""}
                  />
                </div>
                <div className="form-group">
                  <label>
                    Kết thúc <span className="req">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    className={errors.endDate ? "error" : ""}
                  />
                  {errors.endDate && (
                    <span className="err-msg">{errors.endDate}</span>
                  )}
                </div>

                <div className="form-group full">
                  <label>Khách hàng mục tiêu</label>
                  <div className="input-icon-wrapper">
                    <Users size={16} className="input-icon" />
                    <select
                      name="targetAudience"
                      value={formData.targetAudience}
                      onChange={handleInputChange}
                    >
                      <option value="all">Tất cả khách hàng</option>
                      <option value="new">Khách hàng mới</option>
                      <option value="vip">Khách VIP</option>
                      <option value="birthday">Sinh nhật trong tháng</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: MÔ TẢ */}
            <div className="form-section no-border">
              <div className="form-group full">
                <label>Điều kiện áp dụng (Mỗi dòng 1 điều kiện)</label>
                <textarea
                  name="conditions"
                  rows="3"
                  placeholder="- Chỉ áp dụng ăn tại quán&#10;- Không áp dụng lễ tết"
                  value={formData.conditions}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </form>
        </div>

        {/* --- FOOTER --- */}
        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Hủy bỏ
          </button>
          <div className="right-actions">
            <button type="button" className="btn-secondary">
              Lưu Nháp
            </button>
            <button type="submit" form="promoForm" className="btn-primary">
              <Save size={18} />
              {promotion ? "Lưu thay đổi" : "Tạo khuyến mãi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionModal;
