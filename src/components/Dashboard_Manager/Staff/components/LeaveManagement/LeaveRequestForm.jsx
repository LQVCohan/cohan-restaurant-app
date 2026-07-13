import React, { useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import { matchesEmployeeSearch } from "../../../../../utils/employeeSearch";
import { isForbiddenError, isUnauthenticatedError } from "@/utils/graphqlErrorUtils";
import "./LeaveRequestForm.scss";

const leaveTypes = [
  { value: "ANNUAL", label: "Nghỉ năm", icon: "🏖️" },
  { value: "SICK", label: "Nghỉ bệnh", icon: "🤒" },
  { value: "UNPAID", label: "Nghỉ không lương", icon: "💸" },
  { value: "PAID_PERSONAL", label: "Nghỉ việc riêng có lương", icon: "👪" },
  { value: "MATERNITY", label: "Nghỉ thai sản", icon: "🤱" },
  { value: "COMPENSATORY", label: "Nghỉ bù", icon: "🔁" },
  { value: "HOLIDAY", label: "Nghỉ lễ/tết", icon: "🎉" },
  { value: "HALF_DAY", label: "Nghỉ nửa ngày", icon: "🌗" },
];

const wizardSteps = [
  { id: 1, label: "Loại nghỉ" },
  { id: 2, label: "Thời gian" },
  { id: 3, label: "Kiểm tra & gửi" },
];

const sessionLabels = {
  FULL: "Cả ngày",
  MORNING: "Buổi sáng",
  AFTERNOON: "Buổi chiều",
};

const initialFormData = {
  employee: "",
  leaveType: "",
  startDate: "",
  startSession: "FULL",
  endDate: "",
  endSession: "FULL",
  reason: "",
};

const resolveRoleCandidate = (user) => {
  if (!user || typeof user !== "object") return "";
  if (typeof user.role === "object") {
    return user.role.slug || user.role.name || user.role.code || "";
  }
  return user.roleName || user.role || user.userType || "";
};

const formatDate = (value) => {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : "Chưa chọn";
};

const getSubmitErrorMessage = (error) => {
  if (isForbiddenError(error)) {
    return "Bạn không có quyền tạo đơn nghỉ phép cho nhân sự này.";
  }
  if (isUnauthenticatedError(error)) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.";
  }
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("datetime") || message.includes("date range")) {
    return "Thời gian nghỉ chưa hợp lệ. Vui lòng kiểm tra lại ngày bắt đầu và kết thúc.";
  }
  return "Chưa thể tạo đơn nghỉ phép. Vui lòng thử lại sau ít phút.";
};

const LeaveRequestForm = ({
  onSubmit,
  staffList = [],
  restaurantId = "",
  disabled = false,
  loading = false,
  error = null,
  selfServiceEmployeeId = "",
  compact = false,
  stepByStep = false,
  title = "Tạo đơn xin nghỉ phép",
  subtitle = "",
  submitLabel = "Gửi đơn",
  onCancel,
  onSubmitted,
}) => {
  const authContext = React.useContext(AuthContext) || {};
  const user = authContext.user;
  const roleCandidate = resolveRoleCandidate(user);
  const normalizedRole = String(roleCandidate || "").toLowerCase();
  const isStaffSelfService =
    Boolean(selfServiceEmployeeId) ||
    String(user?.userType || "").toUpperCase() === "STAFF" ||
    normalizedRole === "staff";
  const currentUserId = selfServiceEmployeeId || user?.id || user?._id || user?.userId || "";
  const [formData, setFormData] = useState(() => ({
    ...initialFormData,
    employee: isStaffSelfService ? currentUserId : "",
  }));
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [errors, setErrors] = useState({});
  const [submitFeedback, setSubmitFeedback] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const stepHeadingRef = useRef(null);

  const selectedEmployee = useMemo(
    () => staffList.find((item) => String(item.id) === String(formData.employee)),
    [formData.employee, staffList],
  );
  const selectedLeaveType = useMemo(
    () => leaveTypes.find((item) => item.value === formData.leaveType),
    [formData.leaveType],
  );

  useEffect(() => {
    if (!isStaffSelfService || !currentUserId || formData.employee) return;
    const selfInList = staffList.find((item) => String(item.id) === String(currentUserId));
    if (selfInList) {
      setFormData((prev) => ({ ...prev, employee: selfInList.id }));
    }
  }, [currentUserId, formData.employee, isStaffSelfService, staffList]);

  useEffect(() => {
    if (stepByStep) stepHeadingRef.current?.focus();
  }, [currentStep, stepByStep]);

  const filteredStaffList = useMemo(() => {
    const matched = staffList.filter((item) => matchesEmployeeSearch(item, employeeSearch));
    if (selectedEmployee && !matched.some((item) => item.id === selectedEmployee.id)) {
      return [selectedEmployee, ...matched];
    }
    return matched;
  }, [employeeSearch, selectedEmployee, staffList]);

  const hasStaffList = staffList.length > 0;
  const hasEmployeeMatches = filteredStaffList.length > 0;

  const totalDays = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return 0;
    if (formData.leaveType === "HALF_DAY") return 0.5;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (end < start) return 0;
    let days = (end - start) / (1000 * 60 * 60 * 24) + 1;
    if (formData.startSession !== "FULL") days -= 0.5;
    if (formData.endSession !== "FULL" && days > 0.5) days -= 0.5;
    return Math.max(days, 0);
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleEmployeeSearchChange = (e) => {
    setEmployeeSearch(e.target.value);
    if (errors.employee) {
      setErrors((prev) => ({ ...prev, employee: "" }));
    }
  };

  const validateIdentityAndType = () => {
    const next = {};
    if (!formData.employee) next.employee = "Vui lòng chọn nhân viên";
    if (!formData.leaveType) next.leaveType = "Chọn loại nghỉ";
    return next;
  };

  const validateDates = () => {
    const next = {};
    if (!formData.startDate) next.startDate = "Chọn ngày bắt đầu";
    if (!formData.endDate) next.endDate = "Chọn ngày kết thúc";
    if (
      formData.startDate &&
      formData.endDate &&
      new Date(formData.endDate) < new Date(formData.startDate)
    ) {
      next.endDate = "Ngày kết thúc không hợp lệ";
    }
    if (
      formData.leaveType === "HALF_DAY" &&
      formData.startDate &&
      formData.endDate &&
      formData.startDate !== formData.endDate
    ) {
      next.endDate = "Nghỉ nửa ngày chỉ áp dụng trong 1 ngày";
    }
    return next;
  };

  const validateReason = () => {
    const next = {};
    if (!formData.reason.trim()) next.reason = "Nhập lý do nghỉ";
    return next;
  };

  const validateForm = () => ({
    ...validateIdentityAndType(),
    ...validateDates(),
    ...validateReason(),
  });

  const resetForm = () => {
    setFormData({
      ...initialFormData,
      employee: isStaffSelfService ? currentUserId : "",
    });
    setEmployeeSearch("");
    setErrors({});
    setSubmitFeedback("");
    setCurrentStep(1);
  };

  const handleCancel = () => {
    resetForm();
    onCancel?.();
  };

  const handleNextStep = () => {
    const stepErrors = currentStep === 1 ? validateIdentityAndType() : validateDates();
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setCurrentStep((step) => Math.min(step + 1, wizardSteps.length));
  };

  const handlePreviousStep = () => {
    setErrors({});
    setCurrentStep((step) => Math.max(step - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      if (stepByStep) {
        if (formErrors.employee || formErrors.leaveType) setCurrentStep(1);
        else if (formErrors.startDate || formErrors.endDate) setCurrentStep(2);
        else setCurrentStep(3);
      }
      return;
    }

    const selectedRestaurantId = restaurantId || selectedEmployee?.restaurantId || "";

    if (!selectedRestaurantId) {
      setSubmitFeedback("Không xác định được nhà hàng của nhân sự. Vui lòng đăng nhập lại.");
      return;
    }

    try {
      setSubmitFeedback("");
      await onSubmit({
        employeeId: formData.employee,
        restaurantId: selectedRestaurantId,
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        startSession: formData.startSession,
        endSession: formData.endSession,
        reason: formData.reason.trim(),
      });
      resetForm();
      setSubmitFeedback("Đã gửi đơn nghỉ phép.");
      onSubmitted?.();
    } catch (submitError) {
      setSubmitFeedback(getSubmitErrorMessage(submitError));
    }
  };

  const employeeFields = (
    <div className="form-row two-col">
      <div className="form-group">
        <label>Người làm đơn *</label>
        <input
          type="search"
          value={employeeSearch}
          onChange={handleEmployeeSearchChange}
          placeholder={isStaffSelfService ? "Tự động chọn tài khoản của bạn" : "Tìm theo tên hoặc mã nhân viên"}
          className="employee-search-input"
          aria-label="Tìm nhân viên"
          data-testid="leave-employee-search"
          disabled={disabled || isStaffSelfService || (!hasStaffList && loading)}
        />
        <select
          name="employee"
          value={formData.employee}
          onChange={handleChange}
          aria-label="Người làm đơn"
          data-testid="leave-employee-select"
          disabled={disabled || !hasStaffList || isStaffSelfService}
        >
          <option value="">-- Chọn nhân viên --</option>
          {filteredStaffList.map((employee) => (
            <option key={employee.id} value={employee.id}>
              [{employee.employeeCode || "--"}] {employee.fullName}
            </option>
          ))}
        </select>
        {loading && !hasStaffList && (
          <span className="hint state-msg">Đang tải danh sách nhân viên từ dữ liệu thật...</span>
        )}
        {error && !hasStaffList && (
          <span className="err-msg state-msg">
            Không tải được danh sách nhân viên: {error.message}
          </span>
        )}
        {!loading && !error && !hasStaffList && (
          <span className="hint state-msg">Chưa có nhân viên nào trong danh sách.</span>
        )}
        {hasStaffList && employeeSearch && !hasEmployeeMatches && (
          <span className="hint state-msg">
            Không tìm thấy nhân viên phù hợp với từ khóa đã nhập.
          </span>
        )}
        {errors.employee && <span className="err-msg">{errors.employee}</span>}
      </div>
    </div>
  );

  const leaveTypeFields = compact && !stepByStep ? (
    <div className="form-group leave-type-select-group">
      <label htmlFor="leave-type-select">Loại nghỉ *</label>
      <select
        id="leave-type-select"
        name="leaveType"
        value={formData.leaveType}
        onChange={handleChange}
        aria-invalid={Boolean(errors.leaveType)}
        aria-describedby={errors.leaveType ? "leave-type-error" : undefined}
      >
        <option value="">Chọn loại nghỉ</option>
        {leaveTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
      {errors.leaveType && (
        <span id="leave-type-error" className="err-msg">
          {errors.leaveType}
        </span>
      )}
    </div>
  ) : (
    <>
      <div className="leave-types-grid">
        {leaveTypes.map((type) => (
          <label
            key={type.value}
            className={`radio-card ${formData.leaveType === type.value ? "selected" : ""}`}
          >
            <input
              type="radio"
              name="leaveType"
              value={type.value}
              checked={formData.leaveType === type.value}
              onChange={handleChange}
            />
            <span className="icon" aria-hidden="true">{type.icon}</span>
            <span className="label">{type.label}</span>
          </label>
        ))}
      </div>
      {errors.leaveType && <span className="err-msg">{errors.leaveType}</span>}
    </>
  );

  const dateFields = (
    <>
      <div className="form-row two-col date-row">
        <div className="form-group">
          <label htmlFor="leave-start-date">Từ ngày *</label>
          <div className="date-input-group">
            <input
              id="leave-start-date"
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
            />
            <select
              aria-label="Buổi bắt đầu"
              className="session-select"
              name="startSession"
              value={formData.startSession}
              onChange={handleChange}
            >
              <option value="FULL">Cả ngày</option>
              <option value="MORNING">Sáng</option>
              <option value="AFTERNOON">Chiều</option>
            </select>
          </div>
          {errors.startDate && <span className="err-msg">{errors.startDate}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="leave-end-date">Đến ngày *</label>
          <div className="date-input-group">
            <input
              id="leave-end-date"
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              min={formData.startDate}
            />
            <select
              aria-label="Buổi kết thúc"
              className="session-select"
              name="endSession"
              value={formData.endSession}
              onChange={handleChange}
            >
              <option value="FULL">Cả ngày</option>
              <option value="MORNING">Sáng</option>
              <option value="AFTERNOON">Chiều</option>
            </select>
          </div>
          {errors.endDate && <span className="err-msg">{errors.endDate}</span>}
        </div>
      </div>

      <div className="total-days-bar">
        <span>Tổng số ngày nghỉ dự kiến</span>
        <span className="days-count">{totalDays} ngày</span>
      </div>
    </>
  );

  const reasonFields = (
    <div className="form-group">
      <label htmlFor="leave-reason">Lý do nghỉ *</label>
      <textarea
        id="leave-reason"
        name="reason"
        rows="3"
        placeholder="Viết ngắn gọn để quản lý dễ xem xét..."
        value={formData.reason}
        onChange={handleChange}
      />
      {errors.reason && <span className="err-msg">{errors.reason}</span>}
    </div>
  );

  return (
    <div
      className={`leave-form-container ${compact ? "leave-form-container--compact" : ""} ${stepByStep ? "leave-form-container--wizard" : ""}`.trim()}
    >
      {title && (
        <div className="form-header-section">
          <h3 className="title">{title}</h3>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="main-form">
        {stepByStep ? (
          <>
            <nav className="leave-wizard-progress" aria-label="Tiến trình tạo đơn nghỉ phép">
              <ol>
                {wizardSteps.map((step) => {
                  const isComplete = currentStep > step.id;
                  const isActive = currentStep === step.id;
                  return (
                    <li
                      key={step.id}
                      className={`${isComplete ? "is-complete" : ""} ${isActive ? "is-active" : ""}`.trim()}
                      aria-current={isActive ? "step" : undefined}
                    >
                      <span className="leave-wizard-progress__number" aria-hidden="true">
                        {isComplete ? "✓" : step.id}
                      </span>
                      <span>{step.label}</span>
                    </li>
                  );
                })}
              </ol>
            </nav>

            {isStaffSelfService && (
              <div className="leave-wizard-self" role="status">
                <span>Người làm đơn</span>
                <strong>{selectedEmployee?.fullName || user?.fullName || "Tài khoản hiện tại"}</strong>
              </div>
            )}

            {currentStep === 1 && (
              <section className="form-section leave-wizard-step" aria-labelledby="leave-step-1-title">
                <div className="leave-wizard-step__heading">
                  <span>Bước 1/3</span>
                  <h4 id="leave-step-1-title" ref={stepHeadingRef} tabIndex="-1">
                    Chọn loại nghỉ phù hợp
                  </h4>
                  <p>Chọn một loại để hệ thống áp dụng đúng quy tắc ngày công và lương.</p>
                </div>
                {!isStaffSelfService && employeeFields}
                {leaveTypeFields}
              </section>
            )}

            {currentStep === 2 && (
              <section className="form-section leave-wizard-step" aria-labelledby="leave-step-2-title">
                <div className="leave-wizard-step__heading">
                  <span>Bước 2/3</span>
                  <h4 id="leave-step-2-title" ref={stepHeadingRef} tabIndex="-1">
                    Chọn thời gian nghỉ
                  </h4>
                  <p>Chọn ngày và buổi nghỉ. Tổng thời gian được tính tự động bên dưới.</p>
                </div>
                {dateFields}
              </section>
            )}

            {currentStep === 3 && (
              <section className="form-section leave-wizard-step" aria-labelledby="leave-step-3-title">
                <div className="leave-wizard-step__heading">
                  <span>Bước 3/3</span>
                  <h4 id="leave-step-3-title" ref={stepHeadingRef} tabIndex="-1">
                    Kiểm tra và gửi đơn
                  </h4>
                  <p>Ghi lý do ngắn gọn, sau đó kiểm tra lại thông tin trước khi gửi.</p>
                </div>

                {reasonFields}

                <div className="leave-wizard-review" aria-label="Tóm tắt đơn nghỉ phép">
                  <div>
                    <span>Loại nghỉ</span>
                    <strong>{selectedLeaveType?.label || "Chưa chọn"}</strong>
                  </div>
                  <div>
                    <span>Thời gian</span>
                    <strong>{formatDate(formData.startDate)} – {formatDate(formData.endDate)}</strong>
                    <small>
                      {sessionLabels[formData.startSession]} đến {sessionLabels[formData.endSession]}
                    </small>
                  </div>
                  <div>
                    <span>Dự kiến</span>
                    <strong>{totalDays} ngày</strong>
                  </div>
                </div>
              </section>
            )}

            <div className="form-footer leave-wizard-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={currentStep === 1 ? handleCancel : handlePreviousStep}
                disabled={disabled}
              >
                {currentStep === 1 ? "Hủy" : "Quay lại"}
              </button>
              {currentStep < wizardSteps.length ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleNextStep}
                  disabled={disabled || !hasStaffList}
                  aria-label={`Tiếp tục đến bước ${currentStep + 1}`}
                >
                  Tiếp tục
                </button>
              ) : (
                <button type="submit" className="btn btn-primary" disabled={disabled || !hasStaffList}>
                  {disabled ? "Đang gửi..." : submitLabel}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="form-section">
              <h4 className="section-title">1. Thông tin nhân sự</h4>
              {employeeFields}
            </div>

            <div className="form-section">
              <h4 className="section-title">2. Chi tiết nghỉ phép</h4>
              {leaveTypeFields}
              {dateFields}
            </div>

            <div className="form-section">
              <h4 className="section-title">3. Lý do</h4>
              {reasonFields}
            </div>

            <div className="form-footer">
              <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={disabled}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" disabled={disabled || !hasStaffList}>
                {submitLabel}
              </button>
            </div>
          </>
        )}
        {submitFeedback ? (
          <p
            className={`leave-submit-feedback ${submitFeedback.startsWith("Đã gửi") ? "is-success" : "is-error"}`}
            role={submitFeedback.startsWith("Đã gửi") ? "status" : "alert"}
          >
            {submitFeedback}
          </p>
        ) : null}
      </form>
    </div>
  );
};

export default LeaveRequestForm;
