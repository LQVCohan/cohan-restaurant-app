import React, { useState } from "react";

const LeaveRequestForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    employee: "",
    leaveType: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const [errors, setErrors] = useState({});

  const employees = [
    { id: "nguyen-van-a", name: "Nguyễn Văn An" },
    { id: "tran-thi-b", name: "Trần Thị Bình" },
    { id: "le-van-c", name: "Lê Văn Cường" },
    { id: "pham-thi-d", name: "Phạm Thị Dung" },
  ];

  const leaveTypes = [
    { value: "annual", label: "🏖️ Nghỉ phép năm", icon: "🏖️" },
    { value: "sick", label: "🤒 Nghỉ ốm", icon: "🤒" },
    { value: "personal", label: "👨‍👩‍👧‍👦 Nghỉ cá nhân", icon: "👨‍👩‍👧‍👦" },
    { value: "maternity", label: "🤱 Nghỉ thai sản", icon: "🤱" },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.employee) newErrors.employee = "Vui lòng chọn nhân viên";
    if (!formData.leaveType)
      newErrors.leaveType = "Vui lòng chọn loại nghỉ phép";
    if (!formData.startDate) newErrors.startDate = "Vui lòng chọn ngày bắt đầu";
    if (!formData.endDate) newErrors.endDate = "Vui lòng chọn ngày kết thúc";
    if (!formData.reason.trim())
      newErrors.reason = "Vui lòng nhập lý do nghỉ phép";

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      if (endDate < startDate) {
        newErrors.endDate = "Ngày kết thúc phải sau ngày bắt đầu";
      }
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);

    // Reset form
    setFormData({
      employee: "",
      leaveType: "",
      startDate: "",
      endDate: "",
      reason: "",
    });
    setErrors({});
  };

  const calculateDays = () => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 0;
  };

  return (
    <div className="leave-request-form">
      <div className="form-header">
        <h3 className="form-title">📝 Đăng Ký Nghỉ Phép</h3>
        <div className="form-subtitle">
          Điền thông tin để tạo đơn xin nghỉ phép
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">👤 Nhân viên *</label>
            <select
              className={`form-select ${errors.employee ? "error" : ""}`}
              name="employee"
              value={formData.employee}
              onChange={handleChange}
            >
              <option value="">Chọn nhân viên</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
            {errors.employee && (
              <div className="error-message">{errors.employee}</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">📋 Loại nghỉ phép *</label>
            <select
              className={`form-select ${errors.leaveType ? "error" : ""}`}
              name="leaveType"
              value={formData.leaveType}
              onChange={handleChange}
            >
              <option value="">Chọn loại nghỉ</option>
              {leaveTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.leaveType && (
              <div className="error-message">{errors.leaveType}</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">📅 Từ ngày *</label>
            <input
              type="date"
              className={`form-input ${errors.startDate ? "error" : ""}`}
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              min={new Date().toISOString().split("T")[0]}
            />
            {errors.startDate && (
              <div className="error-message">{errors.startDate}</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">📅 Đến ngày *</label>
            <input
              type="date"
              className={`form-input ${errors.endDate ? "error" : ""}`}
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              min={formData.startDate || new Date().toISOString().split("T")[0]}
            />
            {errors.endDate && (
              <div className="error-message">{errors.endDate}</div>
            )}
          </div>

          {calculateDays() > 0 && (
            <div className="form-group full-width">
              <div className="days-info">
                📊 Tổng số ngày nghỉ: <strong>{calculateDays()} ngày</strong>
              </div>
            </div>
          )}

          <div className="form-group full-width">
            <label className="form-label">📝 Lý do nghỉ phép *</label>
            <textarea
              className={`form-input ${errors.reason ? "error" : ""}`}
              name="reason"
              rows="4"
              placeholder="Nhập lý do nghỉ phép chi tiết..."
              value={formData.reason}
              onChange={handleChange}
            />
            {errors.reason && (
              <div className="error-message">{errors.reason}</div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setFormData({
                employee: "",
                leaveType: "",
                startDate: "",
                endDate: "",
                reason: "",
              });
              setErrors({});
            }}
          >
            🔄 Làm Mới
          </button>
          <button type="submit" className="btn btn-primary">
            ✅ Gửi Đơn Nghỉ Phép
          </button>
        </div>
      </form>
    </div>
  );
};

export default LeaveRequestForm;
