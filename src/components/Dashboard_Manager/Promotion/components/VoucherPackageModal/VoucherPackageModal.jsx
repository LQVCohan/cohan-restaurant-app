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
import { VOUCHER_CATEGORIES } from "../../../../../utils/constants";
import "./VoucherPackageModal.scss";

const VoucherPackageModal = ({
  voucherPackage,
  availableVouchers,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    voucherIds: [],
    startDate: "",
    endDate: "",
    publishAt: "",
    conditions: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (voucherPackage) {
      setFormData({
        name: voucherPackage.name || "",
        code: voucherPackage.code || "",
        description: voucherPackage.description || "",
        voucherIds: voucherPackage.voucherIds || [],
        startDate: voucherPackage.startDate || "",
        endDate: voucherPackage.endDate || "",
        publishAt: voucherPackage.publishAt || "",
        conditions: voucherPackage.conditions
          ? voucherPackage.conditions.join("\n")
          : "",
      });
    }
  }, [voucherPackage]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleToggleVoucher = (voucherId) => {
    setFormData((prev) => {
      const exists = prev.voucherIds.includes(voucherId);
      return {
        ...prev,
        voucherIds: exists
          ? prev.voucherIds.filter((id) => id !== voucherId)
          : [...prev.voucherIds, voucherId],
      };
    });
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formData.name.trim()) nextErrors.name = "Bắt buộc nhập";
    if (!formData.code.trim()) nextErrors.code = "Bắt buộc nhập";
    if (!formData.startDate) nextErrors.startDate = "Chọn ngày";
    if (!formData.endDate) nextErrors.endDate = "Chọn ngày";
    if (formData.voucherIds.length === 0) {
      nextErrors.voucherIds = "Chọn ít nhất 1 voucher";
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
            <h2>{voucherPackage ? "Chỉnh sửa gói voucher" : "Tạo gói voucher"}</h2>
            <p>Gộp nhiều voucher vào một gói cho từng nhóm khách hàng.</p>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <form id="voucherPackageForm" onSubmit={handleSubmit}>
            <div className="form-section">
              <h3 className="section-title">
                <Package size={18} /> Thông tin gói
              </h3>
              <div className="grid-2">
                <div className="form-group full">
                  <label>
                    Tên gói voucher <span className="req">*</span>
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
                    placeholder="Mô tả lợi ích gói voucher"
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <ListChecks size={18} /> Chọn voucher trong gói
              </h3>
              <div className="voucher-selection">
                {availableVouchers.map((voucher) => (
                  <label key={voucher.id} className="voucher-choice">
                    <input
                      type="checkbox"
                      checked={formData.voucherIds.includes(voucher.id)}
                      onChange={() => handleToggleVoucher(voucher.id)}
                    />
                    <div className="choice-content">
                      <span className="choice-title">{voucher.name}</span>
                      <span className="choice-meta">
                        {voucher.code} ·{" "}
                        {VOUCHER_CATEGORIES[voucher.category] ||
                          voucher.category}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              {errors.voucherIds && (
                <span className="err-msg">{errors.voucherIds}</span>
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
              form="voucherPackageForm"
              className="btn-primary"
            >
              <Save size={18} />
              {voucherPackage ? "Lưu thay đổi" : "Tạo gói"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoucherPackageModal;
