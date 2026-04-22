import React, { useMemo, useState } from "react";
import "./LeaveRequestForm.scss";

const leaveTypes = [
  { value: "ANNUAL", label: "Nghỉ năm", icon: "🏖️" },
  { value: "SICK", label: "Nghỉ bệnh", icon: "🤒" },
  { value: "UNPAID", label: "Nghỉ không lương", icon: "💸" },
  { value: "PAID_PERSONAL", label: "Nghỉ việc riêng có lương", icon: "👪" },
  { value: "MATERNITY", label: "Nghỉ thai sản", icon: "🤱" },
  { value: "COMPENSATORY", label: "Nghỉ bù", icon: "🔁" },
  { value: "HOLIDAY", label: "Nghỉ lễ/tết", icon: "🎉" },
  { value: "HALF_DAY", label: "Nghỉ nửa ngày", icon: "🌓" },
];

const isManagerStaff = (staff) => {
  const roleText = `${staff?.positionTitle || ""} ${staff?.roleName || ""}`.toLowerCase();
  return staff?.department === "management" || roleText.includes("manager") || roleText.includes("quản lý");
};

const LeaveRequestForm = ({ onSubmit, staffList = [], disabled = false }) => {
  const [formData, setFormData] = useState({
    employee: "",
    backupPerson: "",
    leaveType: "",
    startDate: "",
    startSession: "FULL",
    endDate: "",
    endSession: "FULL",
    reason: "",
  });
  const [errors, setErrors] = useState({});

  const selectedEmployee = useMemo(
    () => staffList.find((item) => item.id === formData.employee),
    [staffList, formData.employee]
  );

  const managerCandidates = useMemo(
    () => staffList.filter((item) => isManagerStaff(item) && item.id !== formData.employee),
    [formData.employee, staffList]
  );

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
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
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

    if (isManagerStaff(selectedEmployee)) {
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
    setFormData({
      employee: "",
      backupPerson: "",
      leaveType: "",
      startDate: "",
      startSession: "FULL",
      endDate: "",
      endSession: "FULL",
      reason: "",
    });
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    const restaurantId =
      selectedEmployee?.primaryRestaurant?.id || selectedEmployee?.primaryRestaurantId;

    if (!restaurantId) {
      alert("❌ Không xác định được nhà hàng của nhân sự.");
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
        replacementManagerId: formData.backupPerson || undefined,
      });
      alert("✅ Đã tạo đơn nghỉ phép và lưu database.");
      resetForm();
    } catch (error) {
      alert(`❌ Tạo đơn thất bại: ${error?.message || "Unknown error"}`);
    }
  };

  return (
    <div className="leave-form-container">
      <div className="form-header-section">
        <h3 className="title">📝 Tạo Đơn Xin Nghỉ Phép</h3>
      </div>

      <form onSubmit={handleSubmit} className="main-form">
        <div className="form-section">
          <h4 className="section-title">1. Thông tin nhân sự</h4>
          <div className="form-row two-col">
            <div className="form-group">
              <label>Người làm đơn *</label>
              <select name="employee" value={formData.employee} onChange={handleChange}>
                <option value="">-- Chọn nhân viên --</option>
                {staffList.map((e) => (
                  <option key={e.id} value={e.id}>
                    [{e.employeeCode || "--"}] {e.fullName}
                  </option>
                ))}
              </select>
              {errors.employee && <span className="err-msg">{errors.employee}</span>}
            </div>

            <div className="form-group">
              <label>Quản lý thay thế</label>
              <select name="backupPerson" value={formData.backupPerson} onChange={handleChange}>
                <option value="">-- Chọn quản lý thay thế --</option>
                {managerCandidates.map((m) => (
                  <option key={m.id} value={m.id}>
                    [{m.employeeCode || "--"}] {m.fullName}
                  </option>
                ))}
              </select>
              {errors.backupPerson && <span className="err-msg">{errors.backupPerson}</span>}
            </div>
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
            <span>📅 Tổng số ngày nghỉ dự kiến:</span>
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
          <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={disabled}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={disabled}>
            Gửi Đơn
          </button>
        </div>
      </form>
    </div>
  );
};

export default LeaveRequestForm;
