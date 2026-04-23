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
  VOUCHER_CATEGORIES,
  VOUCHER_DISCOUNT_TYPES,
} from "../../../../../utils/constants";
import "./VoucherModal.scss";

const buildInitialFormData = (voucher) => ({
  name: voucher?.name || "",
  code: voucher?.code || "",
  category: voucher?.category || "",
  discountType: voucher?.discountType || "",
  discountValue: voucher?.discountValue || "",
  minOrderValue: voucher?.minOrderValue || "",
  maxDiscount: voucher?.maxDiscount || "",
  usageLimit: voucher?.usageLimit || "",
  startDate: voucher?.startDate || "",
  endDate: voucher?.endDate || "",
  publishAt: voucher?.publishAt || "",
  description: voucher?.description || "",
  conditions: voucher?.conditions ? voucher.conditions.join("\n") : "",
});

const VoucherModal = ({ voucher, onSave, onClose }) => {
  const [formData, setFormData] = useState(buildInitialFormData(voucher));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormData(buildInitialFormData(voucher));
    setErrors({});
  }, [voucher]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formData.name.trim()) nextErrors.name = "Bắt buộc nhập";
    if (!formData.code.trim()) nextErrors.code = "Bắt buộc nhập";
    if (!formData.category) nextErrors.category = "Chọn nhóm voucher";
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
      usageLimit: formData.usageLimit ? parseInt(formData.usageLimit, 10) : null,
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
            <h2>{voucher ? "Chỉnh sửa voucher" : "Tạo voucher mới"}</h2>
            <p>Thiết lập voucher đầy đủ điều kiện, thời gian và lịch xuất bản.</p>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <form id="voucherForm" onSubmit={handleSubmit}>
            <div className="form-section">
              <h3 className="section-title">
                <FileText size={18} /> Thông tin voucher
              </h3>
              <div className="grid-2">
                <div className="form-group full">
                  <label>
                    Tên voucher <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="VD: Voucher Tết 2025"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={errors.name ? "error" : ""}
                  />
                  {errors.name && <span className="err-msg">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label>
                    Mã voucher <span className="req">*</span>
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
                    Nhóm voucher <span className="req">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={errors.category ? "error" : ""}
                  >
                    <option value="">-- Chọn nhóm --</option>
                    {Object.entries(VOUCHER_CATEGORIES).map(([key, label]) => (
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
                    {Object.entries(VOUCHER_DISCOUNT_TYPES).map(([key, label]) => (
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
              </div>

              <div className="form-group full mt-3">
                <label>Mô tả voucher</label>
                <input
                  type="text"
                  name="description"
                  placeholder="Mô tả nhanh cho voucher"
                  value={formData.description}
                  onChange={handleInputChange}
                />
              </div>
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
                  <label>Lịch xuất bản (voucher sắp tới)</label>
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
                <label>
                  Điều kiện áp dụng (mỗi dòng 1 điều kiện)
                </label>
                <textarea
                  name="conditions"
                  rows="3"
                  placeholder="- Chỉ áp dụng cho voucher nhóm món ăn"
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
            <button type="submit" form="voucherForm" className="btn-primary">
              <Save size={18} />
              {voucher ? "Lưu thay đổi" : "Tạo voucher"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoucherModal;
