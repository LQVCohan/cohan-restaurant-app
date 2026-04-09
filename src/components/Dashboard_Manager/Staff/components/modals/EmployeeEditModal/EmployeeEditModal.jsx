import React, { useState, useEffect } from "react";
import Modal from "../../../../../common/Modal";
import LoadingSpinner from "../../../../../common/LoadingSpinner";
import Badge from "../../../../../common/Badge";
import useModalDraft from "../../../../../../hooks/useModalDraft";
import { useNotification } from "../../../../../../hooks/useNotification";
import "./EmployeeEditModal.scss";

const EmployeeEditModal = ({ isOpen, onClose, employee, onSubmit, onUpdate }) => {
  const { showNotification } = useNotification();
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

  const formatDateInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  };

  useEffect(() => {
    if (employee && isOpen) {
      const source = employee.raw || employee;
      const data = {
        fullName: source.fullName || employee.name || "",
        positionTitle: source.positionTitle || employee.role || "",
        department: source.department || employee.department || "service",
        phone: source.phone || employee.phone || "",
        email: source.email || employee.email || "",
        address: source.address?.line1 || employee.address || "",
        baseSalary: source.baseSalary || employee.salary || "",
        shiftType: source.shiftType || employee.shift || "",
        dateJoined: formatDateInput(source.dateJoined || employee.startDate),
        employmentStatus: source.employmentStatus || "WORKING",
        emergencyContact: source.emergencyContact?.name || "",
        emergencyPhone: source.emergencyContact?.phone || "",
        notes: source.noteInternal || "",
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

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen && !!employee,
    draftIdentity: {
      module: "staff",
      modal: "employee-edit-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "edit",
      entityType: "employee",
      recordId: employee?.id || employee?._id || employee?.raw?.id || null,
      context: "staff-management",
      schemaVersion: "1",
    },
    formValue: formData,
    isDirty: hasChanges,
    sanitize: (v) => ({
      fullName: v?.fullName || "",
      positionTitle: v?.positionTitle || "",
      department: v?.department || "service",
      baseSalary: v?.baseSalary || "",
      shiftType: v?.shiftType || "",
      dateJoined: v?.dateJoined || "",
      employmentStatus: v?.employmentStatus || "WORKING",
      notes: v?.notes || "",
    }),
    onRestore: (draft) => {
      setFormData((prev) => ({ ...prev, ...draft }));
      showNotification(
        "Một số thông tin nhạy cảm (liên hệ cá nhân) không được khôi phục tự động.",
        "info",
        3200,
      );
    },
    notify: showNotification,
  });

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName?.trim()) newErrors.fullName = "Vui lòng nhập họ tên";
    if (!formData.positionTitle?.trim())
      newErrors.positionTitle = "Vui lòng nhập chức vụ";

    const hasPhone = formData.phone?.trim();
    const hasEmail = formData.email?.trim();
    if (!hasPhone && !hasEmail) {
      newErrors.phone = "Nhập số điện thoại hoặc email liên hệ";
      newErrors.email = "Nhập số điện thoại hoặc email liên hệ";
    }
    if (hasPhone && !/^[0-9]{9,11}$/.test(formData.phone.replace(/\s/g, ""))) {
      newErrors.phone = "Số điện thoại không hợp lệ";
    }
    if (hasEmail && !/\S+@\S+\.\S+/.test(formData.email)) {
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
      const baseSalary = formData.baseSalary
        ? Number(formData.baseSalary.toString().replace(/[^\d]/g, ""))
        : undefined;

      const payload = {
        fullName: formData.fullName.trim(),
        positionTitle: formData.positionTitle.trim(),
        department: formData.department,
        phone: formData.phone ? formData.phone.trim() : undefined,
        email: formData.email ? formData.email.trim() : undefined,
        address: formData.address ? { line1: formData.address } : undefined,
        baseSalary,
        shiftType: formData.shiftType || undefined,
        dateJoined: formData.dateJoined
          ? new Date(formData.dateJoined + "T00:00:00").toISOString()
          : undefined,
        employmentStatus: formData.employmentStatus,
        noteInternal: formData.notes || undefined,
        emergencyContact:
          formData.emergencyContact || formData.emergencyPhone
            ? {
                name: formData.emergencyContact || undefined,
                phone: formData.emergencyPhone || undefined,
              }
            : undefined,
      };

      const handler = onSubmit || onUpdate;
      if (handler) {
        await handler(payload);
      }
      clearDraft();
      showNotification("Đã xóa dữ liệu nháp sau khi cập nhật.", "success", 2200);
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
    clearDraft();
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
          {formData.fullName?.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="employee-info">
          <h3>{formData.fullName || "Chưa có tên"}</h3>
          <Badge
            variant={formData.employmentStatus === "WORKING" ? "success" : "danger"}
          >
            {formData.employmentStatus === "WORKING"
              ? "✅ Đang làm việc"
              : "❌ Tạm nghỉ"}
          </Badge>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Họ và tên *</label>
          <input
            type="text"
            className={`form-input ${errors.fullName ? "error" : ""}`}
            value={formData.fullName || ""}
            onChange={(e) => handleInputChange("fullName", e.target.value)}
            placeholder="Nhập họ và tên"
            disabled={isSubmitting}
          />
          {errors.fullName && (
            <div className="error-message">{errors.fullName}</div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Chức vụ *</label>
          <input
            type="text"
            className={`form-input ${errors.positionTitle ? "error" : ""}`}
            value={formData.positionTitle || ""}
            onChange={(e) => handleInputChange("positionTitle", e.target.value)}
            placeholder="VD: Phục vụ, Bếp trưởng..."
            disabled={isSubmitting}
          />
          {errors.positionTitle && (
            <div className="error-message">{errors.positionTitle}</div>
          )}
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
            value={formData.employmentStatus || "WORKING"}
            onChange={(e) =>
              handleInputChange("employmentStatus", e.target.value)
            }
            disabled={isSubmitting}
          >
            <option value="WORKING">✅ Đang làm việc</option>
            <option value="ON_LEAVE">🏖️ Nghỉ phép</option>
            <option value="RESIGNED">❌ Nghỉ việc</option>
            <option value="SUSPENDED">⛔ Tạm đình chỉ</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Ngày vào làm</label>
        <input
          type="date"
          className="form-input"
          value={formData.dateJoined || ""}
          onChange={(e) => handleInputChange("dateJoined", e.target.value)}
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
          value={formData.shiftType || ""}
          onChange={(e) => handleInputChange("shiftType", e.target.value)}
          disabled={isSubmitting}
        >
          <option value="">Chọn ca làm việc</option>
          <option value="MORNING">🌅 Ca sáng (6:00 - 14:00)</option>
          <option value="AFTERNOON">☀️ Ca chiều (14:00 - 22:00)</option>
          <option value="EVENING">🌙 Ca tối (22:00 - 6:00)</option>
          <option value="FULL_DAY">⏰ Ca full (8:00 - 17:00)</option>
          <option value="ROTATING">🔁 Xoay ca</option>
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
            {formData.baseSalary || "Chưa thiết lập"}
          </div>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Mức lương cơ bản</label>
        <div className="salary-input-group">
          <input
            type="text"
            className="form-input"
            value={formData.baseSalary || ""}
            onChange={(e) => handleInputChange("baseSalary", e.target.value)}
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
      onClose={() => requestCloseWithDraft(onClose)}
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
              onClick={() => requestCloseWithDraft(onClose)}
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
