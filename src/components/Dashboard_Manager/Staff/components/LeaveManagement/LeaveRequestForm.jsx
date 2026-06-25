import React, { useEffect, useMemo, useState } from "react";
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

const isManagerStaff = (staff) => {
  const roleText = `${staff?.positionTitle || ""} ${staff?.roleName || ""}`.toLowerCase();
  return (
    staff?.department === "management" ||
    roleText.includes("manager") ||
    roleText.includes("quản lý")
  );
};

const initialFormData = {
  employee: "",
  backupPerson: "",
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

const LeaveRequestForm = ({
  onSubmit,
  staffList = [],
  disabled = false,
  loading = false,
  error = null,
  selfServiceEmployeeId = "",
  compact = false,
  title = "📝 Tạo Đơn Xin Nghỉ Phép",
  subtitle = "",
  submitLabel = "Gửi Đơn",
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
  const [formData, setFormData] = useState(initialFormData);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [errors, setErrors] = useState({});

  const selectedEmployee = useMemo(
    () => staffList.find((item) => String(item.id) === String(formData.employee)),
    [formData.employee, staffList]
  );

  useEffect(() => {
    if (!isStaffSelfService || !currentUserId || formData.employee) return;
    const selfInList = staffList.find((item) => String(item.id) === String(currentUserId));
    if (selfInList) {
      setFormData((prev) => ({ ...prev, employee: selfInList.id }));
    }
  }, [currentUserId, formData.employee, isStaffSelfService, staffList]);

  const requiresReplacementManager = useMemo(
    () => isManagerStaff(selectedEmployee),
    [selectedEmployee]
  );

  const filteredStaffList = useMemo(() => {
    const matched = staffList.filter((item) => matchesEmployeeSearch(item, employeeSearch));
    if (selectedEmployee && !matched.some((item) => item.id === selectedEmployee.id)) {
      return [selectedEmployee, ...matched];
    }
    return matched;
  }, [employeeSearch, selectedEmployee, staffList]);

  const managerCandidates = useMemo(
    () => staffList.filter((item) => isManagerStaff(item) && item.id !== formData.employee),
    [formData.employee, staffList]
  );

  const hasStaffList = staffList.length > 0;
  const hasEmployeeMatches = filteredStaffList.length > 0;

  useEffect(() => {
    if (!formData.backupPerson) return;
    if (!requiresReplacementManager) {
      setFormData((prev) => ({ ...prev, backupPerson: "" }));
      return;
    }

    const isValidBackup = managerCandidates.some((item) => item.id === formData.backupPerson);
    if (!isValidBackup) {
      setFormData((prev) => ({ ...prev, backupPerson: "" }));
    }
  }, [formData.backupPerson, managerCandidates, requiresReplacementManager]);

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

  const validateForm = () => {
    const next = {};
    if (!formData.employee) next.employee = "Vui lòng chọn nhân viên";
    if (!formData.leaveType) next.leaveType = "Chọn loại nghỉ";
    if (!formData.startDate) next.startDate = "Chọn ngày bắt đầu";
    if (!formData.endDate) next.endDate = "Chọn ngày kết thúc";
    if (!formData.reason.trim()) next.reason = "Nhập lý do nghỉ";
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      next.endDate = "Ngày kết thúc không hợp lệ";
    }

    if (requiresReplacementManager) {
      if (!formData.backupPerson) {
        next.backupPerson = "Quản lý xin nghỉ phải chọn quản lý thay thế";
      }
      if (formData.backupPerson === formData.employee) {
        next.backupPerson = "Quản lý thay thế không được trùng";
      }
    }

    if (formData.leaveType === "HALF_DAY" && formData.startDate !== formData.endDate) {
      next.endDate = "Nghỉ nửa ngày chỉ áp dụng trong 1 ngày";
    }

    return next;
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEmployeeSearch("");
    setErrors({});
  };

  const handleCancel = () => {
    resetForm();
    onCancel?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    const restaurantId =
      selectedEmployee?.restaurantForStaff;

    if (!restaurantId) {
      alert("Không xác định được nhà hàng của nhân sự.");
      return;
    }

    try {
      await onSubmit({
        employeeId: formData.employee,
        restaurantId,
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        startSession: formData.startSession,
        endSession: formData.endSession,
        reason: formData.reason.trim(),
        ...(requiresReplacementManager && formData.backupPerson
          ? { replacementManagerId: formData.backupPerson }
          : {}),
      });
      alert("Đã tạo đơn nghỉ phép và lưu database.");
      resetForm();
      onSubmitted?.();
    } catch (submitError) {
      if (isForbiddenError(submitError)) {
        alert("Bạn không có quyền tạo đơn nghỉ phép cho nhân sự này.");
        return;
      }
      if (isUnauthenticatedError(submitError)) {
        alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.");
        return;
      }
      alert(`Tạo đơn thất bại: ${submitError?.message || "Unknown error"}`);
    }
  };

  return (
    <div className={`leave-form-container ${compact ? "leave-form-container--compact" : ""}`}>
      {title && (
        <div className="form-header-section">
          <h3 className="title">{title}</h3>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="main-form">
        <div className="form-section">
          <h4 className="section-title">1. Thông tin nhân sự</h4>
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
            {requiresReplacementManager && (
              <div className="form-group">
                <label>Quản lý thay thế *</label>
                <select
                  name="backupPerson"
                  value={formData.backupPerson}
                  onChange={handleChange}
                  aria-label="Quản lý thay thế"
                  data-testid="leave-replacement-select"
                  disabled={disabled || managerCandidates.length === 0}
                >
                  <option value="">-- Chọn quản lý thay thế --</option>
                  {managerCandidates.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      [{manager.employeeCode || "--"}] {manager.fullName}
                    </option>
                  ))}
                </select>
                <span className="hint">
                  Chỉ nhân sự quản lý xin nghỉ mới cần chọn người thay thế.
                </span>
                {managerCandidates.length === 0 && (
                  <span className="err-msg state-msg">
                    Chưa có quản lý thay thế hợp lệ cho nhân sự này.
                  </span>
                )}
                {errors.backupPerson && <span className="err-msg">{errors.backupPerson}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="form-section">
          <h4 className="section-title">2. Chi tiết nghỉ phép</h4>
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
                <span className="icon">{type.icon}</span>
                <span className="label">{type.label}</span>
              </label>
            ))}
          </div>
          {errors.leaveType && <span className="err-msg">{errors.leaveType}</span>}

          <div className="form-row two-col date-row">
            <div className="form-group">
              <label>Từ ngày *</label>
              <div className="date-input-group">
                <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} />
                <select name="startSession" value={formData.startSession} onChange={handleChange}>
                  <option value="FULL">Cả ngày</option>
                  <option value="MORNING">Sáng</option>
                  <option value="AFTERNOON">Chiều</option>
                </select>
              </div>
              {errors.startDate && <span className="err-msg">{errors.startDate}</span>}
            </div>

            <div className="form-group">
              <label>Đến ngày *</label>
              <div className="date-input-group">
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  min={formData.startDate}
                />
                <select name="endSession" value={formData.endSession} onChange={handleChange}>
                  <option value="FULL">Cả ngày</option>
                  <option value="MORNING">Sáng</option>
                  <option value="AFTERNOON">Chiều</option>
                </select>
              </div>
              {errors.endDate && <span className="err-msg">{errors.endDate}</span>}
            </div>
          </div>

          <div className="total-days-bar">
            <span>📆 Tổng số ngày nghỉ dự kiến:</span>
            <span className="days-count">{totalDays} ngày</span>
          </div>
        </div>

        <div className="form-section">
          <h4 className="section-title">3. Lý do</h4>
          <div className="form-group">
            <textarea
              name="reason"
              rows="3"
              placeholder="Nhập lý do nghỉ..."
              value={formData.reason}
              onChange={handleChange}
            />
            {errors.reason && <span className="err-msg">{errors.reason}</span>}
          </div>
        </div>

        <div className="form-footer">
          <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={disabled}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={disabled || !hasStaffList}>
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LeaveRequestForm;
