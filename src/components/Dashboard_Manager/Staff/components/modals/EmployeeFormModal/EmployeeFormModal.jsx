import React, { useState, useEffect } from "react";
import Modal from "../../../../../common/Modal";
import LoadingSpinner from "../../../../../common/LoadingSpinner";
import "./EmployeeFormModal.scss";

const EmployeeFormModal = ({ isOpen, onClose, onSubmit, mode = "add" }) => {
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    department: "service",
    phone: "",
    email: "",
    address: "",
    salary: "",
    shift: "",
    startDate: "",
    emergencyContact: "",
    emergencyPhone: "",
    notes: "",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const departmentOptions = [
    {
      value: "service",
      label: "🍽️ Phục vụ",
      description: "Phục vụ khách hàng, nhận order",
    },
    { value: "kitchen", label: "👨‍🍳 Bếp", description: "Chế biến món ăn" },
    {
      value: "cashier",
      label: "💰 Thu ngân",
      description: "Thanh toán, quản lý tiền",
    },
    {
      value: "management",
      label: "👔 Quản lý",
      description: "Điều hành, giám sát",
    },
    { value: "cleaning", label: "🧹 Vệ sinh", description: "Dọn dẹp, vệ sinh" },
    {
      value: "delivery",
      label: "🚚 Giao hàng",
      description: "Giao món ăn cho khách",
    },
  ];

  const shiftOptions = [
    { value: "morning", label: "🌅 Ca sáng (6:00 - 14:00)" },
    { value: "afternoon", label: "☀️ Ca chiều (14:00 - 22:00)" },
    { value: "night", label: "🌙 Ca đêm (22:00 - 6:00)" },
    { value: "full", label: "⏰ Ca full (8:00 - 17:00)" },
    { value: "part-time", label: "⏱️ Bán thời gian" },
  ];

  useEffect(() => {
    if (isOpen) {
      resetForm();
      setCurrentStep(1);
    }
  }, [isOpen]);

  const resetForm = () => {
    setFormData({
      name: "",
      role: "",
      department: "service",
      phone: "",
      email: "",
      address: "",
      salary: "",
      shift: "",
      startDate: new Date().toISOString().split("T")[0],
      emergencyContact: "",
      emergencyPhone: "",
      notes: "",
    });
    setErrors({});
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = "Vui lòng nhập họ tên";
      if (!formData.role.trim()) newErrors.role = "Vui lòng nhập chức vụ";
      if (!formData.department) newErrors.department = "Vui lòng chọn bộ phận";
    }

    if (step === 2) {
      if (!formData.phone.trim()) {
        newErrors.phone = "Vui lòng nhập số điện thoại";
      } else if (!/^[0-9]{10,11}$/.test(formData.phone.replace(/\s/g, ""))) {
        newErrors.phone = "Số điện thoại không hợp lệ (10-11 số)";
      }

      if (!formData.email.trim()) {
        newErrors.email = "Vui lòng nhập email";
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = "Email không hợp lệ";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);

    try {
      const employeeData = {
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        status: "active",
      };

      await onSubmit(employeeData);
      onClose();
    } catch (error) {
      console.error("Error creating employee:", error);
      setErrors({
        submit: "Có lỗi xảy ra khi tạo nhân viên. Vui lòng thử lại.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="step-indicator">
      {[1, 2, 3].map((step) => (
        <div
          key={step}
          className={`step-item ${currentStep >= step ? "active" : ""} ${
            currentStep > step ? "completed" : ""
          }`}
        >
          <div className="step-number">{currentStep > step ? "✓" : step}</div>
          <div className="step-label">
            {step === 1 && "Thông tin cơ bản"}
            {step === 2 && "Liên hệ"}
            {step === 3 && "Chi tiết công việc"}
          </div>
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="form-step">
      <h3 className="step-title">👤 Thông Tin Cơ Bản</h3>

      <div className="form-group">
        <label className="form-label">Họ và tên *</label>
        <input
          type="text"
          className={`form-input ${errors.name ? "error" : ""}`}
          value={formData.name}
          onChange={(e) => handleInputChange("name", e.target.value)}
          placeholder="Nhập họ và tên đầy đủ"
          disabled={isSubmitting}
        />
        {errors.name && <div className="error-message">{errors.name}</div>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Chức vụ *</label>
          <input
            type="text"
            className={`form-input ${errors.role ? "error" : ""}`}
            value={formData.role}
            onChange={(e) => handleInputChange("role", e.target.value)}
            placeholder="VD: Phục vụ, Bếp trưởng, Thu ngân..."
            disabled={isSubmitting}
          />
          {errors.role && <div className="error-message">{errors.role}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">Ngày vào làm</label>
          <input
            type="date"
            className="form-input"
            value={formData.startDate}
            onChange={(e) => handleInputChange("startDate", e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Bộ phận làm việc *</label>
        <div className="department-grid">
          {departmentOptions.map((option) => (
            <div
              key={option.value}
              className={`department-card ${
                formData.department === option.value ? "selected" : ""
              }`}
              onClick={() => handleInputChange("department", option.value)}
            >
              <div className="department-label">{option.label}</div>
              <div className="department-description">{option.description}</div>
            </div>
          ))}
        </div>
        {errors.department && (
          <div className="error-message">{errors.department}</div>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="form-step">
      <h3 className="step-title">📞 Thông Tin Liên Hệ</h3>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Số điện thoại *</label>
          <input
            type="tel"
            className={`form-input ${errors.phone ? "error" : ""}`}
            value={formData.phone}
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
            value={formData.email}
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
          value={formData.address}
          onChange={(e) => handleInputChange("address", e.target.value)}
          placeholder="Địa chỉ nơi ở hiện tại"
          rows="3"
          disabled={isSubmitting}
        />
      </div>

      <div className="emergency-contact">
        <h4 className="section-title">🚨 Liên Hệ Khẩn Cấp</h4>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tên người liên hệ</label>
            <input
              type="text"
              className="form-input"
              value={formData.emergencyContact}
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
              value={formData.emergencyPhone}
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

  const renderStep3 = () => (
    <div className="form-step">
      <h3 className="step-title">💼 Chi Tiết Công Việc</h3>

      <div className="form-group">
        <label className="form-label">Ca làm việc</label>
        <div className="shift-options">
          {shiftOptions.map((option) => (
            <label key={option.value} className="shift-option">
              <input
                type="radio"
                name="shift"
                value={option.value}
                checked={formData.shift === option.value}
                onChange={(e) => handleInputChange("shift", e.target.value)}
                disabled={isSubmitting}
              />
              <span className="shift-label">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Mức lương cơ bản</label>
        <div className="salary-input-group">
          <input
            type="text"
            className="form-input"
            value={formData.salary}
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

      <div className="form-group">
        <label className="form-label">Ghi chú thêm</label>
        <textarea
          className="form-textarea"
          value={formData.notes}
          onChange={(e) => handleInputChange("notes", e.target.value)}
          placeholder="Ghi chú về kỹ năng, kinh nghiệm, yêu cầu đặc biệt..."
          rows="4"
          disabled={isSubmitting}
        />
      </div>

      {errors.submit && <div className="submit-error">⚠️ {errors.submit}</div>}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      className="employee-form-modal"
    >
      <div className="modal-header">
        <h2 className="modal-title">➕ Thêm Nhân Viên Mới</h2>
        <div className="modal-subtitle">Tạo hồ sơ nhân viên cho FoodHub</div>
        {renderStepIndicator()}
      </div>

      <form onSubmit={handleSubmit} className="employee-form">
        <div className="modal-body">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        <div className="modal-footer">
          <div className="footer-left">
            {currentStep > 1 && (
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handlePrevStep}
                disabled={isSubmitting}
              >
                ← Quay lại
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

            {currentStep < 3 ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleNextStep}
                disabled={isSubmitting}
              >
                Tiếp theo →
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn--success"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <LoadingSpinner size="small" color="white" />
                    Đang tạo...
                  </>
                ) : (
                  "✅ Tạo Nhân Viên"
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default EmployeeFormModal;
