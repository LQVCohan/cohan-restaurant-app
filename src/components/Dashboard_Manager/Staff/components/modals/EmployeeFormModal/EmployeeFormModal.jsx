// src/pages/StaffManagement/components/modals/EmployeeFormModal.jsx
import React, { useState, useEffect } from "react";
import Modal from "../../../../../common/Modal";
import LoadingSpinner from "../../../../../common/LoadingSpinner";
import "./EmployeeFormModal.scss";

const EmployeeFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  mode = "add",
  restaurantList = [],
  defaultRestaurantId = "",
}) => {
  const [formData, setFormData] = useState({
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
    emergencyRelation: "",
    notes: "",
    primaryRestaurantId: "",
    refRestaurantIds: [],
    userType: "STAFF", // STAFF | MANAGER
    employmentType: "fulltime", // fulltime | parttime | seasonal | intern
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isDirty, setIsDirty] = useState(false); // 👈 đang có thay đổi hay chưa

  // show / hide password
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const userTypeOptions = [
    { value: "STAFF", label: "👥 Nhân viên" },
    { value: "MANAGER", label: "👔 Quản lý" },
  ];

  const employmentTypeOptions = [
    { value: "fulltime", label: "⏰ Toàn thời gian" },
    { value: "parttime", label: "⏱️ Bán thời gian" },
    { value: "seasonal", label: "🍂 Thời vụ" },
    { value: "intern", label: "📚 Thực tập" },
  ];

  useEffect(() => {
    if (isOpen && mode === "add") {
      resetForm();
      setCurrentStep(1);
    }
  }, [isOpen, mode]);

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
      emergencyRelation: "",
      notes: "",
      primaryRestaurantId: defaultRestaurantId || "",
      refRestaurantIds: [],
      userType: "STAFF",
      employmentType: "fulltime",
      password: "",
      confirmPassword: "",
    });
    setErrors({});
    setIsDirty(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = "Vui lòng nhập họ tên";
      if (!formData.role.trim()) newErrors.role = "Vui lòng nhập chức vụ";
      if (!formData.department) newErrors.department = "Vui lòng chọn bộ phận";
      if (!formData.primaryRestaurantId)
        newErrors.primaryRestaurantId = "Vui lòng chọn nhà hàng làm việc";
      if (!formData.userType) newErrors.userType = "Vui lòng chọn loại nhân sự";
    }

    if (step === 2) {
      if (!formData.phone.trim()) {
        newErrors.phone = "Vui lòng nhập số điện thoại";
      } else if (!/^[0-9]{9,11}$/.test(formData.phone.replace(/\s/g, ""))) {
        newErrors.phone = "Số điện thoại không hợp lệ (9-11 số)";
      }

      if (!formData.email.trim()) {
        newErrors.email = "Vui lòng nhập email";
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = "Email không hợp lệ";
      }

      if (mode === "add") {
        if (!formData.password.trim()) {
          newErrors.password = "Vui lòng nhập mật khẩu ban đầu";
        } else if (formData.password.length < 6) {
          newErrors.password = "Mật khẩu phải từ 6 ký tự trở lên";
        }

        if (!formData.confirmPassword.trim()) {
          newErrors.confirmPassword = "Vui lòng nhập lại mật khẩu";
        } else if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = "Mật khẩu nhập lại không khớp";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true); // có sửa form => đánh dấu bẩn

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleToggleRefRestaurant = (id) => {
    setFormData((prev) => {
      const exists = prev.refRestaurantIds.includes(id);
      const next = exists
        ? prev.refRestaurantIds.filter((rid) => rid !== id)
        : [...prev.refRestaurantIds, id];
      return { ...prev, refRestaurantIds: next };
    });
    setIsDirty(true);
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  // đóng modal có cảnh báo nếu đang nhập dở
  const handleRequestClose = () => {
    if (isSubmitting) return;
    if (!isDirty) {
      onClose?.();
      return;
    }

    const ok = window.confirm(
      "Bạn có muốn thoát không? Các thông tin chưa lưu sẽ bị mất."
    );
    if (ok) {
      onClose?.();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);

    try {
      const baseSalary = formData.salary
        ? Number(formData.salary.toString().replace(/[^\d]/g, ""))
        : undefined;

      const staffPayload = {
        fullName: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password || undefined,
        userType: formData.userType, // STAFF | MANAGER
        positionTitle: formData.role.trim(),
        department: formData.department,
        primaryRestaurantId: formData.primaryRestaurantId || undefined,
        refRestaurantIds:
          formData.refRestaurantIds && formData.refRestaurantIds.length > 0
            ? formData.refRestaurantIds
            : undefined,
        employmentType: formData.employmentType,
        shiftType: formData.shift || undefined,
        dateJoined: formData.startDate || undefined,
        baseSalary,
        address: formData.address
          ? {
              line1: formData.address,
            }
          : undefined,
        emergencyContact: {
          name: formData.emergencyContact || undefined,
          phone: formData.emergencyPhone || undefined,
          relation: formData.emergencyRelation || undefined,
        },
        noteInternal: formData.notes || undefined,
        status: "active",
      };

      await onSubmit(staffPayload);
      setIsDirty(false);
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
            {step === 2 && "Liên hệ & tài khoản"}
            {step === 3 && "Công việc & lương"}
          </div>
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="form-step">
      <h3 className="step-title">Thông Tin Cơ Bản</h3>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            Họ và tên <span className="label-required">*</span>
          </label>
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

        <div className="form-group">
          <label className="form-label">
            Chức vụ <span className="label-required">*</span>
          </label>
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
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            Nhà hàng làm việc <span className="label-required">*</span>
          </label>
          <select
            className={`form-input ${
              errors.primaryRestaurantId ? "error" : ""
            }`}
            value={formData.primaryRestaurantId}
            onChange={(e) =>
              handleInputChange("primaryRestaurantId", e.target.value)
            }
            disabled={isSubmitting}
          >
            <option value="">— Chọn nhà hàng —</option>
            {restaurantList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.emoji ? `${r.emoji} ${r.name}` : `🏢 ${r.name}`}
              </option>
            ))}
          </select>
          {errors.primaryRestaurantId && (
            <div className="error-message">{errors.primaryRestaurantId}</div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            Loại nhân sự <span className="label-required">*</span>
          </label>
          <div className="user-type-toggle">
            {userTypeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`user-type-chip ${
                  formData.userType === opt.value ? "selected" : ""
                }`}
                onClick={() => handleInputChange("userType", opt.value)}
                disabled={isSubmitting}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {errors.userType && (
            <div className="error-message">{errors.userType}</div>
          )}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          Bộ phận làm việc <span className="label-required">*</span>
        </label>
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

      {restaurantList.length > 1 && (
        <div className="form-group">
          <label className="form-label">
            Làm việc thêm tại nhà hàng (tuỳ chọn)
          </label>
          <div className="ref-restaurants-grid">
            {restaurantList.map((r) => (
              <label key={r.id} className="ref-restaurant-item">
                <input
                  type="checkbox"
                  checked={formData.refRestaurantIds.includes(r.id)}
                  onChange={() => handleToggleRefRestaurant(r.id)}
                  disabled={isSubmitting}
                />
                <span>{r.emoji ? `${r.emoji} ${r.name}` : `🏢 ${r.name}`}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="form-step">
      <h3 className="step-title">📞 Liên Hệ & Tài Khoản</h3>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            Số điện thoại <span className="label-required">*</span>
          </label>
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
          <label className="form-label">
            Email <span className="label-required">*</span>
          </label>
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

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            Mật khẩu đăng nhập ban đầu{" "}
            {mode === "add" && <span className="label-required">*</span>}
          </label>
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              className={`form-input ${errors.password ? "error" : ""}`}
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              disabled={isSubmitting || mode !== "add"}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              disabled={isSubmitting || mode !== "add"}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
          {errors.password && (
            <div className="error-message">{errors.password}</div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            Nhập lại mật khẩu{" "}
            {mode === "add" && <span className="label-required">*</span>}
          </label>
          <div className="password-field">
            <input
              type={showConfirmPassword ? "text" : "password"}
              className={`form-input ${errors.confirmPassword ? "error" : ""}`}
              value={formData.confirmPassword}
              onChange={(e) =>
                handleInputChange("confirmPassword", e.target.value)
              }
              placeholder="Nhập lại mật khẩu"
              disabled={isSubmitting || mode !== "add"}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirmPassword((v) => !v)}
              disabled={isSubmitting || mode !== "add"}
            >
              {showConfirmPassword ? "🙈" : "👁️"}
            </button>
          </div>
          {errors.confirmPassword && (
            <div className="error-message">{errors.confirmPassword}</div>
          )}
        </div>
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
            <label className="form-label">Mối quan hệ</label>
            <input
              type="text"
              className="form-input"
              value={formData.emergencyRelation}
              onChange={(e) =>
                handleInputChange("emergencyRelation", e.target.value)
              }
              placeholder="VD: Bố, Mẹ, Anh/Chị..."
              disabled={isSubmitting}
            />
          </div>
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
  );

  const renderStep3 = () => (
    <div className="form-step">
      <h3 className="step-title">💼 Chi Tiết Công Việc & Lương</h3>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Loại hợp đồng</label>
          <div className="employment-type-chips">
            {employmentTypeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`employment-chip ${
                  formData.employmentType === opt.value ? "selected" : ""
                }`}
                onClick={() => handleInputChange("employmentType", opt.value)}
                disabled={isSubmitting}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
        <label className="form-label">Ghi chú nội bộ</label>
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
      onClose={handleRequestClose} // 👈 dùng handler có confirm
      size="lg"
      className="employee-form-modal"
      showCloseButton={false} // tắt header mặc định
    >
      <div className="modal-header-custom">
        <div>
          <h2 className="modal-title-custom">
            {mode === "add" ? "Thêm Nhân Viên Mới" : "✏️ Cập Nhật Nhân Viên"}
          </h2>
          <div className="modal-subtitle-custom">
            {mode === "add"
              ? "Tạo hồ sơ nhân viên cho FoodHub"
              : "Chỉnh sửa thông tin nhân viên"}
          </div>
        </div>

        <button
          type="button"
          className="employee-close-btn"
          onClick={handleRequestClose}
          aria-label="Đóng"
        >
          ×
        </button>
      </div>

      {renderStepIndicator()}

      <form onSubmit={handleSubmit} className="employee-form">
        <div className="modal-body-custom">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        <div className="modal-footer-custom">
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
              onClick={handleRequestClose}
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
                    {mode === "add" ? "Đang tạo..." : "Đang lưu..."}
                  </>
                ) : mode === "add" ? (
                  "✅ Tạo Nhân Viên"
                ) : (
                  "💾 Lưu Thay Đổi"
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
