import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { QUERY_MY_PAYSLIP, QUERY_MY_PAYSLIPS } from "@/hooks/usePayroll";
import PayrollPayslipModal from "@/components/Dashboard_Manager/Staff/components/PayrollPayslipModal";
import "./StaffDashboardPage.scss";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(amount || 0));

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "--";

const statusLabel = (status) => ({ finalized: "Đã chốt", paying: "Đang chi trả", paid: "Đã thanh toán", locked: "Đã khóa" }[status] || status || "--");

const StaffPayslipsPage = () => {
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const listQuery = useQuery(QUERY_MY_PAYSLIPS, { variables: { limit: 24 }, fetchPolicy: "cache-and-network" }) || {};
  const detailQuery = useQuery(QUERY_MY_PAYSLIP, { variables: { periodId: selectedPeriodId }, skip: !selectedPeriodId, fetchPolicy: "cache-and-network" }) || {};

  const rows = listQuery.data?.myPayslips || [];
  const modalPayslip = useMemo(() => {
    const payslip = detailQuery.data?.myPayslip || null;
    return payslip ? { ...payslip, canMarkPaid: false, canEdit: false } : null;
  }, [detailQuery.data]);

  return (
    <div className="staff-dashboard-page staff-payslips-page" aria-labelledby="staff-payslips-title">
      <section className="staff-payslips-hero staff-dashboard-section">
        <div className="staff-dashboard-hero__copy">
          <span className="staff-dashboard-badge staff-dashboard-badge--accent">Phiếu lương cá nhân</span>
          <h1 id="staff-payslips-title">Phiếu lương của tôi</h1>
          <p>Xem các kỳ lương đã được công bố.</p>
        </div>
      </section>

      {listQuery.loading && <div className="staff-dashboard-empty">Đang tải phiếu lương...</div>}
      {listQuery.error && <div className="staff-dashboard-empty">Không tải được phiếu lương. Vui lòng thử lại.</div>}
      {!listQuery.loading && !listQuery.error && rows.length === 0 && (
        <section className="staff-payslips-empty" role="status">
          <h2>Chưa có phiếu lương</h2>
          <p>Phiếu lương sẽ hiển thị khi kỳ lương được công bố.</p>
          <Link className="staff-secondary-dashboard-button" to="/staff/schedule">Xem lịch cá nhân</Link>
        </section>
      )}

      {rows.length > 0 && (
        <div className="staff-dashboard-panel">
          <div className="table-responsive">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th>Kỳ lương</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Thực lĩnh</th>
                  <th className="text-right">Đã thanh toán</th>
                  <th className="text-right">Còn lại</th>
                  <th>Ngày chốt</th>
                  <th>Ngày thanh toán</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.payrollItemId || row.periodId}>
                    <td>{row.periodName || `${formatDate(row.periodStartDate)} - ${formatDate(row.periodEndDate)}`}</td>
                    <td>{statusLabel(row.periodStatus || row.status)}</td>
                    <td className="text-right">{formatCurrency(row.netSalary)}</td>
                    <td className="text-right">{formatCurrency(row.paidAmount)}</td>
                    <td className="text-right">{formatCurrency(row.remainingAmount)}</td>
                    <td>{formatDate(row.periodFinalizedAt)}</td>
                    <td>{formatDate(row.paidAt)}</td>
                    <td><button type="button" className="btn btn-white" onClick={() => setSelectedPeriodId(row.periodId)}>Xem chi tiết</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PayrollPayslipModal
        open={Boolean(selectedPeriodId)}
        onClose={() => setSelectedPeriodId("")}
        periodId={selectedPeriodId}
        employeeId={modalPayslip?.employee?.id}
        payrollPayslip={modalPayslip}
        payrollPayments={modalPayslip?.payments || []}
        loading={detailQuery.loading}
      />
    </div>
  );
};

export default StaffPayslipsPage;
