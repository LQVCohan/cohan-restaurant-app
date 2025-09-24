import React, { useState, useEffect } from "react";
import Modal from "../../../../../common/Modal";
import LoadingSpinner from "../../../../../common/LoadingSpinner";
import Badge from "../../../../../common/Badge";
import "./EmployeeEditModal.scss";

const EmployeeEditModal = ({ isOpen, onClose, employee, onUpdate }) => {
  const [formData, setFormData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  const tabs = [
    { id: "basic", label: "👤 Cơ bản", icon: "👤" },
    { id: "contact", label: "📞 Liên hệ", icon: "📞" },
    { id: "work", label: "💼 Công việc", icon: "💼" },
    { id: "salary", label: "💰 Lương", icon: "💰" },
  ];

  useEffect(() => {
    if (employee && isOpen) {
      const data = {
        name: employee.name || "",
        role: employee.role || "",
        department: employee.department || "service",
        phone: employee.phone || "",
        email: employee.email || "",
        address: employee.address || "",
        salary: employee.salary || "",
        shift: employee.shift || "",
        startDate: employee.startDate || "",
        emergencyContact: employee.emergencyContact || "",
        emergencyPhone: employee.emergencyPhone || "",
        notes: employee.notes || "",
        status: employee.status || "active",
      };
      setFormData(data);
      setOriginalData(data);
      setHasChanges(false);
      setActiveTab("basic");
    }
  }, [employee, isOpen]);

  useEffect(() => {
    const changed = JSON.stringify(formData) !== JSON.stringify(originalData);
    setHasChanges(changed);
  }, [formData, originalData]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name?.trim()) newErrors.name = "Vui lòng nhập họ tên";
    if (!formData.role?.trim()) newErrors.role = "Vui lòng nhập chức vụ";
    if (!formData.phone?.trim()) {
      newErrors.phone = "Vui lòng nhập số điện thoại";
    } else if (!/^[0-9]{10,11}$/.test(formData.phone.replace(/\s/g, ""))) {
      newErrors.phone = "Số điện thoại không hợp lệ";
    }
    if (!formData.email?.trim()) {
      newErrors.email = "Vui lòng nhập email";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email không hợp lệ";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const updatedEmployee = {
        ...employee,
        ...formData,
        updatedAt: new Date().toISOString(),
      };

      await onUpdate(updatedEmployee);
      setOriginalData(formData);
      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error("Error updating employee:", error);
      setErrors({ submit: "Có lỗi xảy ra khi cập nhật. Vui lòng thử lại." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData(originalData);
    setErrors({});
    setHasChanges(false);
  };

  const getChangedFields = () => {
    const changes = [];
    Object.keys(formData).forEach((key) => {
      if (formData[key] !== originalData[key]) {
        changes.push(key);
      }
    });
    return changes;
  };

  const renderBasicTab = () => (
    <div className="tab-content">
      <div className="employee-header">
        <div className="employee-avatar">
          {formData.name?.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="employee-info">
          <h3>{formData.name || "Chưa có tên"}</h3>
          <Badge variant={formData.status === "active" ? "success" : "danger"}>
            {formData.status === "active" ? "✅ Đang làm việc" : "❌ Nghỉ việc"}
          </Badge>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Họ và tên *</label>
          <input
            type="text"
            className={`form-input ${errors.name ? "error" : ""}`}
            value={formData.name || ""}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="Nhập họ và tên"
            disabled={isSubmitting}
          />
          {errors.name && <div className="error-message">{errors.name}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">Chức vụ *</label>
          <input
            type="text"
            className={`form-input ${errors.role ? "error" : ""}`}
            value={formData.role || ""}
            onChange={(e) => handleInputChange("role", e.target.value)}
            placeholder="VD: Phục vụ, Bếp trưởng..."
            disabled={isSubmitting}
          />
          {errors.role && <div className="error-message">{errors.role}</div>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Bộ phận</label>
          <select
            className="form-select"
            value={formData.department || "service"}
            onChange={(e) => handleInputChange("department", e.target.value)}
            disabled={isSubmitting}
          >
            <option value="service">🍽️ Phục vụ</option>
            <option value="kitchen">👨‍🍳 Bếp</option>
            <option value="cashier">💰 Thu ngân</option>
            <option value="management">👔 Quản lý</option>
            <option value="cleaning">🧹 Vệ sinh</option>
            <option value="delivery">🚚 Giao hàng</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Trạng thái</label>
          <select
            className="form-select"
            value={formData.status || "active"}
            onChange={(e) => handleInputChange("status", e.target.value)}
            disabled={isSubmitting}
          >
            <option value="active">✅ Đang làm việc</option>
            <option value="inactive">❌ Nghỉ việc</option>
            <option value="probation">⏳ Thử việc</option>
            <option value="leave">🏖️ Nghỉ phép</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Ngày vào làm</label>
        <input
          type="date"
          className="form-input"
          value={formData.startDate || ""}
          onChange={(e) => handleInputChange("startDate", e.target.value)}
          disabled={isSubmitting}
        />
      </div>
    </div>
  );

  const renderContactTab = () => (
    <div className="tab-content">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Số điện thoại *</label>
          <input
            type="tel"
            className={`form-input ${errors.phone ? "error" : ""}`}
            value={formData.phone || ""}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            placeholder="0901234567"
            disabled={isSubmitting}
          />
          {errors.phone && <div className="error-message">{errors.phone}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">Email *</label>
          <input
            type="email"
            className={`form-input ${errors.email ? "error" : ""}`}
            value={formData.email || ""}
            onChange={(e) => handleInputChange("email", e.target.value)}
            placeholder="email@foodhub.vn"
            disabled={isSubmitting}
          />
          {errors.email && <div className="error-message">{errors.email}</div>}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Địa chỉ</label>
        <textarea
          className="form-textarea"
          value={formData.address || ""}
          onChange={(e) => handleInputChange("address", e.target.value)}
          placeholder="Địa chỉ nơi ở"
          rows="3"
          disabled={isSubmitting}
        />
      </div>

      <div className="emergency-section">
        <h4 className="section-title">🚨 Liên Hệ Khẩn Cấp</h4>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tên người liên hệ</label>
            <input
              type="text"
              className="form-input"
              value={formData.emergencyContact || ""}
              onChange={(e) =>
                handleInputChange("emergencyContact", e.target.value)
              }
              placeholder="Tên người thân"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Số điện thoại khẩn cấp</label>
            <input
              type="tel"
              className="form-input"
              value={formData.emergencyPhone || ""}
              onChange={(e) =>
                handleInputChange("emergencyPhone", e.target.value)
              }
              placeholder="0901234567"
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderWorkTab = () => (
    <div className="tab-content">
      <div className="form-group">
        <label className="form-label">Ca làm việc</label>
        <select
          className="form-select"
          value={formData.shift || ""}
          onChange={(e) => handleInputChange("shift", e.target.value)}
          disabled={isSubmitting}
        >
          <option value="">Chọn ca làm việc</option>
          <option value="morning">🌅 Ca sáng (6:00 - 14:00)</option>
          <option value="afternoon">☀️ Ca chiều (14:00 - 22:00)</option>
          <option value="night">🌙 Ca đêm (22:00 - 6:00)</option>
          <option value="full">⏰ Ca full (8:00 - 17:00)</option>
          <option value="part-time">⏱️ Bán thời gian</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Ghi chú công việc</label>
        <textarea
          className="form-textarea"
          value={formData.notes || ""}
          onChange={(e) => handleInputChange("notes", e.target.value)}
          placeholder="Ghi chú về kỹ năng, kinh nghiệm, yêu cầu đặc biệt..."
          rows="5"
          disabled={isSubmitting}
        />
      </div>
    </div>
  );

  const renderSalaryTab = () => (
    <div className="tab-content">
      <div className="salary-overview">
        <div className="salary-card">
          <div className="salary-label">💰 Lương hiện tại</div>
          <div className="salary-value">
            {formData.salary || "Chưa thiết lập"}
          </div>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Mức lương cơ bản</label>
        <div className="salary-input-group">
          <input
            type="text"
            className="form-input"
            value={formData.salary || ""}
            onChange={(e) => handleInputChange("salary", e.target.value)}
            placeholder="8000000"
            disabled={isSubmitting}
          />
          <span className="salary-currency">VNĐ</span>
        </div>
        <div className="salary-note">
          💡 Lương cơ bản chưa bao gồm thưởng và phụ cấp
        </div>
      </div>
    </div>
  );

  if (!employee) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="employee-edit-modal"
    >
      <div className="modal-header">
        <h2 className="modal-title">✏️ Chỉnh Sửa Nhân Viên</h2>
        <div className="modal-subtitle">
          Cập nhật thông tin cho {employee.name}
        </div>

        {hasChanges && (
          <div className="changes-indicator">
            <Badge variant="warning" icon="⚠️">
              {getChangedFields().length} thay đổi chưa lưu
            </Badge>
          </div>
        )}
      </div>

      <div className="modal-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            disabled={isSubmitting}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="employee-edit-form">
        <div className="modal-body">
          {activeTab === "basic" && renderBasicTab()}
          {activeTab === "contact" && renderContactTab()}
          {activeTab === "work" && renderWorkTab()}
          {activeTab === "salary" && renderSalaryTab()}

          {errors.submit && (
            <div className="submit-error">⚠️ {errors.submit}</div>
          )}
        </div>

        <div className="modal-footer">
          <div className="footer-left">
            {hasChanges && (
              <button
                type="button"
                className="btn btn--warning"
                onClick={handleReset}
                disabled={isSubmitting}
              >
                🔄 Khôi phục
              </button>
            )}
          </div>

          <div className="footer-right">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              ❌ Hủy
            </button>

            <button
              type="submit"
              className="btn btn--primary"
              disabled={isSubmitting || !hasChanges}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="small" color="white" />
                  Đang cập nhật...
                </>
              ) : (
                "💾 Lưu Thay Đổi"
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default EmployeeEditModal;
