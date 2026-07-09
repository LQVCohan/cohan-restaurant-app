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
  DEPARTMENT_OPTIONS,
  getDefaultRoleByDepartment,
  getStaffRolesByDepartment,
} from "../../../../../../utils/staffRoleOptions";
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

const getDefaultRoleSlug = (department) =>
  getDefaultRoleByDepartment(department)?.slug || "";

const toDraftComparableForm = (
  value,
  fallbackStartDate,
  fallbackRestaurantId,
) => ({
  name: normalizeDraftText(value?.name),
  department: value?.department || "service",
  roleSlug:
    value?.roleSlug || getDefaultRoleSlug(value?.department || "service"),
  positionTitle: normalizeDraftText(value?.positionTitle ?? value?.role),
  address: normalizeDraftText(value?.address),
  salary: normalizeDraftText(value?.salary),
  shift: normalizeDraftText(value?.shift),
  startDate: value?.startDate || fallbackStartDate,
  emergencyRelation: normalizeDraftText(value?.emergencyRelation),
  notes: normalizeDraftText(value?.notes),
  restaurantId: value?.restaurantId || fallbackRestaurantId || "",
  userType: value?.userType || "STAFF",
  employmentType: value?.employmentType || "FULL_TIME",
});

const createBaselineForm = (fallbackStartDate, fallbackRestaurantId) =>
  toDraftComparableForm(
    {
      name: "",
      department: "service",
      roleSlug: getDefaultRoleSlug("service"),
      positionTitle: "",
      address: "",
      salary: "",
      shift: "",
      startDate: fallbackStartDate,
      emergencyRelation: "",
      notes: "",
      restaurantId: fallbackRestaurantId || "",
      userType: "STAFF",
      employmentType: "FULL_TIME",
    },
    fallbackStartDate,
    fallbackRestaurantId,
  );

const EmployeeFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  mode = "add",
  restaurantList = [],
  defaultRestaurantId = "",
  roleList = [],
  roleListLoading = false,
  roleListError = null,
}) => {
  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const { showNotification } = useNotification();

  const [formData, setFormData] = useState({
    name: "",
    department: "service",
    roleSlug: getDefaultRoleSlug("service"),
    positionTitle: getAiSuggestedPositionTitle(
      "service",
      getDefaultRoleSlug("service"),
    ),
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
    restaurantId: defaultRestaurantId || "",
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
  const [positionTitleSelectionSource, setPositionTitleSelectionSource] =
    useState("suggested");

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
    const defaultRoleSlug = getDefaultRoleSlug("service");
    setFormData({
      name: "",
      department: "service",
      roleSlug: defaultRoleSlug,
      positionTitle: getAiSuggestedPositionTitle("service", defaultRoleSlug),
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
      restaurantId: defaultRestaurantId || "",
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
    setPositionTitleSelectionSource("suggested");
  }, [defaultRestaurantId]);

  const baselineForm = useMemo(
    () => createBaselineForm(todayStr, defaultRestaurantId),
    [defaultRestaurantId, todayStr],
  );

  const comparableForm = useMemo(
    () => toDraftComparableForm(formData, todayStr, defaultRestaurantId),
    [defaultRestaurantId, formData, todayStr],
  );

  const autoSuggestedSalary = useMemo(
    () =>
      formatCurrencyDisplay(
        getSuggestedSalaryByEmploymentType(
          formData.employmentType,
          salaryReference,
        ),
      ),
    [formData.employmentType, salaryReference],
  );

  const availableRoleOptions = useMemo(
    () => getStaffRolesByDepartment(formData.department),
    [formData.department],
  );

  const roleRecordsBySlug = useMemo(() => {
    const map = {};
    roleList.forEach((role) => {
      if (role?.slug) map[role.slug.toLowerCase()] = role;
    });
    return map;
  }, [roleList]);

  const selectedRoleRecord =
    roleRecordsBySlug[String(formData.roleSlug || "").toLowerCase()] || null;

  const positionTitleSuggestion = useMemo(
    () => getAiSuggestedPositionTitle(formData.department, formData.roleSlug),
    [formData.department, formData.roleSlug],
  );

  const isDirty = useMemo(() => {
    const meaningfulForm = { ...comparableForm };

    if (
      !salaryManuallyEdited &&
      meaningfulForm.salary &&
      meaningfulForm.salary === normalizeDraftText(autoSuggestedSalary)
    ) {
      meaningfulForm.salary = baselineForm.salary;
    }

    if (
      positionTitleSelectionSource === "suggested" &&
      meaningfulForm.positionTitle &&
      meaningfulForm.positionTitle ===
        normalizeDraftText(positionTitleSuggestion)
    ) {
      meaningfulForm.positionTitle = baselineForm.positionTitle;
    }

    return JSON.stringify(meaningfulForm) !== JSON.stringify(baselineForm);
  }, [
    autoSuggestedSalary,
    baselineForm,
    comparableForm,
    positionTitleSelectionSource,
    positionTitleSuggestion,
    salaryManuallyEdited,
  ]);

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

  const {
    requestCloseWithDraft,
    clearDraft,
    pendingRestore,
    restorePendingDraft,
    discardPendingDraft,
  } = useModalDraft({
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
      schemaVersion: "3",
    },
    formValue: formData,
    isDirty,
    sanitize: (v) => {
      const normalized = toDraftComparableForm(
        v,
        todayStr,
        defaultRestaurantId,
      );
      const normalizedAutoSalary = normalizeDraftText(autoSuggestedSalary);
      const sanitized = { ...normalized };

      if (
        !salaryManuallyEdited &&
        sanitized.salary &&
        sanitized.salary === normalizedAutoSalary
      ) {
        sanitized.salary = baselineForm.salary;
      }

      if (
        positionTitleSelectionSource === "suggested" &&
        sanitized.positionTitle &&
        sanitized.positionTitle === normalizeDraftText(positionTitleSuggestion)
      ) {
        sanitized.positionTitle = baselineForm.positionTitle;
      }

      if (JSON.stringify(sanitized) === JSON.stringify(baselineForm)) {
        return null;
      }

      return sanitized;
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
      const restored = toDraftComparableForm(
        draft,
        todayStr,
        defaultRestaurantId,
      );
      const restoredSuggestion = getAiSuggestedPositionTitle(
        restored.department,
        restored.roleSlug,
      );
      setFormData((prev) => ({
        ...prev,
        ...restored,
        positionTitle: restored.positionTitle || restoredSuggestion,
      }));
      setShowSensitiveNotice(true);
      setPositionTitleSelectionSource(
        restored?.positionTitle ? "restored" : "suggested",
      );
      setSalaryManuallyEdited(Boolean(draft?.salary));
    },
    notify: showNotification,
  });

  const validateStep = (step) => {
    const newErrors = {};

    // --- STEP 1 ---
    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = "Vui lòng nhập họ tên";
      if (!formData.department) newErrors.department = "Vui lòng chọn bộ phận";
      if (!formData.roleSlug) {
        newErrors.roleSlug = "Vui lòng chọn vai trò";
      } else if (roleListLoading) {
        newErrors.roleSlug =
          "Danh sách vai trò chưa tải xong. Vui lòng thử lại sau vài giây.";
      } else if (roleListError || roleList.length === 0) {
        newErrors.roleSlug =
          "Vai trò đã chọn chưa được cấu hình hoặc bạn không có quyền tải danh sách. Vui lòng thử lại.";
      } else if (!selectedRoleRecord?.id) {
        newErrors.roleSlug =
          "Vai trò đã chọn chưa được cấu hình trong hệ thống, vui lòng chọn vai trò khác.";
      }
      if (!formData.positionTitle.trim())
        newErrors.positionTitle = "Vui lòng nhập tên hiển thị/chức danh";
      if (!formData.restaurantId)
        newErrors.restaurantId = "Chọn nhà hàng";
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

  const handleInputChange = (field, value, options = {}) => {
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
    if (field === "positionTitle") {
      setPositionTitleSelectionSource(
        options.source === "suggested" ? "suggested" : "manual",
      );
    }
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

  const handleDepartmentChange = (department) => {
    setFormData((prev) => {
      const rolesForDepartment = getStaffRolesByDepartment(department);
      const currentRoleStillValid = rolesForDepartment.some(
        (role) => role.slug === prev.roleSlug,
      );
      const nextRoleSlug = currentRoleStillValid
        ? prev.roleSlug
        : getDefaultRoleSlug(department);
      const previousSuggestion = getAiSuggestedPositionTitle(
        prev.department,
        prev.roleSlug,
      );
      const nextSuggestion = getAiSuggestedPositionTitle(
        department,
        nextRoleSlug,
      );
      const shouldUseSuggestion =
        !normalizeDraftText(prev.positionTitle) ||
        positionTitleSelectionSource === "suggested" ||
        normalizeDraftText(prev.positionTitle) ===
          normalizeDraftText(previousSuggestion);

      if (shouldUseSuggestion) {
        setPositionTitleSelectionSource("suggested");
      }

      return {
        ...prev,
        department,
        roleSlug: nextRoleSlug,
        positionTitle: shouldUseSuggestion
          ? nextSuggestion
          : prev.positionTitle,
      };
    });
    setErrors((prev) => ({
      ...prev,
      department: "",
      roleSlug: "",
      positionTitle: "",
    }));
  };

  const handleRoleSlugChange = (roleSlug) => {
    setFormData((prev) => {
      const previousSuggestion = getAiSuggestedPositionTitle(
        prev.department,
        prev.roleSlug,
      );
      const nextSuggestion = getAiSuggestedPositionTitle(
        prev.department,
        roleSlug,
      );
      const shouldUseSuggestion =
        !normalizeDraftText(prev.positionTitle) ||
        positionTitleSelectionSource === "suggested" ||
        normalizeDraftText(prev.positionTitle) ===
          normalizeDraftText(previousSuggestion);

      if (shouldUseSuggestion) {
        setPositionTitleSelectionSource("suggested");
      }

      return {
        ...prev,
        roleSlug,
        positionTitle: shouldUseSuggestion
          ? nextSuggestion
          : prev.positionTitle,
      };
    });
    setErrors((prev) => ({ ...prev, roleSlug: "", positionTitle: "" }));
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

  const applySuggestedPositionTitle = () => {
    if (!positionTitleSuggestion) return;
    handleInputChange("positionTitle", positionTitleSuggestion, {
      source: "suggested",
    });
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
    requestCloseWithDraft(() => onClose?.());
    return;
  };
  /*
    if (!isDirty) {
      onClose?.();
      return;
    }
    if (window.confirm("Dữ liệu chưa lưu sẽ bị mất. Thoát?")) onClose?.();
  };

  */

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

    if (
      formData.roleSlug &&
      (roleListLoading ||
        roleListError ||
        roleList.length === 0 ||
        !selectedRoleRecord?.id)
    ) {
      setErrors((prev) => ({
        ...prev,
        roleSlug: roleListLoading
          ? "Danh sách vai trò chưa tải xong. Vui lòng thử lại sau vài giây."
          : !selectedRoleRecord?.id && roleList.length > 0
            ? "Vai trò đã chọn chưa được cấu hình trong hệ thống, vui lòng chọn vai trò khác."
            : "Vai trò đã chọn chưa được cấu hình hoặc bạn không có quyền tải danh sách vai trò. Vui lòng thử lại.",
      }));
      setCurrentStep(1);
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
        roleId: selectedRoleRecord?.id || undefined,
        roleSlug: formData.roleSlug || undefined,
        positionTitle: formData.positionTitle.trim(),
        department: formData.department,
        restaurantId: formData.restaurantId || undefined,
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
      setErrors({
        submit: error?.message || "Có lỗi xảy ra. Vui lòng thử lại.",
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
        <p>Chọn bộ phận, vai trò con và tên hiển thị cho nhân viên</p>
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
            Nhà hàng chính <span className="req">*</span>
          </label>
          <select
            aria-label="Nhà hàng chính"
            className={`form-input form-select ${
              errors.restaurantId ? "error" : ""
            }`}
            value={formData.restaurantId}
            onChange={(e) =>
              handleInputChange("restaurantId", e.target.value)
            }
          >
            <option value="">-- Chọn nhà hàng --</option>
            {restaurantList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {errors.restaurantId && (
            <span className="error-msg">{errors.restaurantId}</span>
          )}
        </div>
      </div>

      <div className="form-group mt-2">
        <label className="form-label">
          Bộ phận <span className="req">*</span>
        </label>
        <div className="department-grid">
          {DEPARTMENT_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={`dept-card ${
                formData.department === option.value ? "active" : ""
              }`}
              onClick={() => handleDepartmentChange(option.value)}
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

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">
            Vai trò <span className="req">*</span>
          </label>
          <select
            aria-label="Vai trò"
            className={`form-input form-select ${errors.roleSlug ? "error" : ""}`}
            value={formData.roleSlug}
            onChange={(e) => handleRoleSlugChange(e.target.value)}
          >
            <option value="">-- Chọn vai trò --</option>
            {availableRoleOptions.map((role) => (
              <option key={role.slug} value={role.slug}>
                {role.name} - {role.label}
              </option>
            ))}
          </select>
          {errors.roleSlug && (
            <span className="error-msg">{errors.roleSlug}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            Tên hiển thị / Chức danh <span className="req">*</span>
          </label>
          <div className="hint-text">{AI_POSITION_HINT}</div>
          <input
            type="text"
            className={`form-input ${errors.positionTitle ? "error" : ""}`}
            value={formData.positionTitle}
            onChange={(e) => handleInputChange("positionTitle", e.target.value)}
            placeholder="VD: Nhân viên phục vụ"
          />
          {positionTitleSuggestion && (
            <div className="hint-text">
              Gợi ý: <b>{positionTitleSuggestion}</b>{" "}
              <button
                type="button"
                className="btn btn-text"
                onClick={applySuggestedPositionTitle}
              >
                Dùng gợi ý
              </button>
            </div>
          )}
          {errors.positionTitle && (
            <span className="error-msg">{errors.positionTitle}</span>
          )}
        </div>
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
      onClose={handleRequestClose}
      size="lg"
      className="employee-form-modal"
      closeOnOverlayClick={false}
      closeOnEscape={false}
      showCloseButton={false}
    >
      {pendingRestore && (
        <div className="draft-restore-banner">
          <span>Có dữ liệu nhân viên nhập dở. Khôi phục?</span>
          <div className="draft-restore-actions">
            <button type="button" onClick={restorePendingDraft}>
              Khôi phục
            </button>
            <button type="button" onClick={discardPendingDraft}>
              Bỏ qua
            </button>
          </div>
        </div>
      )}
      <div className="modal-header-custom">
        <div className="header-text">
          <h2>{mode === "add" ? "Thêm Nhân Viên Mới" : "Cập Nhật Hồ Sơ"}</h2>
          <p>
            {mode === "add"
              ? "Tạo hồ sơ nhân viên cho Cohan"
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
