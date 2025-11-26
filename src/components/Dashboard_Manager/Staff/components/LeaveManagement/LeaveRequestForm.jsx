import React, { useState, useMemo } from "react";
import "./LeaveRequestForm.scss"; // File SCSS mới

const LeaveRequestForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    employee: "",
    backupPerson: "", // MỚI: Người thay thế
    leaveType: "",
    startDate: "",
    startSession: "full", // MỚI: Buổi bắt đầu (Sáng/Chiều/Cả ngày)
    endDate: "",
    endSession: "full", // MỚI: Buổi kết thúc
    reason: "",
    attachment: null, // MỚI: File đính kèm
  });

  const [errors, setErrors] = useState({});

  // --- MOCK DATA ---
  const employees = [
    { id: "nguyen-van-a", name: "Nguyễn Văn An - Bếp" },
    { id: "tran-thi-b", name: "Trần Thị Bình - Thu ngân" },
    { id: "le-van-c", name: "Lê Văn Cường - Phục vụ" },
    { id: "pham-thi-d", name: "Phạm Thị Dung - Quản lý" },
  ];

  const leaveTypes = [
    { value: "annual", label: "Nghỉ phép năm (Annual Leave)", icon: "🏖️" },
    { value: "sick", label: "Nghỉ ốm (Sick Leave)", icon: "🤒" },
    { value: "unpaid", label: "Nghỉ không lương (Unpaid)", icon: "💸" },
    { value: "marriage", label: "Nghỉ cưới hỏi", icon: "💍" },
    { value: "maternity", label: "Nghỉ thai sản", icon: "🤱" },
    { value: "other", label: "Lý do khác", icon: "📝" },
  ];

  // --- HANDLERS ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFormData((prev) => ({ ...prev, attachment: file }));
  };

  // --- LOGIC TÍNH NGÀY ---
  const totalDays = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);

    if (end < start) return 0;

    let days = (end - start) / (1000 * 60 * 60 * 24) + 1;

    // Trừ đi 0.5 nếu nghỉ nửa buổi
    if (formData.startSession !== "full") days -= 0.5;
    if (formData.endSession !== "full" && days > 0.5) days -= 0.5; // Logic đơn giản hóa

    return days > 0 ? days : 0;
  }, [
    formData.startDate,
    formData.endDate,
    formData.startSession,
    formData.endSession,
  ]);

  // --- VALIDATION ---
  const validateForm = () => {
    const newErrors = {};
    if (!formData.employee) newErrors.employee = "Vui lòng chọn nhân viên";
    if (!formData.leaveType) newErrors.leaveType = "Chọn loại nghỉ phép";
    if (!formData.startDate) newErrors.startDate = "Chọn ngày bắt đầu";
    if (!formData.endDate) newErrors.endDate = "Chọn ngày kết thúc";
    if (!formData.reason.trim()) newErrors.reason = "Nhập lý do nghỉ";
    if (formData.backupPerson === formData.employee)
      newErrors.backupPerson = "Người thay thế không được trùng";

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      newErrors.endDate = "Ngày kết thúc không hợp lệ";
    }
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSubmit({ ...formData, totalDays });
    alert("Gửi đơn thành công!"); // Demo
    // Reset form logic here...
  };

  return (
    <div className="leave-form-container">
      <div className="form-header-section">
        <h3 className="title">📝 Tạo Đơn Xin Nghỉ Phép</h3>
        <p className="subtitle">
          Vui lòng điền đầy đủ thông tin bên dưới để gửi yêu cầu duyệt.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="main-form">
        {/* SECTION 1: THÔNG TIN NHÂN SỰ */}
        <div className="form-section">
          <h4 className="section-title">1. Thông tin nhân sự</h4>
          <div className="form-row two-col">
            <div className="form-group">
              <label>
                Người làm đơn <span className="req">*</span>
              </label>
              <select
                name="employee"
                value={formData.employee}
                onChange={handleChange}
                className={errors.employee ? "error" : ""}
              >
                <option value="">-- Chọn nhân viên --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              {errors.employee && (
                <span className="err-msg">{errors.employee}</span>
              )}
            </div>

            <div className="form-group">
              <label>Người thay thế / Bàn giao</label>
              <select
                name="backupPerson"
                value={formData.backupPerson}
                onChange={handleChange}
              >
                <option value="">-- Không có --</option>
                {employees
                  .filter((e) => e.id !== formData.employee)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </select>
              <span className="hint">
                Người sẽ đảm nhận công việc trong khi bạn nghỉ.
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: CHI TIẾT NGHỈ PHÉP */}
        <div className="form-section">
          <h4 className="section-title">2. Chi tiết nghỉ phép</h4>

          <div className="form-group">
            <label>
              Loại nghỉ phép <span className="req">*</span>
            </label>
            <div className="leave-types-grid">
              {leaveTypes.map((type) => (
                <label
                  key={type.value}
                  className={`radio-card ${
                    formData.leaveType === type.value ? "selected" : ""
                  }`}
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
            {errors.leaveType && (
              <span className="err-msg">{errors.leaveType}</span>
            )}
          </div>

          <div className="form-row two-col date-row">
            {/* TỪ NGÀY */}
            <div className="form-group">
              <label>
                Từ ngày <span className="req">*</span>
              </label>
              <div className="date-input-group">
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className={errors.startDate ? "error" : ""}
                />
                <select
                  name="startSession"
                  value={formData.startSession}
                  onChange={handleChange}
                  className="session-select"
                >
                  <option value="full">Cả ngày</option>
                  <option value="morning">Sáng</option>
                  <option value="afternoon">Chiều</option>
                </select>
              </div>
              {errors.startDate && (
                <span className="err-msg">{errors.startDate}</span>
              )}
            </div>

            {/* ĐẾN NGÀY */}
            <div className="form-group">
              <label>
                Đến ngày <span className="req">*</span>
              </label>
              <div className="date-input-group">
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className={errors.endDate ? "error" : ""}
                  min={formData.startDate}
                />
                <select
                  name="endSession"
                  value={formData.endSession}
                  onChange={handleChange}
                  className="session-select"
                >
                  <option value="full">Cả ngày</option>
                  <option value="morning">Sáng</option>
                  <option value="afternoon">Chiều</option>
                </select>
              </div>
              {errors.endDate && (
                <span className="err-msg">{errors.endDate}</span>
              )}
            </div>
          </div>

          {/* TỔNG SỐ NGÀY (HIGHLIGHT) */}
          <div className="total-days-bar">
            <span>📅 Tổng số ngày nghỉ dự kiến:</span>
            <span className="days-count">{totalDays} ngày</span>
          </div>
        </div>

        {/* SECTION 3: LÝ DO & ĐÍNH KÈM */}
        <div className="form-section">
          <h4 className="section-title">3. Lý do & Hồ sơ</h4>
          <div className="form-group">
            <label>
              Lý do nghỉ <span className="req">*</span>
            </label>
            <textarea
              name="reason"
              rows="3"
              placeholder="VD: Tôi bị sốt cao cần nghỉ ngơi..."
              value={formData.reason}
              onChange={handleChange}
              className={errors.reason ? "error" : ""}
            ></textarea>
            {errors.reason && <span className="err-msg">{errors.reason}</span>}
          </div>

          <div className="form-group">
            <label>Đính kèm tệp (Giấy khám bệnh, v.v...)</label>
            <div className="file-upload-wrapper">
              <input
                type="file"
                id="file-upload"
                onChange={handleFileChange}
                hidden
              />
              <label htmlFor="file-upload" className="file-upload-label">
                📎{" "}
                {formData.attachment
                  ? formData.attachment.name
                  : "Chọn tệp đính kèm..."}
              </label>
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="form-footer">
          <button type="button" className="btn btn-secondary">
            Hủy bỏ
          </button>
          <button type="submit" className="btn btn-primary">
            Gửi Đơn
          </button>
        </div>
      </form>
    </div>
  );
};

export default LeaveRequestForm;
