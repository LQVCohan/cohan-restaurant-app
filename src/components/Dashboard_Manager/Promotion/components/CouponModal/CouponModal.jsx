import React, { useEffect, useState } from "react";
import {
  X,
  Save,
  FileText,
  Tag,
  Clock,
  Percent,
  DollarSign,
  ClipboardList,
} from "lucide-react";
import {
  COUPON_CATEGORIES,
  COUPON_DISCOUNT_TYPES,
} from "../../../../../utils/constants";
import "./CouponModal.scss";

const ORDER_TYPE_OPTIONS = [
  { value: "dine_in", label: "Dùng tại bàn" },
  { value: "takeaway", label: "Mang đi" },
  { value: "delivery", label: "Giao hàng" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Tiền mặt" },
  { value: "card", label: "Thẻ" },
  { value: "transfer", label: "Chuyển khoản" },
  { value: "bank_transfer", label: "Ngân hàng" },
  { value: "e_wallet", label: "Ví điện tử" },
];

const toArray = (value) => (Array.isArray(value) ? value : []);

const buildInitialFormData = (coupon) => ({
  name: coupon?.name || "",
  code: coupon?.code || "",
  category: coupon?.category || "",
  discountType: coupon?.discountType || "",
  discountValue: coupon?.discountValue || "",
  minOrderValue: coupon?.minOrderValue || "",
  maxDiscount: coupon?.maxDiscount || "",
  usageLimit: coupon?.usageLimit || "",
  startDate: coupon?.startDate || "",
  endDate: coupon?.endDate || "",
  publishAt: coupon?.publishAt || "",
  description: coupon?.description || "",
  conditions: coupon?.conditions ? coupon.conditions.join("\n") : "",
  stackable: Boolean(coupon?.stackable),
  combinableWithPromotions: Boolean(coupon?.combinableWithPromotions),
  exclusive: Boolean(coupon?.exclusive),
  priority:
    coupon?.priority === 0 || coupon?.priority ? String(coupon.priority) : "0",
  perUserLimit:
    coupon?.perUserLimit === 0 || coupon?.perUserLimit
      ? String(coupon.perUserLimit)
      : "",
  orderTypes: toArray(coupon?.orderTypes),
  paymentMethods: toArray(coupon?.paymentMethods),
  firstOrderOnly: Boolean(coupon?.firstOrderOnly),
});

const CouponModal = ({ coupon, onSave, onClose }) => {
  const [formData, setFormData] = useState(buildInitialFormData(coupon));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormData(buildInitialFormData(coupon));
    setErrors({});
  }, [coupon]);

  const handleInputChange = (event) => {
    const { checked, name, type, value } = event.target;
    const nextValue = type === "checkbox" ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleMultiCheckboxChange = (fieldName, optionValue) => (event) => {
    const { checked } = event.target;
    setFormData((prev) => {
      const currentValues = toArray(prev[fieldName]);
      return {
        ...prev,
        [fieldName]: checked
          ? [...new Set([...currentValues, optionValue])]
          : currentValues.filter((value) => value !== optionValue),
      };
    });
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formData.name.trim()) nextErrors.name = "Bắt buộc nhập";
    if (!formData.code.trim()) nextErrors.code = "Bắt buộc nhập";
    if (!formData.category) nextErrors.category = "Chọn nhóm coupon";
    if (!formData.discountType) nextErrors.discountType = "Chọn loại";
    if (!formData.discountValue) nextErrors.discountValue = "Nhập giá trị";
    if (!formData.startDate) nextErrors.startDate = "Chọn ngày";
    if (!formData.endDate) nextErrors.endDate = "Chọn ngày";
    if (
      formData.startDate &&
      formData.endDate &&
      formData.startDate >= formData.endDate
    ) {
      nextErrors.endDate = "Ngày kết thúc không hợp lệ";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event, mode = "publish") => {
    event.preventDefault();
    if (!validateForm()) return;

    const now = new Date();
    const publishAtDate = formData.publishAt
      ? new Date(formData.publishAt)
      : null;
    const endDate = new Date(formData.endDate);
    const startDate = new Date(formData.startDate);

    let status = "active";
    if (mode === "draft") {
      status = "draft";
    } else if (publishAtDate && publishAtDate > now) {
      status = "scheduled";
    } else if (endDate < now) {
      status = "expired";
    } else if (startDate > now) {
      status = "scheduled";
    }

    const formattedData = {
      ...formData,
      discountValue: parseFloat(formData.discountValue),
      minOrderValue: formData.minOrderValue
        ? parseFloat(formData.minOrderValue)
        : null,
      maxDiscount: formData.maxDiscount
        ? parseFloat(formData.maxDiscount)
        : null,
      usageLimit: formData.usageLimit
        ? parseInt(formData.usageLimit, 10)
        : null,
      conditions: formData.conditions.split("\n").filter((line) => line.trim()),
      status,
      stackable: Boolean(formData.stackable),
      combinableWithPromotions: Boolean(formData.combinableWithPromotions),
      exclusive: Boolean(formData.exclusive),
      priority: formData.priority ? parseInt(formData.priority, 10) : 0,
      perUserLimit: formData.perUserLimit
        ? parseInt(formData.perUserLimit, 10)
        : 0,
      orderTypes: toArray(formData.orderTypes),
      paymentMethods: toArray(formData.paymentMethods),
      firstOrderOnly: Boolean(formData.firstOrderOnly),
    };

    onSave(formattedData);
  };

  return (
    <div
      className="premium-modal-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="premium-modal">
        <div className="modal-header">
          <div className="header-content">
            <h2>{coupon ? "Chỉnh sửa coupon" : "Tạo coupon mới"}</h2>
            <p>
              Thiết lập coupon đầy đủ điều kiện, thời gian và lịch xuất bản.
            </p>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <form id="couponForm" onSubmit={handleSubmit}>
            <div className="form-section">
              <h3 className="section-title">
                <FileText size={18} /> Thông tin coupon
              </h3>
              <div className="grid-2">
                <div className="form-group full">
                  <label>
                    Tên coupon <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="VD: Coupon Tết 2025"
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
                    Mã coupon <span className="req">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <Tag size={16} className="input-icon" />
                    <input
                      type="text"
                      name="code"
                      placeholder="VD: NEWYEAR"
                      value={formData.code}
                      onChange={handleInputChange}
                      className={errors.code ? "error" : ""}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Nhóm coupon <span className="req">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={errors.category ? "error" : ""}
                  >
                    <option value="">-- Chọn nhóm --</option>
                    {Object.entries(COUPON_CATEGORIES).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <span className="err-msg">{errors.category}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <Percent size={18} /> Giá trị & điều kiện
              </h3>
              <div className="grid-3">
                <div className="form-group">
                  <label>
                    Loại giảm <span className="req">*</span>
                  </label>
                  <select
                    name="discountType"
                    value={formData.discountType}
                    onChange={handleInputChange}
                    className={errors.discountType ? "error" : ""}
                  >
                    <option value="">-- Loại --</option>
                    {Object.entries(COUPON_DISCOUNT_TYPES).map(
                      ([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ),
                    )}
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
                    className={errors.discountValue ? "error" : ""}
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
                <div className="form-group">
                  <label>Mỗi khách dùng tối đa</label>
                  <input
                    type="number"
                    name="perUserLimit"
                    min="0"
                    placeholder="Không giới hạn"
                    value={formData.perUserLimit}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group full mt-3">
                <label>Mô tả coupon</label>
                <input
                  type="text"
                  name="description"
                  placeholder="Mô tả nhanh cho coupon"
                  value={formData.description}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <ClipboardList size={18} /> Điều kiện đủ điều kiện
              </h3>

              <div className="grid-2">
                <div className="form-group full">
                  <label>Loại đơn áp dụng</label>
                  <div className="checkbox-group">
                    {ORDER_TYPE_OPTIONS.map((option) => (
                      <label className="checkbox-row" key={option.value}>
                        <input
                          type="checkbox"
                          name="orderTypes"
                          value={option.value}
                          checked={formData.orderTypes.includes(option.value)}
                          onChange={handleMultiCheckboxChange(
                            "orderTypes",
                            option.value,
                          )}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group full">
                  <label>Phương thức thanh toán</label>
                  <div className="checkbox-group">
                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                      <label className="checkbox-row" key={option.value}>
                        <input
                          type="checkbox"
                          name="paymentMethods"
                          value={option.value}
                          checked={formData.paymentMethods.includes(
                            option.value,
                          )}
                          onChange={handleMultiCheckboxChange(
                            "paymentMethods",
                            option.value,
                          )}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="firstOrderOnly"
                    checked={Boolean(formData.firstOrderOnly)}
                    onChange={handleInputChange}
                  />
                  <span>Chỉ cho đơn đầu tiên của khách</span>
                </label>
              </div>
            </div>
            <div className="form-section">
              <h3 className="section-title">
                <ClipboardList size={18} /> Cấu hình dùng chồng
              </h3>

              <div className="grid-2">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="stackable"
                    checked={Boolean(formData.stackable)}
                    onChange={handleInputChange}
                  />
                  <span>Cho phép dùng chồng với coupon khác</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="combinableWithPromotions"
                    checked={Boolean(formData.combinableWithPromotions)}
                    onChange={handleInputChange}
                  />
                  <span>Cho phép dùng chung với chương trình khuyến mãi</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="exclusive"
                    checked={Boolean(formData.exclusive)}
                    onChange={handleInputChange}
                  />
                  <span>Coupon độc quyền, ưu tiên chặn ưu đãi khác</span>
                </label>

                <div className="form-group">
                  <label>Độ ưu tiên</label>
                  <input
                    type="number"
                    name="priority"
                    min="0"
                    placeholder="0"
                    value={formData.priority}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <p className="text-xs text-secondary mt-2">
                Quy tắc dùng chồng coupon sẽ được tính lại khi áp coupon vào đơn
                hàng.
              </p>
            </div>
            <div className="form-section">
              <h3 className="section-title">
                <Clock size={18} /> Thời gian & công bố
              </h3>
              <div className="grid-2">
                <div className="form-group">
                  <label>
                    Bắt đầu hiệu lực <span className="req">*</span>
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
                    Kết thúc hiệu lực <span className="req">*</span>
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
                  <label>Lịch xuất bản (coupon sắp tới)</label>
                  <div className="input-icon-wrapper">
                    <Clock size={16} className="input-icon" />
                    <input
                      type="datetime-local"
                      name="publishAt"
                      value={formData.publishAt}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section no-border">
              <div className="form-group full">
                <label>Điều kiện áp dụng (mỗi dòng 1 điều kiện)</label>
                <textarea
                  name="conditions"
                  rows="3"
                  placeholder="- Chỉ áp dụng cho coupon nhóm món ăn"
                  value={formData.conditions}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Hủy bỏ
          </button>
          <div className="right-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={(event) => handleSubmit(event, "draft")}
            >
              <ClipboardList size={18} /> Lưu nháp
            </button>
            <button type="submit" form="couponForm" className="btn-primary">
              <Save size={18} />
              {coupon ? "Lưu thay đổi" : "Tạo coupon"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CouponModal;
