import React, { useEffect, useState } from "react";
import {
  X,
  Save,
  Package,
  ClipboardList,
  Clock,
  Tag,
  ListChecks,
} from "lucide-react";
import { COUPON_CATEGORIES } from "../../../../../utils/constants";
import "./CouponPackageModal.scss";

const buildInitialFormData = (couponPackage) => ({
  name: couponPackage?.name || "",
  code: couponPackage?.code || "",
  description: couponPackage?.description || "",
  couponIds: couponPackage?.couponIds || [],
  startDate: couponPackage?.startDate || "",
  endDate: couponPackage?.endDate || "",
  publishAt: couponPackage?.publishAt || "",
  conditions: couponPackage?.conditions
    ? couponPackage.conditions.join("\n")
    : "",
});

const CouponPackageModal = ({
  couponPackage,
  availableCoupons,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState(buildInitialFormData(couponPackage));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormData(buildInitialFormData(couponPackage));
    setErrors({});
  }, [couponPackage]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleToggleCoupon = (couponId) => {
    setFormData((prev) => {
      const exists = prev.couponIds.includes(couponId);
      return {
        ...prev,
        couponIds: exists
          ? prev.couponIds.filter((id) => id !== couponId)
          : [...prev.couponIds, couponId],
      };
    });
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formData.name.trim()) nextErrors.name = "Bắt buộc nhập";
    if (!formData.code.trim()) nextErrors.code = "Bắt buộc nhập";
    if (!formData.startDate) nextErrors.startDate = "Chọn ngày";
    if (!formData.endDate) nextErrors.endDate = "Chọn ngày";
    if (formData.couponIds.length === 0) {
      nextErrors.couponIds = "Chọn ít nhất 1 coupon";
    }
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
      conditions: formData.conditions.split("\n").filter((line) => line.trim()),
      status,
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
            <h2>{couponPackage ? "Chỉnh sửa gói Coupon" : "Tạo gói Coupon"}</h2>
            <p>Gộp nhiều coupon vào một gói cho từng nhóm khách hàng.</p>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <form id="couponPackageForm" onSubmit={handleSubmit}>
            <div className="form-section">
              <h3 className="section-title">
                <Package size={18} /> Thông tin gói
              </h3>
              <div className="grid-2">
                <div className="form-group full">
                  <label>
                    Tên gói Coupon <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="VD: Gói khách mới"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={errors.name ? "error" : ""}
                  />
                  {errors.name && <span className="err-msg">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label>
                    Mã gói <span className="req">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <Tag size={16} className="input-icon" />
                    <input
                      type="text"
                      name="code"
                      placeholder="VD: NEWBIE-PACK"
                      value={formData.code}
                      onChange={handleInputChange}
                      className={errors.code ? "error" : ""}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Mô tả nhanh</label>
                  <input
                    type="text"
                    name="description"
                    placeholder="Mô tả lợi ích gói Coupon"
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <ListChecks size={18} /> Chọn coupon trong gói
              </h3>
              <div className="coupon-selection">
                {availableCoupons.map((coupon) => (
                  <label key={coupon.id} className="coupon-choice">
                    <input
                      type="checkbox"
                      checked={formData.couponIds.includes(coupon.id)}
                      onChange={() => handleToggleCoupon(coupon.id)}
                    />
                    <div className="choice-content">
                      <span className="choice-title">{coupon.name}</span>
                      <span className="choice-meta">
                        {coupon.code} ·{" "}
                        {COUPON_CATEGORIES[coupon.category] ||
                          coupon.category}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              {errors.couponIds && (
                <span className="err-msg">{errors.couponIds}</span>
              )}
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
                  <label>Lịch xuất bản (gói sắp tới)</label>
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
                  placeholder="- Áp dụng cho khách mới"
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
            <button
              type="submit"
              form="couponPackageForm"
              className="btn-primary"
            >
              <Save size={18} />
              {couponPackage ? "Lưu thay đổi" : "Tạo gói"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CouponPackageModal;
