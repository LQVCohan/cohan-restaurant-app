// src/pages/StaffManagement/components/modals/EmployeeFormModal.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import Modal from "../../../../../common/Modal";
import LoadingSpinner from "../../../../../common/LoadingSpinner";
import useModalDraft from "../../../../../../hooks/useModalDraft";
import { useNotification } from "../../../../../../hooks/useNotification";
import {
  AI_POSITION_HINT,
  getAiSuggestedPositionTitle,
} from "../../../../../../utils/staffRoleSuggestion";
import {
  emailLooksValid,
  getEmergencyPhoneError,
  normalizeContactName,
  phoneLooksValid,
} from "../../../../../../utils/contactValidation";
import {
  formatCurrencyDisplay,
  getLegalSalaryReference,
  getSuggestedSalaryByEmploymentType,
  parseCurrencyInputToNumber,
} from "../../../../../../utils/legalSalaryReference";
import "./EmployeeFormModal.scss";

const normalizeDraftText = (value) => String(value || "").trim();

const toDraftComparableForm = (value, fallbackStartDate, fallbackRestaurantId) => ({
  name: normalizeDraftText(value?.name),
  role: normalizeDraftText(value?.role),
  department: value?.department || "service",
  address: normalizeDraftText(value?.address),
  salary: normalizeDraftText(value?.salary),
  shift: normalizeDraftText(value?.shift),
  startDate: value?.startDate || fallbackStartDate,
  emergencyRelation: normalizeDraftText(value?.emergencyRelation),
  notes: normalizeDraftText(value?.notes),
  primaryRestaurantId: value?.primaryRestaurantId || fallbackRestaurantId || "",
  userType: value?.userType || "STAFF",
  employmentType: value?.employmentType || "FULL_TIME",
});

const EmployeeFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  mode = "add",
  restaurantList = [],
  defaultRestaurantId = "",
}) => {
  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const { showNotification } = useNotification();

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
    userType: "STAFF",
    employmentType: "FULL_TIME",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSensitiveNotice, setShowSensitiveNotice] = useState(false);
  const [salaryReference, setSalaryReference] = useState(null);
  const [salaryReferenceLoading, setSalaryReferenceLoading] = useState(false);
  const [salaryManuallyEdited, setSalaryManuallyEdited] = useState(false);

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

  const userTypeOptions = [{ value: "STAFF", label: "Nhân viên", icon: "👤" }];

  const employmentTypeOptions = [
    { value: "FULL_TIME", label: "Toàn thời gian" },
    { value: "PART_TIME", label: "Bán thời gian" },
    { value: "PROBATION", label: "Thử việc" },
    { value: "SEASONAL", label: "Thời vụ" },
    { value: "CONTRACT", label: "Hợp đồng" },
  ];

  const resetForm = useCallback(() => {
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
      userType: "STAFF",
      employmentType: "FULL_TIME",
      password: "",
      confirmPassword: "",
    });
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowSensitiveNotice(false);
    setSalaryManuallyEdited(false);
  }, [defaultRestaurantId]);

  const baselineForm = useMemo(
    () =>
      toDraftComparableForm(
        {
          name: "",
          role: "",
          department: "service",
          address: "",
          salary: "",
          shift: "",
          startDate: todayStr,
          emergencyRelation: "",
          notes: "",
          primaryRestaurantId: defaultRestaurantId || "",
          userType: "STAFF",
          employmentType: "FULL_TIME",
        },
        todayStr,
        defaultRestaurantId,
      ),
    [defaultRestaurantId, todayStr],
  );

  const comparableForm = useMemo(
    () => toDraftComparableForm(formData, todayStr, defaultRestaurantId),
    [defaultRestaurantId, formData, todayStr],
  );

  const isDirty = useMemo(
    () => JSON.stringify(comparableForm) !== JSON.stringify(baselineForm),
    [baselineForm, comparableForm],
  );

  useEffect(() => {
    if (isOpen && mode === "add") {
      resetForm();
      setCurrentStep(1);
    }
  }, [isOpen, mode, resetForm]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setSalaryReferenceLoading(true);
    getLegalSalaryReference()
      .then((ref) => {
        if (!cancelled) setSalaryReference(ref);
      })
      .finally(() => {
        if (!cancelled) setSalaryReferenceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen && mode === "add",
    draftIdentity: {
      module: "staff",
      modal: "employee-form-modal",
      route:
        typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "create",
      entityType: "employee",
      recordId: null,
      context: defaultRestaurantId || "default",
      schemaVersion: "2",
    },
    formValue: formData,
    isDirty,
    sanitize: (v) => {
      const normalized = toDraftComparableForm(v, todayStr, defaultRestaurantId);
      return JSON.stringify(normalized) === JSON.stringify(baselineForm)
        ? null
        : normalized;
    },
    canRestoreDraft: (draft) => {
      const restored = toDraftComparableForm(
        draft,
        todayStr,
        defaultRestaurantId,
      );
      return JSON.stringify(restored) !== JSON.stringify(baselineForm);
    },
    onRestore: (draft) => {
      setFormData((prev) => ({ ...prev, ...draft }));
      setShowSensitiveNotice(true);
    },
    notify: showNotification,
  });

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
      if (hasPhone && !phoneLooksValid(formData.phone)) {
        newErrors.phone = "SĐT không hợp lệ";
      }

      // Nếu nhập email thì kiểm tra định dạng
      if (hasEmail && !emailLooksValid(formData.email)) {
        newErrors.email = "Email không hợp lệ";
      }

      const emergencyPhoneError = getEmergencyPhoneError({
        emergencyName: formData.emergencyContact,
        emergencyPhone: formData.emergencyPhone,
        requiredMessage: "Vui lòng nhập số điện thoại liên hệ khẩn cấp.",
        invalidMessage: "Số điện thoại liên hệ khẩn cấp không hợp lệ.",
      });
      if (emergencyPhoneError) {
        newErrors.emergencyPhone = emergencyPhoneError;
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
    setErrors((prev) => {
      const next = { ...prev };
      if (next[field]) next[field] = "";
      if (
        field === "emergencyContact" &&
        !normalizeContactName(value) &&
        !String(formData.emergencyPhone || "").trim()
      ) {
        next.emergencyPhone = "";
      }
      return next;
    });

    if (field === "salary") setSalaryManuallyEdited(true);
    if (field === "employmentType") {
      const suggested = getSuggestedSalaryByEmploymentType(
        value,
        salaryReference,
      );
      if (
        !salaryManuallyEdited ||
        !parseCurrencyInputToNumber(formData.salary)
      ) {
        setFormData((prev) => ({
          ...prev,
          salary: suggested ? formatCurrencyDisplay(suggested) : "",
        }));
      }
    }
  };

  useEffect(() => {
    if (!isOpen || !salaryReference) return;
    if (parseCurrencyInputToNumber(formData.salary) > 0) return;
    const suggested = getSuggestedSalaryByEmploymentType(
      formData.employmentType,
      salaryReference,
    );
    if (!suggested) return;
    setFormData((prev) => ({
      ...prev,
      salary: formatCurrencyDisplay(suggested),
    }));
  }, [formData.employmentType, formData.salary, isOpen, salaryReference]);

  const roleSuggestion = useMemo(
    () => getAiSuggestedPositionTitle(formData.department),
    [formData.department],
  );

  const applySuggestedRole = () => {
    if (!roleSuggestion) return;
    handleInputChange("role", roleSuggestion);
  };

  const validateContactFieldOnBlur = (field) => {
    const value = formData[field] || "";
    const trimmed = value.trim();

    if (!trimmed) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
      return;
    }

    if (field === "phone") {
      setErrors((prev) => ({
        ...prev,
        phone: phoneLooksValid(value) ? "" : "SĐT không hợp lệ",
      }));
      return;
    }

    if (field === "email") {
      setErrors((prev) => ({
        ...prev,
        email: emailLooksValid(value) ? "" : "Email không hợp lệ",
      }));
    }
  };

  const validateEmergencyPhoneOnBlur = () => {
    const emergencyPhoneError = getEmergencyPhoneError({
      emergencyName: formData.emergencyContact,
      emergencyPhone: formData.emergencyPhone,
      requiredMessage: "Vui lòng nhập số điện thoại liên hệ khẩn cấp.",
      invalidMessage: "Số điện thoại liên hệ khẩn cấp không hợp lệ.",
    });
    setErrors((prev) => ({
      ...prev,
      emergencyPhone: emergencyPhoneError,
    }));
  };

  const handleEmergencyNameBlur = () => {
    const normalizedName = normalizeContactName(formData.emergencyContact);
    if (!normalizedName) return;
    validateEmergencyPhoneOnBlur();
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
      clearDraft();
      showNotification(
        "Đã xóa dữ liệu nháp sau khi tạo nhân viên.",
        "success",
        2200,
      );
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
          <div className="hint-text">{AI_POSITION_HINT}</div>
          <input
            type="text"
            className={`form-input ${errors.role ? "error" : ""}`}
            value={formData.role}
            onChange={(e) => handleInputChange("role", e.target.value)}
            placeholder="VD: Quản lý kho"
          />
          {roleSuggestion && (
            <div className="hint-text">
              Gợi ý: <b>{roleSuggestion}</b>{" "}
              <button
                type="button"
                className="btn btn-text"
                onClick={applySuggestedRole}
              >
                Dùng gợi ý
              </button>
            </div>
          )}
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
            onBlur={() => validateContactFieldOnBlur("phone")}
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
            onBlur={() => validateContactFieldOnBlur("email")}
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
              onBlur={handleEmergencyNameBlur}
            />
          </div>
          <div className="form-group">
            <label className="sub-label">Số điện thoại</label>
            <input
              type="tel"
              className={`form-input ${errors.emergencyPhone ? "error" : ""}`}
              value={formData.emergencyPhone}
              onChange={(e) =>
                handleInputChange("emergencyPhone", e.target.value)
              }
              onBlur={validateEmergencyPhoneOnBlur}
            />
            {errors.emergencyPhone && (
              <span className="error-msg">{errors.emergencyPhone}</span>
            )}
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
            onChange={(e) =>
              handleInputChange(
                "salary",
                formatCurrencyDisplay(
                  parseCurrencyInputToNumber(e.target.value),
                ),
              )
            }
            placeholder="0"
          />
          <span className="currency-badge">VNĐ</span>
        </div>
        <p className="hint-text">Chưa bao gồm phụ cấp & thưởng.</p>
        <p className="hint-text">
          {salaryReferenceLoading
            ? "Đang tải mức lương tham khảo từ nguồn văn bản nhà nước..."
            : `Mức tham khảo: ${formatCurrencyDisplay(
                getSuggestedSalaryByEmploymentType(
                  formData.employmentType,
                  salaryReference,
                ),
              )} VNĐ (${formData.employmentType === "PART_TIME" ? "quy đổi từ mức giờ tối thiểu" : "mức tháng tối thiểu"}). Bạn có thể chỉnh sửa thủ công.`}
        </p>
        {salaryReference && (
          <p className="hint-text">
            Nguồn: {salaryReference.decreeName} ({salaryReference.year}) ·{" "}
            <a
              href={salaryReference.decreeUrl}
              target="_blank"
              rel="noreferrer"
            >
              văn bản
            </a>{" "}
            ·{" "}
            <a
              href={salaryReference.articleUrl}
              target="_blank"
              rel="noreferrer"
            >
              cổng công bố
            </a>
            {formData.employmentType === "PROBATION" && (
              <>
                {" "}
                · Quy tắc thử việc 85%:{" "}
                <a
                  href={salaryReference.probationRuleUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Bộ luật Lao động
                </a>
              </>
            )}
            {!salaryReference.isLive && (
              <>
                {" "}
                · Đang dùng fallback tham chiếu khi chưa fetch được nguồn live.
              </>
            )}
          </p>
        )}
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
      onClose={() => requestCloseWithDraft(handleRequestClose)}
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
          onClick={() => requestCloseWithDraft(handleRequestClose)}
        >
          ×
        </button>
      </div>
      {showSensitiveNotice && (
        <div className="submit-error-box">
          Một số trường nhạy cảm (SĐT, email, mật khẩu, liên hệ khẩn cấp) không
          được khôi phục tự động.
        </div>
      )}

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
            onClick={() => requestCloseWithDraft(handleRequestClose)}
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
