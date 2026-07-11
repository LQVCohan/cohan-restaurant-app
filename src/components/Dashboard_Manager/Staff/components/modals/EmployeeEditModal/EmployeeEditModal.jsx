import React, { useState, useEffect, useMemo } from "react";
import Modal from "../../../../../common/Modal";
import LoadingSpinner from "../../../../../common/LoadingSpinner";
import Badge from "../../../../../common/Badge";
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
import "./EmployeeEditModal.scss";

const normalizeDraftText = (value) => String(value || "").trim();

const getDefaultRoleSlug = (department) =>
  getDefaultRoleByDepartment(department)?.slug || "";

const EmployeeEditModal = ({
  isOpen,
  onClose,
  employee,
  onSubmit,
  onUpdate,
  roleList = [],
  roleListLoading = false,
  roleListError = null,
}) => {
  const { showNotification } = useNotification();
  const [formData, setFormData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [salaryReference, setSalaryReference] = useState(null);
  const [salaryReferenceLoading, setSalaryReferenceLoading] = useState(false);
  const [salaryManuallyEdited, setSalaryManuallyEdited] = useState(false);
  const [positionTitleSelectionSource, setPositionTitleSelectionSource] =
    useState("restored");

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
      const department = source.department || employee.department || "service";
      const roleSlug = source.role?.slug || getDefaultRoleSlug(department);
      const data = {
        fullName: source.fullName || employee.name || "",
        positionTitle: source.positionTitle || employee.role || "",
        department,
        roleSlug,
        phone: source.phone || employee.phone || "",
        email: source.email || employee.email || "",
        address: source.address?.line1 || employee.address || "",
        baseSalary: source.baseSalary || employee.salary || "",
        salaryType: String(
          source.salaryType || employee.salaryType || "monthly",
        ).toUpperCase(),
        hourlyRate: source.hourlyRate
          ? formatCurrencyDisplay(source.hourlyRate)
          : "",
        commissionRate:
          source.commissionRate !== undefined && source.commissionRate !== null
            ? String(source.commissionRate)
            : "",
        shiftType: source.shiftType || employee.shift || "",
        dateJoined: formatDateInput(source.dateJoined || employee.startDate),
        employmentStatus: source.employmentStatus || "WORKING",
        employmentType: source.employmentType || "FULL_TIME",
        emergencyContact: source.emergencyContact?.name || "",
        emergencyPhone: source.emergencyContact?.phone || "",
        notes: source.noteInternal || "",
      };
      setFormData(data);
      setOriginalData(data);
      setHasChanges(false);
      setActiveTab("basic");
      setSalaryManuallyEdited(false);
      setPositionTitleSelectionSource(
        source.positionTitle || employee.role ? "restored" : "suggested",
      );
    }
  }, [employee, isOpen]);

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

  useEffect(() => {
    const changed = JSON.stringify(formData) !== JSON.stringify(originalData);
    setHasChanges(changed);
  }, [formData, originalData]);

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen && !!employee,
    draftIdentity: {
      module: "staff",
      modal: "employee-edit-modal",
      route:
        typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "edit",
      entityType: "employee",
      recordId: employee?.id || employee?._id || employee?.raw?.id || null,
      context: "staff-management",
      schemaVersion: "2",
    },
    formValue: formData,
    isDirty: hasChanges,
    sanitize: (v) => ({
      fullName: v?.fullName || "",
      positionTitle: v?.positionTitle || "",
      department: v?.department || "service",
      roleSlug: v?.roleSlug || getDefaultRoleSlug(v?.department || "service"),
      employmentType: v?.employmentType || "FULL_TIME",
      baseSalary: v?.baseSalary || "",
      salaryType: v?.salaryType || "MONTHLY",
      hourlyRate: v?.hourlyRate || "",
      commissionRate: v?.commissionRate || "",
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

    if (
      field === "baseSalary" ||
      field === "hourlyRate" ||
      field === "commissionRate"
    ) {
      setSalaryManuallyEdited(true);
    }
    if (field === "positionTitle") setPositionTitleSelectionSource("manual");
    if (field === "employmentType" && formData.salaryType === "MONTHLY") {
      const suggested = getSuggestedSalaryByEmploymentType(
        value,
        salaryReference,
      );
      if (
        !salaryManuallyEdited ||
        !parseCurrencyInputToNumber(formData.baseSalary)
      ) {
        setFormData((prev) => ({
          ...prev,
          baseSalary: suggested ? formatCurrencyDisplay(suggested) : "",
        }));
      }
    }
  };

  useEffect(() => {
    if (!isOpen || !salaryReference || formData.salaryType !== "MONTHLY") return;
    if (parseCurrencyInputToNumber(formData.baseSalary) > 0) return;
    const suggested = getSuggestedSalaryByEmploymentType(
      formData.employmentType,
      salaryReference,
    );
    if (!suggested) return;
    setFormData((prev) => ({
      ...prev,
      baseSalary: formatCurrencyDisplay(suggested),
    }));
  }, [
    formData.baseSalary,
    formData.employmentType,
    formData.salaryType,
    isOpen,
    salaryReference,
  ]);

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

  const displayedRoleOptions = useMemo(() => {
    if (
      !selectedRoleRecord ||
      availableRoleOptions.some((role) => role.slug === selectedRoleRecord.slug)
    ) {
      return availableRoleOptions;
    }
    return [
      ...availableRoleOptions,
      {
        slug: selectedRoleRecord.slug,
        name: selectedRoleRecord.name,
        label: selectedRoleRecord.name,
      },
    ];
  }, [availableRoleOptions, selectedRoleRecord]);

  const positionTitleSuggestion = useMemo(
    () => getAiSuggestedPositionTitle(formData.department, formData.roleSlug),
    [formData.department, formData.roleSlug],
  );

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

      if (shouldUseSuggestion) setPositionTitleSelectionSource("suggested");

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

      if (shouldUseSuggestion) setPositionTitleSelectionSource("suggested");

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

  const applySuggestedPositionTitle = () => {
    if (!positionTitleSuggestion) return;
    setPositionTitleSelectionSource("suggested");
    setFormData((prev) => ({
      ...prev,
      positionTitle: positionTitleSuggestion,
    }));
    setErrors((prev) => ({ ...prev, positionTitle: "" }));
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
        phone: phoneLooksValid(value) ? "" : "Số điện thoại không hợp lệ",
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

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName?.trim()) newErrors.fullName = "Vui lòng nhập họ tên";
    if (!formData.department) newErrors.department = "Vui lòng chọn bộ phận";
    if (!formData.roleSlug) newErrors.roleSlug = "Vui lòng chọn vai trò";
    const roleChanged = Boolean(
      formData.roleSlug && formData.roleSlug !== originalData.roleSlug,
    );

    if (roleChanged && roleListLoading) {
      newErrors.roleSlug =
        "Danh sách vai trò chưa tải xong. Vui lòng thử lại sau vài giây.";
    } else if (roleChanged && (roleListError || roleList.length === 0)) {
      newErrors.roleSlug =
        "Vai trò đã chọn chưa được cấu hình hoặc bạn không có quyền tải danh sách vai trò. Vui lòng thử lại.";
    } else if (roleChanged && !selectedRoleRecord?.id) {
      newErrors.roleSlug =
        "Vai trò đã chọn chưa được cấu hình trong hệ thống, vui lòng chọn vai trò khác.";
    }
    if (!formData.positionTitle?.trim())
      newErrors.positionTitle = "Vui lòng nhập tên hiển thị/chức danh";

    const hasPhone = formData.phone?.trim();
    const hasEmail = formData.email?.trim();
    if (!hasPhone && !hasEmail) {
      newErrors.phone = "Nhập số điện thoại hoặc email liên hệ";
      newErrors.email = "Nhập số điện thoại hoặc email liên hệ";
    }
    if (hasPhone && !phoneLooksValid(formData.phone)) {
      newErrors.phone = "Số điện thoại không hợp lệ";
    }
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

    const salaryType = String(formData.salaryType || "MONTHLY").toUpperCase();
    const baseSalary = parseCurrencyInputToNumber(formData.baseSalary);
    const hourlyRate = parseCurrencyInputToNumber(formData.hourlyRate);
    const commissionRate = Number(formData.commissionRate || 0);
    if (salaryType === "MONTHLY" && baseSalary <= 0) {
      newErrors.baseSalary = "Cần nhập lương tháng cho loại lương tháng.";
    }
    if (["HOURLY", "SHIFT"].includes(salaryType) && hourlyRate <= 0) {
      newErrors.hourlyRate =
        salaryType === "SHIFT"
          ? "Cần nhập mức tiền mỗi ca."
          : "Cần nhập mức tiền mỗi giờ.";
    }
    if (
      salaryType === "COMMISSION" &&
      (!Number.isFinite(commissionRate) ||
        commissionRate <= 0 ||
        commissionRate > 100)
    ) {
      newErrors.commissionRate =
        "Tỷ lệ hoa hồng phải lớn hơn 0 và không vượt quá 100%.";
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
      const hourlyRate = formData.hourlyRate
        ? Number(formData.hourlyRate.toString().replace(/[^\d]/g, ""))
        : undefined;
      const commissionRate = formData.commissionRate
        ? Number(formData.commissionRate)
        : undefined;

      const roleChanged = Boolean(
        formData.roleSlug && formData.roleSlug !== originalData.roleSlug,
      );

      const payload = {
        fullName: formData.fullName.trim(),
        roleId: roleChanged ? selectedRoleRecord?.id || undefined : undefined,
        roleSlug: roleChanged ? formData.roleSlug || undefined : undefined,
        positionTitle: formData.positionTitle.trim(),
        department: formData.department,
        employmentType: formData.employmentType || undefined,
        salaryType: formData.salaryType || undefined,
        hourlyRate,
        commissionRate,
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
      showNotification(
        "Đã xóa dữ liệu nháp sau khi cập nhật.",
        "success",
        2200,
      );
      setOriginalData(formData);
      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error("Error updating employee:", error);
      setErrors({
        submit:
          error?.message || "Có lỗi xảy ra khi cập nhật. Vui lòng thử lại.",
      });
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
            variant={
              formData.employmentStatus === "WORKING" ? "success" : "danger"
            }
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
          <label className="form-label">Bộ phận *</label>
          <select
            className={`form-select ${errors.department ? "error" : ""}`}
            value={formData.department || "service"}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            disabled={isSubmitting}
          >
            {DEPARTMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.department && (
            <div className="error-message">{errors.department}</div>
          )}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Vai trò *</label>
          <select
            className={`form-select ${errors.roleSlug ? "error" : ""}`}
            value={formData.roleSlug || ""}
            onChange={(e) => handleRoleSlugChange(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="">-- Chọn vai trò --</option>
            {displayedRoleOptions.map((role) => (
              <option key={role.slug} value={role.slug}>
                {role.name} - {role.label}
              </option>
            ))}
          </select>
          {errors.roleSlug && (
            <div className="error-message">{errors.roleSlug}</div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Tên hiển thị / Chức danh *</label>
          <div className="form-help-text">{AI_POSITION_HINT}</div>
          <input
            type="text"
            className={`form-input ${errors.positionTitle ? "error" : ""}`}
            value={formData.positionTitle || ""}
            onChange={(e) => handleInputChange("positionTitle", e.target.value)}
            placeholder="VD: Nhân viên phục vụ"
            disabled={isSubmitting}
          />
          {positionTitleSuggestion && (
            <div className="form-help-text">
              Gợi ý A.I: <strong>{positionTitleSuggestion}</strong>{" "}
              <button
                type="button"
                className="suggestion-btn"
                onClick={applySuggestedPositionTitle}
                disabled={isSubmitting}
              >
                Dùng gợi ý
              </button>
            </div>
          )}
          {errors.positionTitle && (
            <div className="error-message">{errors.positionTitle}</div>
          )}
        </div>
      </div>

      <div className="form-row">
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
            onBlur={() => validateContactFieldOnBlur("phone")}
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
            onBlur={() => validateContactFieldOnBlur("email")}
            placeholder="email@cohan.vn"
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
              onBlur={handleEmergencyNameBlur}
              placeholder="Tên người thân"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Số điện thoại khẩn cấp</label>
            <input
              type="tel"
              className={`form-input ${errors.emergencyPhone ? "error" : ""}`}
              value={formData.emergencyPhone || ""}
              onChange={(e) =>
                handleInputChange("emergencyPhone", e.target.value)
              }
              onBlur={validateEmergencyPhoneOnBlur}
              placeholder="0901234567"
              disabled={isSubmitting}
            />
            {errors.emergencyPhone && (
              <div className="error-message">{errors.emergencyPhone}</div>
            )}
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
            {formatCurrencyDisplay(formData.baseSalary) || "Chưa thiết lập"}
          </div>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Loại hợp đồng</label>
        <select
          className="form-select"
          value={formData.employmentType || "FULL_TIME"}
          onChange={(e) => handleInputChange("employmentType", e.target.value)}
          disabled={isSubmitting}
        >
          <option value="FULL_TIME">Toàn thời gian</option>
          <option value="PART_TIME">Bán thời gian</option>
          <option value="PROBATION">Thử việc</option>
          <option value="SEASONAL">Thời vụ</option>
          <option value="CONTRACT">Hợp đồng</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Cách tính lương</label>
        <select
          className="form-select"
          value={formData.salaryType || "MONTHLY"}
          onChange={(e) => handleInputChange("salaryType", e.target.value)}
          disabled={isSubmitting}
        >
          <option value="MONTHLY">Theo tháng</option>
          <option value="HOURLY">Theo giờ</option>
          <option value="SHIFT">Theo ca</option>
          <option value="COMMISSION">Theo hoa hồng</option>
        </select>
      </div>

      {formData.salaryType === "MONTHLY" && (
        <div className="form-group">
          <label className="form-label">Mức lương cơ bản</label>
          <div className="salary-input-group">
            <input
              type="text"
              className="form-input"
              value={formData.baseSalary || ""}
              onChange={(e) =>
                handleInputChange(
                  "baseSalary",
                  formatCurrencyDisplay(
                    parseCurrencyInputToNumber(e.target.value),
                  ),
                )
              }
              placeholder="8000000"
              disabled={isSubmitting}
            />
            <span className="salary-currency">VNĐ</span>
          </div>
          <div className="salary-note">
            💡 Lương cơ bản chưa bao gồm thưởng và phụ cấp
          </div>
          {errors.baseSalary ? (
            <div className="salary-note">{errors.baseSalary}</div>
          ) : null}
        </div>
      )}

      {["HOURLY", "SHIFT"].includes(formData.salaryType) ? (
        <div className="form-group">
          <label className="form-label">
            {formData.salaryType === "SHIFT"
              ? "Mức tiền mỗi ca"
              : "Mức tiền mỗi giờ"}
          </label>
          <div className="salary-input-group">
            <input
              type="text"
              className="form-input"
              value={formData.hourlyRate || ""}
              onChange={(e) =>
                handleInputChange(
                  "hourlyRate",
                  formatCurrencyDisplay(
                    parseCurrencyInputToNumber(e.target.value),
                  ),
                )
              }
              placeholder="0"
              disabled={isSubmitting}
            />
            <span className="salary-currency">VNĐ</span>
          </div>
          {errors.hourlyRate ? (
            <div className="salary-note">{errors.hourlyRate}</div>
          ) : null}
        </div>
      ) : null}

      {formData.salaryType === "COMMISSION" ? (
        <div className="form-group">
          <label className="form-label">Tỷ lệ hoa hồng</label>
          <div className="salary-input-group">
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              className="form-input"
              value={formData.commissionRate || ""}
              onChange={(e) =>
                handleInputChange("commissionRate", e.target.value)
              }
              placeholder="5"
              disabled={isSubmitting}
            />
            <span className="salary-currency">%</span>
          </div>
          {errors.commissionRate ? (
            <div className="salary-note">{errors.commissionRate}</div>
          ) : null}
        </div>
      ) : null}
      <div className="salary-note">
        {salaryReferenceLoading
          ? "Đang tải mức lương tham khảo từ nguồn văn bản nhà nước..."
          : `Mức tham khảo: ${formatCurrencyDisplay(
              getSuggestedSalaryByEmploymentType(
                formData.employmentType,
                salaryReference,
              ),
            )} VNĐ. Bạn có thể chỉnh sửa thủ công.`}
      </div>
      {salaryReference && (
        <div className="salary-note">
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
          {!salaryReference.isLive && (
            <>
              {" "}
              · Đang dùng fallback tham chiếu khi chưa fetch được nguồn live.
            </>
          )}
        </div>
      )}
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
