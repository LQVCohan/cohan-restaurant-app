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
  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const [formData, setFormData] = useState({
    name: "",
    role: "",
    department: "service",
    phone: "",
    email: "",
    address: "",
    salary: "",
    shift: "",
    startDate: todayStr,
    emergencyContact: "",
    emergencyPhone: "",
    emergencyRelation: "",
    notes: "",
    primaryRestaurantId: defaultRestaurantId || "",
    refRestaurantIds: [],
    userType: "STAFF",
    employmentType: "FULL_TIME",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isDirty, setIsDirty] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const departmentOptions = [
    {
      value: "service",
      label: "🍽️ Phục vụ",
      description: "Phục vụ khách hàng",
    },
    { value: "kitchen", label: "👨‍🍳 Bếp", description: "Chế biến món ăn" },
    {
      value: "cashier",
      label: "💰 Thu ngân",
      description: "Thanh toán, thu chi",
    },
    {
      value: "management",
      label: "👔 Quản lý",
      description: "Điều hành chung",
    },
    { value: "cleaning", label: "🧹 Vệ sinh", description: "Giữ gìn vệ sinh" },
    {
      value: "delivery",
      label: "🚚 Giao hàng",
      description: "Giao đơn cho khách",
    },
  ];

  const shiftOptions = [
    { value: "MORNING", label: "🌅 Sáng (6:00 - 14:00)" },
    { value: "AFTERNOON", label: "☀️ Chiều (14:00 - 22:00)" },
    { value: "NIGHT", label: "🌙 Đêm (22:00 - 6:00)" },
    { value: "FULL", label: "⏰ Full (8:00 - 17:00)" },
    { value: "PART_TIME", label: "⏱️ Part-time" },
  ];

  const userTypeOptions = [
    { value: "STAFF", label: "Nhân viên", icon: "👤" },
    { value: "MANAGER", label: "Quản lý", icon: "👔" },
  ];

  const employmentTypeOptions = [
    { value: "FULL_TIME", label: "Toàn thời gian" },
    { value: "PART_TIME", label: "Bán thời gian" },
    { value: "SEASONAL", label: "Thời vụ" },
    { value: "INTERN", label: "Thực tập" },
  ];

  useEffect(() => {
    if (isOpen && mode === "add") {
      resetForm();
      setCurrentStep(1);
    }
  }, [isOpen, mode]);

  const resetForm = () => {
    const today = new Date().toISOString().split("T")[0];
    setFormData({
      name: "",
      role: "",
      department: "service",
      phone: "",
      email: "",
      address: "",
      salary: "",
      shift: "",
      startDate: today,
      emergencyContact: "",
      emergencyPhone: "",
      emergencyRelation: "",
      notes: "",
      primaryRestaurantId: defaultRestaurantId || "",
      refRestaurantIds: [],
      userType: "STAFF",
      employmentType: "FULL_TIME",
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

    // --- STEP 1 ---
    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = "Vui lòng nhập họ tên";
      if (!formData.role.trim()) newErrors.role = "Vui lòng nhập chức vụ";
      if (!formData.department) newErrors.department = "Vui lòng chọn bộ phận";
      if (!formData.primaryRestaurantId)
        newErrors.primaryRestaurantId = "Chọn nhà hàng";
    }

    // --- STEP 2 ---
    if (step === 2) {
      const hasPhone = formData.phone.trim().length > 0;
      const hasEmail = formData.email.trim().length > 0;
      const hasPassword = formData.password.trim().length > 0;

      // 1 trong 2: phone hoặc email là bắt buộc
      if (!hasPhone && !hasEmail) {
        newErrors.phone = "Nhập số điện thoại hoặc email liên hệ";
        newErrors.email = "Nhập số điện thoại hoặc email liên hệ";
      }

      // Nếu nhập phone thì kiểm tra định dạng
      if (hasPhone) {
        const digits = formData.phone.replace(/\s/g, "");
        if (!/^[0-9]{9,11}$/.test(digits)) {
          newErrors.phone = "SĐT không hợp lệ";
        }
      }

      // Nếu nhập email thì kiểm tra định dạng
      if (hasEmail && !/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = "Email không hợp lệ";
      }

      // Mật khẩu: HOÀN TOÀN KHÔNG BẮT BUỘC
      // Chỉ validate nếu user có nhập
      if (hasPassword) {
        if (formData.password.length < 6) {
          newErrors.password = "Mật khẩu tối thiểu 6 ký tự";
        }
        if (
          formData.confirmPassword.trim().length === 0 ||
          formData.password !== formData.confirmPassword
        ) {
          newErrors.confirmPassword = "Mật khẩu xác nhận không khớp";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
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
    if (validateStep(currentStep)) setCurrentStep((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleRequestClose = () => {
    if (isSubmitting) return;
    if (!isDirty) {
      onClose?.();
      return;
    }
    if (window.confirm("Dữ liệu chưa lưu sẽ bị mất. Thoát?")) onClose?.();
  };

  const handleSubmit = async () => {
    const isValidCurrent = validateStep(currentStep);
    if (!isValidCurrent) return;

    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    const step1Ok = validateStep(1);
    const step2Ok = validateStep(2);
    if (!step1Ok) {
      setCurrentStep(1);
      return;
    }
    if (!step2Ok) {
      setCurrentStep(2);
      return;
    }

    setIsSubmitting(true);
    try {
      const baseSalary = formData.salary
        ? Number(formData.salary.toString().replace(/[^\d]/g, ""))
        : undefined;

      const dateJoined = formData.startDate
        ? new Date(formData.startDate + "T00:00:00").toISOString()
        : undefined;

      const hasPhone = formData.phone.trim().length > 0;
      const hasEmail = formData.email.trim().length > 0;
      const hasPassword = formData.password.trim().length > 0;

      const staffPayload = {
        fullName: formData.name.trim(),
        phone: hasPhone ? formData.phone.trim() : undefined,
        email: hasEmail ? formData.email.trim() : undefined,
        password: hasPassword ? formData.password.trim() : undefined,
        userType: formData.userType,
        positionTitle: formData.role.trim(),
        department: formData.department,
        primaryRestaurantId: formData.primaryRestaurantId || undefined,
        refRestaurantIds: formData.refRestaurantIds,
        employmentType: formData.employmentType,
        shiftType: formData.shift || undefined,
        dateJoined,
        baseSalary,
        address: formData.address ? { line1: formData.address } : undefined,
        emergencyContact: {
          name: formData.emergencyContact || undefined,
          phone: formData.emergencyPhone || undefined,
          relation: formData.emergencyRelation || undefined,
        },
        noteInternal: formData.notes || undefined,
        status: "active",
      };

      await onSubmit(staffPayload);
      onClose();
    } catch (error) {
      console.error("Error creating employee:", error);
      setErrors({ submit: "Có lỗi xảy ra. Vui lòng thử lại." });
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
          <div className="step-dot">{currentStep > step ? "✓" : step}</div>
          <div className="step-label">
            {step === 1 && "Thông tin"}
            {step === 2 && "Liên hệ"}
            {step === 3 && "Công việc"}
          </div>
        </div>
      ))}
    </div>
  );

  // --- STEP 1 UI ---
  const renderStep1 = () => (
    <div className="form-step">
      <div className="form-header">
        <h3>Thông Tin Cơ Bản</h3>
        <p>Nhập các thông tin định danh và vị trí làm việc</p>
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">
            Họ và tên <span className="req">*</span>
          </label>
          <input
            type="text"
            className={`form-input ${errors.name ? "error" : ""}`}
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="Nguyễn Văn A"
          />
          {errors.name && <span className="error-msg">{errors.name}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">
            Chức vụ <span className="req">*</span>
          </label>
          <input
            type="text"
            className={`form-input ${errors.role ? "error" : ""}`}
            value={formData.role}
            onChange={(e) => handleInputChange("role", e.target.value)}
            placeholder="VD: Quản lý kho"
          />
          {errors.role && <span className="error-msg">{errors.role}</span>}
        </div>
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">
            Nhà hàng chính <span className="req">*</span>
          </label>
          <select
            className={`form-input form-select ${
              errors.primaryRestaurantId ? "error" : ""
            }`}
            value={formData.primaryRestaurantId}
            onChange={(e) =>
              handleInputChange("primaryRestaurantId", e.target.value)
            }
          >
            <option value="">-- Chọn nhà hàng --</option>
            {restaurantList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {errors.primaryRestaurantId && (
            <span className="error-msg">{errors.primaryRestaurantId}</span>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">
            Phân loại <span className="req">*</span>
          </label>
          <div className="user-type-group">
            {userTypeOptions.map((opt) => (
              <div
                key={opt.value}
                className={`type-option ${
                  formData.userType === opt.value ? "active" : ""
                }`}
                onClick={() => handleInputChange("userType", opt.value)}
              >
                <span className="type-icon">{opt.icon}</span>{" "}
                <span className="type-label">{opt.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="form-group mt-2">
        <label className="form-label">
          Bộ phận <span className="req">*</span>
        </label>
        <div className="department-grid">
          {departmentOptions.map((option) => (
            <div
              key={option.value}
              className={`dept-card ${
                formData.department === option.value ? "active" : ""
              }`}
              onClick={() => handleInputChange("department", option.value)}
            >
              <span className="dept-title">{option.label}</span>
              <span className="dept-desc">{option.description}</span>
              {formData.department === option.value && (
                <div className="check-mark">✓</div>
              )}
            </div>
          ))}
        </div>
        {errors.department && (
          <span className="error-msg">{errors.department}</span>
        )}
      </div>
      {restaurantList.length > 1 && (
        <div className="form-group mt-3">
          <label className="form-label">Địa điểm làm thêm</label>
          <div className="ref-tags">
            {restaurantList.map((r) => (
              <label
                key={r.id}
                className={`tag-item ${
                  formData.refRestaurantIds.includes(r.id) ? "active" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.refRestaurantIds.includes(r.id)}
                  onChange={() => handleToggleRefRestaurant(r.id)}
                  hidden
                />
                {r.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // --- STEP 2 UI ---
  const renderStep2 = () => (
    <div className="form-step">
      <div className="form-header">
        <h3>Liên Hệ & Bảo Mật</h3>
        <p>
          Chỉ cần nhập <b>1 trong 2</b>: Số điện thoại hoặc Email
        </p>
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Số điện thoại</label>
          <input
            type="tel"
            className={`form-input ${errors.phone ? "error" : ""}`}
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            placeholder="09..."
          />
          {errors.phone && <span className="error-msg">{errors.phone}</span>}
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            className={`form-input ${errors.email ? "error" : ""}`}
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            placeholder="example@mail.com"
          />
          {errors.email && <span className="error-msg">{errors.email}</span>}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Địa chỉ</label>
        <textarea
          className="form-input"
          value={formData.address}
          onChange={(e) => handleInputChange("address", e.target.value)}
          rows="2"
          placeholder="Địa chỉ nơi ở..."
        />
      </div>
      <div className="section-box highlight-box">
        <h4 className="box-title">
          🔐 Thiết lập mật khẩu{" "}
          <span className="hint-inline">(không bắt buộc, có thể để trống)</span>
        </h4>
        <div className="form-grid">
          <div className="form-group">
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                className={`form-input ${errors.password ? "error" : ""}`}
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                placeholder="Mật khẩu (không bắt buộc)"
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "👁️" : "🙈"}
              </button>
            </div>
            {errors.password && (
              <span className="error-msg">{errors.password}</span>
            )}
          </div>
          <div className="form-group">
            <div className="password-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                className={`form-input ${
                  errors.confirmPassword ? "error" : ""
                }`}
                value={formData.confirmPassword}
                onChange={(e) =>
                  handleInputChange("confirmPassword", e.target.value)
                }
                placeholder="Xác nhận mật khẩu (nếu có)"
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? "👁️" : "🙈"}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="error-msg">{errors.confirmPassword}</span>
            )}
          </div>
        </div>
      </div>
      <div className="section-box warning-box">
        <h4 className="box-title">🚨 Liên hệ khẩn cấp</h4>
        <div className="form-grid">
          <div className="form-group">
            <label className="sub-label">Tên người thân</label>
            <input
              type="text"
              className="form-input"
              value={formData.emergencyContact}
              onChange={(e) =>
                handleInputChange("emergencyContact", e.target.value)
              }
            />
          </div>
          <div className="form-group">
            <label className="sub-label">Số điện thoại</label>
            <input
              type="tel"
              className="form-input"
              value={formData.emergencyPhone}
              onChange={(e) =>
                handleInputChange("emergencyPhone", e.target.value)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );

  // --- STEP 3 UI ---
  const renderStep3 = () => (
    <div className="form-step">
      <div className="form-header">
        <h3>Công Việc & Chế Độ</h3>
        <p>Thiết lập hợp đồng, ca làm việc và lương</p>
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Loại hợp đồng</label>
          <div className="pills-group">
            {employmentTypeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`pill-item ${
                  formData.employmentType === opt.value ? "active" : ""
                }`}
                onClick={() => handleInputChange("employmentType", opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Ngày bắt đầu</label>
          <input
            type="date"
            className="form-input"
            value={formData.startDate}
            onChange={(e) => handleInputChange("startDate", e.target.value)}
          />
        </div>
      </div>
      <div className="form-group section-box salary-box">
        <label className="form-label">Mức lương cơ bản</label>
        <div className="salary-input-row">
          <input
            type="text"
            className="salary-input-field"
            value={formData.salary}
            onChange={(e) => handleInputChange("salary", e.target.value)}
            placeholder="0"
          />
          <span className="currency-badge">VNĐ</span>
        </div>
        <p className="hint-text">Chưa bao gồm phụ cấp & thưởng.</p>
      </div>
      <div className="form-group">
        <label className="form-label">Ghi chú</label>
        <textarea
          className="form-input"
          value={formData.notes}
          onChange={(e) => handleInputChange("notes", e.target.value)}
          rows="3"
        />
      </div>
      {errors.submit && <div className="submit-error-box">{errors.submit}</div>}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleRequestClose}
      size="lg"
      className="employee-form-modal"
      showCloseButton={false}
    >
      <div className="modal-header-custom">
        <div className="header-text">
          <h2>{mode === "add" ? "Thêm Nhân Viên Mới" : "Cập Nhật Hồ Sơ"}</h2>
          <p>
            {mode === "add"
              ? "Tạo hồ sơ nhân viên cho FoodHub"
              : "Chỉnh sửa thông tin nhân viên"}
          </p>
        </div>
        <button
          type="button"
          className="close-btn"
          onClick={handleRequestClose}
        >
          ×
        </button>
      </div>

      {renderStepIndicator()}

      <form
        className="modal-form-container"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="modal-body-scroll">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        <div className="modal-footer-custom">
          <button
            type="button"
            className="btn btn-text"
            onClick={handleRequestClose}
            disabled={isSubmitting}
          >
            Hủy bỏ
          </button>
          <div className="footer-right">
            {currentStep > 1 && (
              <button
                type="button"
                className="btn btn-outlined"
                onClick={handlePrevStep}
                disabled={isSubmitting}
              >
                Quay lại
              </button>
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNextStep}
                disabled={isSubmitting}
              >
                Tiếp theo
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <LoadingSpinner size="small" color="white" />
                ) : mode === "add" ? (
                  "Hoàn tất"
                ) : (
                  "Lưu thay đổi"
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
