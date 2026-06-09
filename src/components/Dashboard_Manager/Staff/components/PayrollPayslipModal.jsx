import React, { useEffect, useMemo, useState } from "react";
import "./PayrollPayslipModal.scss";

export const PAYROLL_PAYMENT_ERROR_MESSAGES = {
  ALREADY_PAID: "Nhân viên này đã được thanh toán đủ.",
  PAYROLL_PAYMENT_OVERPAY: "Số tiền vượt quá số còn lại.",
  PAYROLL_PERIOD_NOT_FINALIZED: "Cần chốt kỳ lương trước khi thanh toán.",
  PAYROLL_PERIOD_LOCKED: "Kỳ lương đã khóa, không thể thanh toán.",
  PAYROLL_PERIOD_ALREADY_PAID: "Kỳ lương đã thanh toán đủ.",
  PAYROLL_PAYMENT_AMOUNT_INVALID: "Số tiền thanh toán phải lớn hơn 0.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác bảng lương này.",
};

export const getPayrollPaymentErrorMessage = (error) => {
  const gqlError = error?.graphQLErrors?.[0];
  const code =
    gqlError?.extensions?.code ||
    gqlError?.extensions?.exception?.code ||
    error?.code;
  return (
    PAYROLL_PAYMENT_ERROR_MESSAGES[code] ||
    error?.message ||
    "Không thể thanh toán phiếu lương. Vui lòng thử lại."
  );
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "--";

const toDateTimeLocal = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const fieldLabels = [
  ["baseSalary", "Lương cơ bản", "currency"],
  ["actualWorkDays", "Ngày công thực tế"],
  ["totalHours", "Tổng giờ công"],
  ["overtimeNormalHours", "Giờ OT ngày thường"],
  ["overtimeWeekendHours", "Giờ OT cuối tuần"],
  ["overtimeHolidayHours", "Giờ OT lễ"],
  ["nightHours", "Giờ ca đêm"],
  ["grossIncome", "Thu nhập gross", "currency"],
  ["allowance", "Phụ cấp", "currency"],
  ["bonus", "Thưởng", "currency"],
  ["deduction", "Khấu trừ", "currency"],
  ["insuranceTotal", "BH bắt buộc", "currency"],
  ["personalIncomeTax", "Thuế TNCN", "currency"],
  ["netSalary", "Thực lĩnh", "currency"],
  ["paidAmount", "Đã thanh toán", "currency"],
  ["remainingAmount", "Còn lại", "currency"],
];

const getFieldValue = ({ payslip, key }) => {
  if (key === "remainingAmount") return payslip?.remainingAmount;
  if (key === "paidAmount") {
    if (payslip?.paidAmount != null) return payslip.paidAmount;
    const netSalary = Number(payslip?.breakdown?.netSalary ?? payslip?.item?.netSalary ?? 0);
    const remaining = Number(payslip?.remainingAmount ?? 0);
    return Math.max(netSalary - remaining, 0);
  }
  return payslip?.breakdown?.[key] ?? payslip?.item?.[key];
};

const PayrollPayslipModal = ({
  open,
  onClose,
  periodId,
  employeeId,
  payrollPayslip,
  payrollPayments = [],
  markPayrollItemPaid,
  loading = false,
  onPaidSuccess,
}) => {
  const [form, setForm] = useState({
    amount: "",
    method: "cash",
    paidAt: toDateTimeLocal(),
    referenceCode: "",
    note: "",
  });
  const [submitError, setSubmitError] = useState("");

  const payslip = payrollPayslip;
  const employee = payslip?.employee || payslip?.item || {};
  const period = payslip?.period || {};
  const payments = payrollPayments?.length ? payrollPayments : payslip?.payments || [];
  const remainingAmount = Number(payslip?.remainingAmount || 0);
  const canMarkPaid = Boolean(payslip?.canMarkPaid) && remainingAmount > 0;

  useEffect(() => {
    if (!open) return;
    setSubmitError("");
    setForm({
      amount: remainingAmount > 0 ? String(remainingAmount) : "",
      method: "cash",
      paidAt: toDateTimeLocal(),
      referenceCode: "",
      note: "",
    });
  }, [open, remainingAmount]);

  const setField = (key, value) =>
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));

  const totals = useMemo(
    () =>
      fieldLabels.map(([key, label, type]) => ({
        key,
        label,
        type,
        value: getFieldValue({ payslip, key }),
      })),
    [payslip],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");

    try {
      await markPayrollItemPaid({
        periodId,
        employeeId,
        amount: form.amount === "" ? undefined : Number(form.amount || 0),
        method: form.method || "cash",
        paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : new Date().toISOString(),
        note: form.note,
        referenceCode: form.referenceCode,
      });
      await onPaidSuccess?.();
    } catch (error) {
      setSubmitError(getPayrollPaymentErrorMessage(error));
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" data-testid="payroll-payslip-modal" onClick={onClose}>
      <div className="payslip-modal payroll-payslip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="brand">
            <h3>PHIẾU LƯƠNG</h3>
            <span>{period?.name || (period?.startDate ? `${formatDate(period.startDate)} - ${formatDate(period.endDate)}` : "--")}</span>
          </div>
          <button className="close-btn" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading && <div className="table-empty">Đang tải phiếu lương...</div>}
          {!loading && !payslip && <div className="table-empty">Không có dữ liệu phiếu lương.</div>}

          {payslip && (
            <>
              <div className="emp-summary">
                <div className="left">
                  <h4>{employee?.name || "--"}</h4>
                  <p>Mã NV: {employee?.code || "--"}</p>
                  <p>Bộ phận: {employee?.department || "--"}</p>
                  <p>Vai trò: {employee?.role || "--"}</p>
                </div>
                <div className="right">
                  <div className="net-total-box">
                    <span>Thực lĩnh</span>
                    <h2>{formatCurrency(getFieldValue({ payslip, key: "netSalary" }))}</h2>
                    <small>Còn lại: {formatCurrency(remainingAmount)}</small>
                  </div>
                </div>
              </div>

              <div className="details-grid payroll-breakdown-grid">
                <div className="section">
                  <h5 className="section-title income">Thông tin kỳ lương</h5>
                  <div className="row"><span>Tên kỳ</span><span>{period?.name || "--"}</span></div>
                  <div className="row"><span>Từ ngày</span><span>{formatDate(period?.startDate)}</span></div>
                  <div className="row"><span>Đến ngày</span><span>{formatDate(period?.endDate)}</span></div>
                  <div className="row"><span>Trạng thái</span><span>{period?.status || payslip?.item?.status || "--"}</span></div>
                </div>
                <div className="section">
                  <h5 className="section-title income">Breakdown</h5>
                  {totals.map(({ key, label, value, type }) => (
                    <div className="row" key={key} data-testid={`payslip-${key}`}>
                      <span>{label}</span>
                      <span>{type === "currency" ? formatCurrency(value) : (value ?? "--")}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="section payroll-payment-history">
                <h5 className="section-title income">Lịch sử thanh toán</h5>
                {payments.length === 0 ? (
                  <div className="table-empty" data-testid="payroll-payment-empty">Chưa có thanh toán nào. Chưa có lịch sử thanh toán.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="payroll-table payroll-payment-table">
                      <thead>
                        <tr>
                          <th>Số tiền</th>
                          <th>Phương thức</th>
                          <th>Ngày trả</th>
                          <th>Ghi chú</th>
                          <th>Mã tham chiếu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id || `${payment.employeeId}-${payment.paidAt}`}>
                            <td>{formatCurrency(payment.amount)}</td>
                            <td>{payment.method || "--"}</td>
                            <td>{formatDate(payment.paidAt)}</td>
                            <td>{payment.note || "--"}</td>
                            <td>{payment.referenceCode || "--"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {canMarkPaid && (
                <form className="formula-note payroll-payment-form" onSubmit={handleSubmit}>
                  <h5>Thanh toán phiếu lương</h5>
                  {submitError && <div className="settings-modal-state settings-modal-state--error">{submitError}</div>}
                  <div className="settings-form-grid">
                    <label className="settings-field">
                      <span>Số tiền</span>
                      <input type="number" value={form.amount} onChange={(e) => setField("amount", e.target.value)} min="0" />
                    </label>
                    <label className="settings-field">
                      <span>Phương thức</span>
                      <select value={form.method} onChange={(e) => setField("method", e.target.value)}>
                        <option value="cash">cash</option>
                        <option value="bank_transfer">bank_transfer</option>
                        <option value="card">card</option>
                        <option value="e_wallet">e_wallet</option>
                        <option value="other">other</option>
                      </select>
                    </label>
                    <label className="settings-field">
                      <span>Ngày thanh toán</span>
                      <input type="datetime-local" value={form.paidAt} onChange={(e) => setField("paidAt", e.target.value)} />
                    </label>
                    <label className="settings-field">
                      <span>Mã tham chiếu</span>
                      <input value={form.referenceCode} onChange={(e) => setField("referenceCode", e.target.value)} />
                    </label>
                    <label className="settings-field">
                      <span>Ghi chú</span>
                      <textarea rows={2} value={form.note} onChange={(e) => setField("note", e.target.value)} />
                    </label>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? "Đang thanh toán..." : "Xác nhận thanh toán"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" type="button" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
};

export default PayrollPayslipModal;
